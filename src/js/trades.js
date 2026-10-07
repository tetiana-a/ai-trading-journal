/**
 * trades.js — Trade state management and rendering.
 * Handles CRUD operations, table rendering, and live price updates.
 */

let trades = [];
let currentScreenshots = [];
let closingTradeId = null;

/* ===== Persistence ===== */

let tradeWriteBusy = false;
let tradeLoadVersion = 0;
function cloudStatus(message) {
  const state = document.getElementById('cloudState');
  if (state) state.textContent = message;
}
async function loadTrades() {
  const version = ++tradeLoadVersion;
  trades = [];
  renderAll();
  try {
    if (!window.TradingCloud) throw new Error('Supabase недоступен. Обнови страницу.');
    const session = await window.TradingCloud.session();
    if (!session) {
      cloudStatus('Войди по email, чтобы открыть и сохранять сделки в Supabase.');
      return;
    }
    const remote = await window.TradingCloud.pullTrades();
    if (version !== tradeLoadVersion) return;
    const byId = new Map();
        remote.forEach(r => {
          const id = String(r.external_id || r.id);
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
            broker: r.broker || '',
            accountLabel: r.account_label || '',
            strategy: r.strategy || '',
            setup: r.setup || '',
            timeframe: r.timeframe || '',
            session: r.session || '',
            stopLoss: r.stop_loss == null ? '' : String(r.stop_loss),
            takeProfit: r.take_profit == null ? '' : String(r.take_profit),
            plannedRiskPct: r.planned_risk_pct == null ? '' : String(r.planned_risk_pct),
            plannedRR: r.planned_rr == null ? '' : String(r.planned_rr),
            fees: r.fees == null ? '' : String(r.fees),
            realizedPnl: r.realized_pnl == null ? '' : String(r.realized_pnl),
            importRef: r.import_ref || '',
            openedAt: r.opened_at || '',
            closedAt: r.closed_at || '',
            tags: Array.isArray(r.tags) ? r.tags : [],
            source: r.source || 'journal',
            screenshots: (r.signed_screenshots && r.signed_screenshots.length) ? r.signed_screenshots : [],
            screenshotPaths: r.screenshot_paths || []
          };
          byId.set(id, mapped);
        });
        trades = Array.from(byId.values());
    cloudStatus('Загружено из Supabase: ' + trades.length + ' сделок.');
  } catch (e) {
    if (version === tradeLoadVersion) cloudStatus('Не удалось загрузить сделки: ' + e.message);
  }
  if (version === tradeLoadVersion) renderAll();
}

async function saveTrades(changedTrades = trades) {
  if (tradeWriteBusy) return false;
  tradeWriteBusy = true;
  cloudStatus('Сохраняю сделку и фото в Supabase…');
  try {
    if (!window.TradingCloud) throw new Error('Supabase недоступен. Обнови страницу.');
    await window.TradingCloud.pushTrades(changedTrades);
    cloudStatus('Сделка и фото сохранены в Supabase.');
    return true;
  } catch (e) {
    cloudStatus('Не сохранено: ' + e.message);
    alert('Не сохранено в Supabase: ' + e.message + '. Данные формы оставлены для повторной попытки.');
    return false;
  } finally {
    tradeWriteBusy = false;
  }
}

document.addEventListener('journal:cloud-session', () => { loadTrades(); });

/* ===== Live Price Updates ===== */

const fTickerInput = document.getElementById('fTicker');
const livePriceHint = document.getElementById('livePriceHint');
let priceDebounce;
let priceRequestId = 0;

fTickerInput.addEventListener('input', () => {
  clearTimeout(priceDebounce);
  const requestId = ++priceRequestId;
  livePriceHint.onclick = null;
  livePriceHint.textContent = '';
  clearValidationErrors();
  const val = fTickerInput.value.trim();
  if (!val) { livePriceHint.textContent = ''; return; }

  priceDebounce = setTimeout(async () => {
    const price = await fetchLivePrice(val);
    if (requestId !== priceRequestId) return;
    const t = translations[currentLang];
    if (price) {
      livePriceHint.textContent = `${t.hint_price} $${price.toLocaleString('ru-RU', { maximumFractionDigits: 8 })} ${t.hint_click}`;
      livePriceHint.onclick = () => {
        if (requestId !== priceRequestId) return;
        document.getElementById('fEntry').value = price;
        document.getElementById('fEntry').dispatchEvent(new Event('input', { bubbles:true }));
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
  renderStrategyStats(t);
  renderHero(t);
  renderMonthly(t);
  renderLibrary(t);
  drawEquity();
  drawPnlBarChart();
  renderCalendar();
  document.getElementById('footTradeCount').textContent = trades.length + ' ' + pluralTrades(trades.length, t);
  document.dispatchEvent(new Event('journal:trades-updated'));
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
        <button class="row-btn ai-btn" data-ai="${tr.id}">Разобрать сделку</button>
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
        <button class="row-btn ai-btn" data-ai="${tr.id}">Разобрать сделку</button>
        <button class="row-btn del" data-del="${tr.id}">✕</button>
      </td>
    `;
    closedBody.appendChild(row);
  });

  // Wire delete buttons
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const deletedId = btn.dataset.del;
      if (tradeWriteBusy) return;
      tradeWriteBusy = true;
      try {
        if (!window.TradingCloud?.deleteTrade) throw new Error('Supabase недоступен');
        await window.TradingCloud.deleteTrade(deletedId);
        trades = trades.filter(tr => tr.id !== deletedId);
        cloudStatus('Сделка удалена из Supabase.');
        renderAll();
      } catch (e) {
        cloudStatus('Не удалось удалить: ' + e.message);
      } finally { tradeWriteBusy = false; }
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

function renderStrategyStats(t) {
  const body = document.getElementById('strategyStatsBody');
  if (!body) return;
  const rows = computeStrategyStats(trades);
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--txt3);padding:22px;">—</td></tr>';
    return;
  }
  body.innerHTML = rows.map(r => `
    <tr>
      <td class="name">${escapeHtml(r.strategy)}</td>
      <td>${escapeHtml(r.timeframe)}</td>
      <td>${escapeHtml(r.session)}</td>
      <td>${r.trades}</td>
      <td>${fmtPct(r.winRate)}</td>
      <td class="${r.expectancy >= 0 ? 'pos' : 'neg'}">${fmtMoney(r.expectancy)}</td>
      <td class="${r.pnl >= 0 ? 'pnl pos' : 'pnl neg'}">${fmtMoney(r.pnl)}</td>
    </tr>`).join('');
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
  if (tradeWriteBusy) return;
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

  if (window.TradingRiskGuard?.canAddTrade) {
    const guard = await window.TradingRiskGuard.canAddTrade();
    if (!guard.ok) {
      alert(guard.reason);
      return;
    }
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
    broker:      document.getElementById('fBroker')?.value || '',
    accountLabel:document.getElementById('fAccount')?.value || '',
    strategy:    document.getElementById('fStrategy')?.value || '',
    setup:       document.getElementById('fSetup')?.value || '',
    timeframe:   document.getElementById('fTimeframe')?.value || '',
    session:     document.getElementById('fSession')?.value || '',
    stopLoss:    document.getElementById('fStopLoss')?.value || '',
    takeProfit:  document.getElementById('fTakeProfit')?.value || '',
    plannedRiskPct: document.getElementById('fPlannedRisk')?.value || '',
    plannedRR:   document.getElementById('fPlannedRR')?.value || '',
    fees:        document.getElementById('fFees')?.value || '',
    tags:        (document.getElementById('fTags')?.value || '').split(',').map(x => x.trim()).filter(Boolean),
    source:      'manual',
    openedAt:    document.getElementById('fStatus').value === 'open' ? new Date().toISOString() : '',
    closedAt:    document.getElementById('fStatus').value === 'closed' ? new Date().toISOString() : '',
    screenshots: currentScreenshots,
  };
  if (!await saveTrades([tr])) return;
  trades.push(tr);
  renderAll();

  ['fTicker', 'fDeposit', 'fEntry', 'fExit', 'fVolume', 'fEntryReason', 'fExitReason', 'fNotes',
   'fAccount','fStrategy','fSetup','fStopLoss','fTakeProfit','fPlannedRisk','fPlannedRR','fFees','fTags'].forEach(id => {
    document.getElementById(id).value = '';
  });
  currentScreenshots = [];
  renderFormScreenshots();
  livePriceHint.textContent = '';
  livePriceHint.onclick = null;
  clearTimeout(priceDebounce);
  priceRequestId++;
  document.dispatchEvent(new CustomEvent('journal:trade-added', { detail:tr }));
  document.getElementById('fTicker').focus();
});

/* ===== Close Trade ===== */

document.getElementById('confirmCloseBtn').addEventListener('click', async () => {
  if (!closingTradeId) return;
  const tr = trades.find(x => x.id === closingTradeId);
  if (tr) {
    const updated = { ...tr, status: 'closed',
      exit: document.getElementById('closeExitPrice').value,
      exitReason: document.getElementById('closeExitReason').value,
      closedAt: new Date().toISOString() };
    if (!await saveTrades([updated])) return;
    Object.assign(tr, updated);
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

