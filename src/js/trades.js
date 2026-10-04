/**
 * trades.js — Trade state management and rendering.
 * Handles CRUD operations, table rendering, and live price updates.
 */

let trades = [];
let currentScreenshots = [];
let closingTradeId = null;

/* ===== Persistence ===== */

async function loadTrades() {
  try {
    const res = await db.get(STORAGE_KEYS.TRADES);
    trades = res ? JSON.parse(res) : [];
  } catch (e) {
    console.error('[trades] Failed to load trades:', e);
    trades = [];
  }
  try {
    if (window.TradingCloud) {
      const session = await window.TradingCloud.session();
      if (session) {
        const remote = await window.TradingCloud.pullTrades();
        const byId = new Map(trades.map(t => [String(t.id), t]));
        remote.forEach(r => {
          const id = String(r.external_id || r.id);
          const local = byId.get(id);
          const mapped = {
            id,
            ticker: r.ticker || '',
            date: r.trade_date || '',
            side: r.side || 'Long',
            status: r.status || 'closed',
            deposit: r.deposit == null ? '' : String(r.deposit),
            entry: r.entry == null ? '' : String(r.entry),
            exit: r.exit == null ? '' : String(r.exit),
            volume: r.volume == null ? '' : String(r.volume),
            emotion: r.emotion || '',
            entryReason: r.entry_reason || '',
            exitReason: r.exit_reason || '',
            notes: r.notes || '',
            screenshots: local?.screenshots || []
          };
          byId.set(id, { ...(local || {}), ...mapped });
        });
        trades = Array.from(byId.values());
        await db.set(STORAGE_KEYS.TRADES, JSON.stringify(trades));
      }
    }
  } catch (e) {
    console.warn('[trades] Cloud pull skipped:', e);
  }
  renderAll();
}

async function saveTrades() {
  try {
    await db.set(STORAGE_KEYS.TRADES, JSON.stringify(trades));
    if (window.TradingCloud) {
      const session = await window.TradingCloud.session();
      if (session) await window.TradingCloud.pushTrades(trades);
    }
  } catch (e) {
    console.error('[trades] Storage error', e);
    alert(translations[currentLang].alert_storage_error);
  }
}

/* ===== Live Price Updates ===== */

const fTickerInput = document.getElementById('fTicker');
const livePriceHint = document.getElementById('livePriceHint');
let priceDebounce;

fTickerInput.addEventListener('input', () => {
  clearTimeout(priceDebounce);
  clearValidationErrors();
  const val = fTickerInput.value.trim();
  if (!val) { livePriceHint.textContent = ''; return; }

  priceDebounce = setTimeout(async () => {
    const price = await fetchLivePrice(val);
    const t = translations[currentLang];
    if (price) {
      livePriceHint.textContent = `${t.hint_price} $${price.toLocaleString('ru-RU', { maximumFractionDigits: 8 })} ${t.hint_click}`;
      livePriceHint.onclick = () => {
        document.getElementById('fEntry').value = price;
        document.getElementById('fEntry').focus();
      };
    } else {
      livePriceHint.textContent = t.hint_not_found;
      livePriceHint.onclick = null;
    }
  }, 400);
});

async function updateLivePrices() {
  const openTrades = trades.filter(t => t.status === 'open');
  for (const t of openTrades) {
    const cell = document.querySelector(`td.live-price[data-ticker-id="${t.id}"]`);
    if (cell) {
      const price = await fetchLivePrice(t.ticker);
      if (price) {
        cell.textContent = price.toLocaleString('ru-RU', { maximumFractionDigits: 8 });
        const entry = parseFloat(t.entry);
        if (!isNaN(entry)) {
          if (t.side === 'Long') cell.className = `live-price ${price >= entry ? 'pos' : 'neg'}`;
          else cell.className = `live-price ${price <= entry ? 'pos' : 'neg'}`;
        }
      } else {
        cell.textContent = translations[currentLang].live_na;
      }
    }
  }
}
setInterval(updateLivePrices, 30000);

/* ===== Render Functions ===== */

function renderAll() {
  const t = translations[currentLang];
  renderTrades(t);
  renderStats(t);
  renderHero(t);
  renderMonthly(t);
  renderLibrary(t);
  drawEquity();
  drawPnlBarChart();
  renderCalendar();
  document.getElementById('footTradeCount').textContent = trades.length + ' ' + pluralTrades(trades.length, t);
}

function renderTrades(t) {
  const openBody = document.getElementById('openTradesBody');
  const closedBody = document.getElementById('closedTradesBody');
  openBody.innerHTML = '';
  closedBody.innerHTML = '';

  const openTrades = trades.filter(tr => tr.status === 'open').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const closedTrades = trades.filter(tr => tr.status !== 'open').sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  document.getElementById('emptyOpen').style.display = openTrades.length ? 'none' : 'block';
  document.getElementById('emptyClosed').style.display = closedTrades.length ? 'none' : 'block';

  // Open trades rows
  openTrades.forEach(tr => {
    const row = document.createElement('tr');
    const ssHtml = (tr.screenshots || []).map(src => `<img src="${src}" data-ss="${src}" alt="sc">`).join('');
    row.innerHTML = `
      <td>${tr.date || '—'}</td>
      <td class="name">${escapeHtml(tr.ticker || '—')}</td>
      <td><span class="badge ${tr.side === 'Long' ? 'long' : 'short'}">${tr.side}</span></td>
      <td>${tr.entry || '—'}</td>
      <td class="live-price" data-ticker-id="${tr.id}"><span style="color:var(--txt3);font-size:10px;">${t.live_loading}</span></td>
      <td>${tr.volume || '—'}</td>
      <td>${escapeHtml(tr.emotion || '—')}</td>
      <td><div class="row-ss">${ssHtml}</div></td>
      <td class="row-actions">
        <button class="row-btn ai-btn" data-ai="${tr.id}">AI</button>
        <button class="row-btn" data-close-id="${tr.id}">${t.modal_close_title}</button>
        <button class="row-btn del" data-del="${tr.id}">✕</button>
      </td>
    `;
    openBody.appendChild(row);
  });

  // Closed trades rows
  closedTrades.forEach(tr => {
    const { pnl, pct } = calcPnl(tr);
    const row = document.createElement('tr');
    const ssHtml = (tr.screenshots || []).map(src => `<img src="${src}" data-ss="${src}" alt="sc">`).join('');
    row.innerHTML = `
      <td>${tr.date || '—'}</td>
      <td class="name">${escapeHtml(tr.ticker || '—')}</td>
      <td><span class="badge ${tr.side === 'Long' ? 'long' : 'short'}">${tr.side}</span></td>
      <td>${fmtMoney(parseFloat(tr.deposit) || 0)}</td>
      <td>${tr.entry || '—'}</td>
      <td>${tr.exit || '—'}</td>
      <td>${tr.volume || '—'}</td>
      <td class="pnl ${pnl >= 0 ? 'pos' : 'neg'}">${fmtMoney(pnl)}</td>
      <td class="pnl ${pct >= 0 ? 'pos' : 'neg'}">${fmtPct(pct)}</td>
      <td>${escapeHtml(tr.emotion || '—')}</td>
      <td><div class="row-ss">${ssHtml}</div></td>
      <td class="row-actions">
        <button class="row-btn ai-btn" data-ai="${tr.id}">AI</button>
        <button class="row-btn del" data-del="${tr.id}">✕</button>
      </td>
    `;
    closedBody.appendChild(row);
  });

  // Wire delete buttons
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      trades = trades.filter(tr => tr.id !== btn.dataset.del);
      await saveTrades();
      renderAll();
    });
  });

  // Wire close buttons
  document.querySelectorAll('[data-close-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      closingTradeId = btn.dataset.closeId;
      const tr = trades.find(x => x.id === closingTradeId);
      document.getElementById('closeModalTitle').textContent = `${t.modal_close_title}: ${tr.ticker}`;
      document.getElementById('closeExitPrice').value = tr.exit || '';
      document.getElementById('closeExitReason').value = tr.exitReason || '';
      document.getElementById('closeTradeModal').classList.add('show');
    });
  });

  // Wire AI buttons
  document.querySelectorAll('[data-ai]').forEach(btn => {
    btn.addEventListener('click', () => analyzeTrade(btn.dataset.ai));
  });

  // Wire screenshot thumbnails
  document.querySelectorAll('[data-ss]').forEach(img => {
    img.addEventListener('click', () => {
      document.getElementById('imgViewerSrc').src = img.dataset.ss;
      document.getElementById('imgViewerModal').classList.add('show');
    });
  });

  updateLivePrices();
}

function renderStats(t) {
  const grid = document.getElementById('kpiGrid');
  const s = computeStats(trades);

  const cards = [
    { l: t.kpi_closed, v: s.total, cls: '' },
    { l: t.kpi_open, v: s.openCount, cls: '' },
    { l: t.stat_winrate, v: fmtPct(s.winRate), cls: '' },
    { l: t.kpi_pf, v: s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2), cls: '' },
    { l: t.kpi_total_usd, v: fmtMoney(s.totalPnl), cls: s.totalPnl >= 0 ? 'pos' : 'neg' },
    { l: t.kpi_total_pct, v: fmtPct(s.totalPct), cls: s.totalPct >= 0 ? 'pos' : 'neg' },
    { l: t.kpi_avg_win, v: fmtMoney(s.avgWin), cls: 'pos' },
    { l: t.kpi_avg_loss, v: fmtMoney(s.avgLoss), cls: 'neg' },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="kpi-cell">
      <div class="kpi-lbl">${c.l}</div>
      <div class="kpi-val ${c.cls}">${c.v}</div>
    </div>`).join('');
}

function renderHero(t) {
  const box = document.getElementById('heroStats');
  const s = computeStats(trades);
  const total = trades.length;
  box.innerHTML = `
    <div><div class="stat-n">${total}</div><div class="stat-l">${t.stat_total}</div></div>
    <div><div class="stat-n">${fmtPct(s.winRate)}</div><div class="stat-l">${t.stat_winrate}</div></div>
    <div><div class="stat-n ${s.totalPnl >= 0 ? 'pos' : 'neg'}">${fmtMoney(s.totalPnl)}</div><div class="stat-l">${t.stat_totalpnl}</div></div>
  `;
}

function renderMonthly(t) {
  const body = document.getElementById('monthlyBody');
  const months = computeMonthly(trades);

  if (!months.length) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--txt3);font-family:'JetBrains Mono',monospace;font-size:11px;padding:24px;">0 ${t.pl_trade_5}</td></tr>`;
    return;
  }

  let totalCount = 0, totalPnl = 0, totalWins = 0;
  const rows = months.map(m => {
    totalCount += m.count;
    totalPnl += m.pnl;
    totalWins += m.wins;
    const wr = m.count ? m.wins / m.count : 0;
    return `<tr><td>${t.months[m.month - 1]} ${m.year}</td><td>${m.count}</td><td>${fmtPct(wr)}</td><td class="${m.pnl >= 0 ? 'pnl pos' : 'pnl neg'}">${fmtMoney(m.pnl)}</td></tr>`;
  }).join('');

  const totalWr = totalCount ? totalWins / totalCount : 0;
  body.innerHTML = rows + `<tr class="total"><td>${t.th_total}</td><td>${totalCount}</td><td>${fmtPct(totalWr)}</td><td class="${totalPnl >= 0 ? 'pnl pos' : 'pnl neg'}">${fmtMoney(totalPnl)}</td></tr>`;
}

function renderLibrary(t) {
  const grid = document.getElementById('ssLibraryGrid');
  const empty = document.getElementById('emptyLibrary');
  grid.innerHTML = '';

  let allScreens = [];
  trades.forEach(tr => {
    (tr.screenshots || []).forEach(src => {
      allScreens.push({ src, ticker: tr.ticker, date: tr.date });
    });
  });

  if (!allScreens.length) {
    empty.style.display = 'block';
    grid.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  grid.style.display = 'grid';

  allScreens.forEach(s => {
    const div = document.createElement('div');
    div.className = 'ss-lib-item';
    div.innerHTML = `
      <img src="${s.src}" alt="screen">
      <div class="ss-lib-meta">
        <span>${escapeHtml(s.ticker)}</span>
        <span>${s.date || ''}</span>
      </div>
    `;
    div.addEventListener('click', () => {
      document.getElementById('imgViewerSrc').src = s.src;
      document.getElementById('imgViewerModal').classList.add('show');
    });
    grid.appendChild(div);
  });
}

/* ===== Add Trade ===== */

document.getElementById('btnAdd').addEventListener('click', async () => {
  const t = translations[currentLang];
  const fields = {
    ticker: document.getElementById('fTicker').value.trim(),
    deposit: document.getElementById('fDeposit').value,
    entry:   document.getElementById('fEntry').value,
    exit:    document.getElementById('fExit').value,
    volume:  document.getElementById('fVolume').value,
  };

  const { valid, errors } = validateTradeForm(fields, t);
  if (!valid) {
    showValidationErrors(errors);
    return;
  }

  const tr = {
    id:          uid(),
    ticker:      fields.ticker.toUpperCase(),
    date:        document.getElementById('fDate').value || new Date().toISOString().slice(0, 10),
    side:        document.getElementById('fSide').value,
    status:      document.getElementById('fStatus').value,
    deposit:     fields.deposit,
    entry:       fields.entry,
    exit:        fields.exit,
    volume:      fields.volume,
    emotion:     document.getElementById('fEmotion').value,
    entryReason: document.getElementById('fEntryReason').value,
    exitReason:  document.getElementById('fExitReason').value,
    notes:       document.getElementById('fNotes').value,
    screenshots: currentScreenshots,
  };
  trades.push(tr);
  await saveTrades();
  renderAll();

  ['fTicker', 'fDeposit', 'fEntry', 'fExit', 'fVolume', 'fEntryReason', 'fExitReason', 'fNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  currentScreenshots = [];
  renderFormScreenshots();
  livePriceHint.textContent = '';
  document.getElementById('fTicker').focus();
});

/* ===== Close Trade ===== */

document.getElementById('confirmCloseBtn').addEventListener('click', async () => {
  if (!closingTradeId) return;
  const tr = trades.find(x => x.id === closingTradeId);
  if (tr) {
    tr.status = 'closed';
    tr.exit = document.getElementById('closeExitPrice').value;
    tr.exitReason = document.getElementById('closeExitReason').value;
    await saveTrades();
    renderAll();
  }
  document.getElementById('closeTradeModal').classList.remove('show');
  closingTradeId = null;
});

/* ===== Modal close handlers ===== */

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.remove('show');
  });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  });
});

/* ===== API Settings ===== */

document.getElementById('apiSettingsBtn').addEventListener('click', () => {
  document.getElementById('apiUrlInput').value  = localStorage.getItem(STORAGE_KEYS.API_URL)  || 'https://api.groq.com/openai/v1/chat/completions';
  document.getElementById('apiKeyInput').value   = localStorage.getItem(STORAGE_KEYS.API_KEY)  || '';
  document.getElementById('apiModelInput').value = localStorage.getItem(STORAGE_KEYS.API_MODEL) || 'llama-3.3-70b-versatile';
  document.getElementById('apiSettingsModal').classList.add('show');
});

document.getElementById('saveApiBtn').addEventListener('click', () => {
  localStorage.setItem(STORAGE_KEYS.API_URL,  document.getElementById('apiUrlInput').value);
  localStorage.setItem(STORAGE_KEYS.API_KEY,  document.getElementById('apiKeyInput').value);
  localStorage.setItem(STORAGE_KEYS.API_MODEL, document.getElementById('apiModelInput').value);
  document.getElementById('apiSettingsModal').classList.remove('show');
  alert(translations[currentLang].alert_api_saved);
});
