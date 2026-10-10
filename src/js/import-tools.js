/**
 * import-tools.js — Universal read-only trade-history importer.
 * Supports common CSV/TSV exports from MetaTrader, cTrader and exchanges.
 * It never places orders; it only imports historical/accounting data.
 */
(() => {
  function splitCsvLine(line, delimiter) {
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function detectDelimiter(firstLine) {
    const candidates = [',',';','\t'];
    return candidates
      .map(d => [d, splitCsvLine(firstLine, d).length])
      .sort((a,b) => b[1] - a[1])[0][0];
  }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s._\-\/()]+/g,'').replace(/[^a-zа-яёіїє0-9]/g,'');
  }

  // Exact header names win over partial ones, and a column already claimed by another field
  // is skipped: otherwise "Take Profit" would be read as the "Profit" column.
  function pick(headers, aliases, taken) {
    const map = headers.map(norm);
    const free = i => !(taken && taken.includes(i));
    for (const a of aliases) {
      const n = norm(a);
      const idx = map.findIndex((h, i) => free(i) && h === n);
      if (idx >= 0) return idx;
    }
    // Two-letter names such as "tp" or "id" must match exactly: "tp" also hides inside "Net Pnl".
    for (const a of aliases) {
      const n = norm(a);
      const idx = map.findIndex((h, i) => free(i) && Math.min(h.length, n.length) >= 3 && (h.includes(n) || n.includes(h)));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function num(v) {
    if (v == null || v === '') return null;
    const cleaned = String(v).trim().replace(/\s/g,'').replace(/(?<=\d),(?=\d{1,8}$)/,'.').replace(/[^0-9eE+\-.]/g,'');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function isoDate(v) {
    if (!v) return '';
    const s = String(v).trim();
    const iso = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
    if (iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
    const eu = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (eu) return `${eu[3]}-${String(eu[2]).padStart(2,'0')}-${String(eu[1]).padStart(2,'0')}`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
  }

  function isoTimestamp(v) {
    if (!v) return '';
    const d = new Date(String(v).trim().replace(/\.(\d{2})\.(\d{4})/,'/$1/$2'));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  // MT5 Reporter writes broker server time plus the server's offset from UTC, so the real moment is known.
  function serverTimeToIso(v, offsetSeconds) {
    const m = String(v || '').trim().match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m || !Number.isFinite(offsetSeconds)) return '';
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - offsetSeconds * 1000;
    return new Date(ms).toISOString();
  }

  function zoneParts(iso, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23' }).formatToParts(new Date(iso));
    const get = type => parts.find(x => x.type === type)?.value || '';
    return { date: get('year') + '-' + get('month') + '-' + get('day'), hour: Number(get('hour')) };
  }

  // The journal groups days by Prague time, the same clock FTMO uses for its daily reset.
  function pragueDate(iso) { return iso ? zoneParts(iso, 'Europe/Prague').date : ''; }

  // Which market was open when the trade started. Approximate: 08:00 to 17:00 local time in London and New York.
  function sessionOf(iso) {
    if (!iso) return '';
    const open = zone => { const h = zoneParts(iso, zone).hour; return h >= 8 && h < 17; };
    const london = open('Europe/London'), newYork = open('America/New_York');
    return london && newYork ? 'London/NY Overlap' : london ? 'London' : newYork ? 'New York' : 'Asia';
  }

  const round2 = v => Math.round(v * 100) / 100;

  function sideOf(v) {
    const s = String(v || '').toLowerCase();
    if (/sell|short|прод|шорт/.test(s)) return 'Short';
    return 'Long';
  }

  function hash(s) {
    let h = 2166136261;
    for (let i=0;i<s.length;i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h,16777619);
    }
    return (h >>> 0).toString(36);
  }

  function detectBroker(fileName) {
    const s = String(fileName || '').toLowerCase();
    if (/metatrader|mt5|mt4/.test(s)) return 'MetaTrader 5';
    if (/ctrader/.test(s)) return 'cTrader';
    if (/binance/.test(s)) return 'Binance';
    if (/bybit/.test(s)) return 'Bybit';
    if (/okx/.test(s)) return 'OKX';
    if (/kraken/.test(s)) return 'Kraken';
    if (/ftmo/.test(s)) return 'FTMO';
    if (/the5ers|5ers/.test(s)) return 'The5ers';
    if (/itrade/.test(s)) return 'iTrade';
    return 'Broker CSV';
  }

  function parse(text, fileName) {
    const clean = String(text || '').replace(/^﻿/,'').replace(/\r/g,'');
    const lines = clean.split('\n').filter(x => x.trim());
    if (lines.length < 1) throw new Error('CSV has no trade rows');
    const delimiter = detectDelimiter(lines[0]);
    const headers = splitCsvLine(lines[0], delimiter);
    // The reporter writes a header-only file when the account has no positions yet.
    const reporter = /^MT5_Journal_/i.test(fileName);
    if (lines.length < 2 && !reporter) throw new Error('CSV has no trade rows');

    const sl = pick(headers,['s/l','sl','stop loss','stoploss']);
    const tp = pick(headers,['t/p','tp','take profit','takeprofit']);
    const floating = pick(headers,['floating result']);
    const current = pick(headers,['current price']);
    const taken = [sl, tp, floating, current].filter(i => i >= 0);
    const idx = {
      ticket: pick(headers,['ticket','order','deal','trade id','id'], taken),
      symbol: pick(headers,['symbol','ticker','instrument','market','pair'], taken),
      side: pick(headers,['type','side','direction','action'], taken),
      volume: pick(headers,['volume','lots','lot','size','qty','quantity'], taken),
      openTime: pick(headers,['open time','opentime','entry time','time open','date open'], taken),
      closeTime: pick(headers,['close time','closetime','exit time','time close','date close','time'], taken),
      openPrice: pick(headers,['open price','price open','entry price','entry','open'], taken),
      closePrice: pick(headers,['close price','price close','exit price','exit','close'], taken),
      sl, tp, floating, current,
      profit: pick(headers,['profit','gross pnl','pnl','realized pnl','realizedpnl'], taken),
      net: pick(headers,['net pnl','netpnl','net profit','netprofit'], taken),
      commission: pick(headers,['commission','fee','fees'], taken),
      swap: pick(headers,['swap','funding'], taken),
      comment: pick(headers,['comment','notes','remark'], taken),
      strategy: pick(headers,['strategy','setup'], taken),
      account: pick(headers,['account','account id','accountid'], taken),
      status: reporter ? pick(headers,['status']) : -1,
      risk: reporter ? pick(headers,['risk money']) : -1,
      offset: reporter ? pick(headers,['server utc offset']) : -1
    };

    if (idx.symbol < 0) throw new Error('Could not detect Symbol/Ticker column');

    const broker = detectBroker(fileName);
    const result = [];

    for (let lineNo=1; lineNo<lines.length; lineNo++) {
      const row = splitCsvLine(lines[lineNo], delimiter);
      if (!row.length || !row[idx.symbol]) continue;
      const cell = i => i >= 0 ? num(row[i]) : null;

      const profit = cell(idx.profit);
      const net = cell(idx.net);
      const commission = cell(idx.commission);
      const swap = cell(idx.swap);
      const realized = net != null ? net : (profit != null ? profit + (commission || 0) + (swap || 0) : null);

      const openTimeRaw = idx.openTime >= 0 ? row[idx.openTime] : '';
      const closeTimeRaw = idx.closeTime >= 0 ? row[idx.closeTime] : '';
      const entry = cell(idx.openPrice);
      const exit = cell(idx.closePrice);
      const volume = cell(idx.volume);
      const stop = cell(idx.sl);
      const target = cell(idx.tp);
      const ticket = idx.ticket >= 0 ? row[idx.ticket] : '';
      // The whole-row reference is how files imported before version 1.10 were identified; keep it for matching them.
      const refBase = [fileName,ticket,row[idx.symbol],openTimeRaw,closeTimeRaw,entry,exit,volume,realized].join('|');
      const legacyRef = 'csv:' + hash(refBase);
      // A reporter position keeps one identity from the moment it opens until it closes.
      const stable = reporter && ticket;
      const offsetSeconds = cell(idx.offset);
      const zoned = reporter && offsetSeconds != null;
      const openedAt = reporter ? (zoned ? serverTimeToIso(openTimeRaw, offsetSeconds) : '') : isoTimestamp(openTimeRaw);
      const closedAt = reporter ? (zoned ? serverTimeToIso(closeTimeRaw, offsetSeconds) : '') : isoTimestamp(closeTimeRaw);
      const declared = idx.status >= 0 ? String(row[idx.status] || '').trim().toLowerCase() : '';
      const status = declared === 'open' || declared === 'closed' ? declared
        : (exit != null || realized != null || closeTimeRaw) ? 'closed' : 'open';
      const comment = idx.comment >= 0 ? row[idx.comment] : '';
      const charges = (commission || 0) + (swap || 0);
      const rr = entry != null && stop && target && entry !== stop ? round2(Math.abs(target - entry) / Math.abs(entry - stop)) : null;
      const riskMoney = cell(idx.risk);

      const trade = {
        id: stable ? 'mt5_' + ticket.replace(/[^A-Za-z0-9_-]+/g,'_') : 'imp_' + hash(refBase),
        ticker: String(row[idx.symbol]).trim().toUpperCase().replace(/\s/g,''),
        date: (zoned && pragueDate(closedAt || openedAt)) || isoDate(closeTimeRaw || openTimeRaw),
        side: idx.side >= 0 ? sideOf(row[idx.side]) : 'Long',
        status,
        deposit: '',
        entry: entry == null ? '' : String(entry),
        exit: status === 'open' || exit == null ? '' : String(exit),
        volume: volume == null ? '' : String(volume),
        emotion: '',
        entryReason: '',
        exitReason: '',
        notes: /^MT5 Reporter/i.test(comment) ? '' : comment,
        broker,
        accountLabel: idx.account >= 0 ? row[idx.account] : '',
        strategy: idx.strategy >= 0 ? row[idx.strategy] : '',
        setup: '',
        timeframe: '',
        session: zoned ? sessionOf(openedAt) : '',
        stopLoss: stop ? String(stop) : '',
        takeProfit: target ? String(target) : '',
        plannedRiskPct: '',
        plannedRR: reporter && rr != null ? String(rr) : '',
        fees: reporter ? String(round2(Math.abs(charges))) : net != null ? '' : String(Math.abs(charges)),
        realizedPnl: status === 'open' || realized == null ? '' : String(realized),
        importRef: stable ? 'mt5:' + ticket : legacyRef,
        source: 'broker-csv',
        openedAt,
        closedAt: status === 'open' ? '' : closedAt,
        tags: stable ? ['imported','mt5'] : ['imported'],
        screenshots: []
      };
      if (reporter && net != null && commission == null && swap == null) trade.fees = '';
      if (stable) {
        // Not stored in the cloud: used to match older imports and to show live figures for open positions.
        trade.legacyRef = legacyRef;
        if (riskMoney != null) trade.riskMoney = riskMoney;
        if (status === 'open') { trade.currentPrice = cell(idx.current); trade.floatingResult = cell(idx.floating); }
      }
      result.push(trade);
    }
    return result;
  }

  /** Account snapshot written by MT5 Reporter 1.10: a two-column Key;Value file. */
  function parseAccount(text) {
    const pairs = {};
    for (const line of String(text || '').replace(/^﻿/,'').split(/\r?\n/)) {
      const at = line.indexOf(';');
      if (at > 0) pairs[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    if (!pairs.Login || pairs.Balance == null) throw new Error('Not an MT5 Reporter account file');
    const n = key => { const v = num(pairs[key]); return v == null ? 0 : v; };
    const updated = String(pairs.UpdatedUtc || '').match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    return {
      reporter: pairs.Reporter || '',
      login: pairs.Login,
      server: pairs.Server || '',
      company: pairs.Company || '',
      currency: pairs.Currency || '',
      tradeMode: pairs.TradeMode || '',
      balance: n('Balance'),
      equity: n('Equity'),
      initialBalance: n('InitialBalance'),
      dayStartBalance: n('DayStartBalance'),
      dayClosedResult: n('DayClosedResult'),
      dayTrades: n('DayTrades'),
      openPositions: n('OpenPositions'),
      openRisk: n('OpenRisk'),
      openWithoutStop: n('OpenWithoutStop'),
      floatingResult: n('FloatingResult'),
      serverUtcOffset: n('ServerUtcOffset'),
      updatedAt: updated ? new Date(Date.UTC(+updated[1], +updated[2]-1, +updated[3], +updated[4], +updated[5], +updated[6])).toISOString() : ''
    };
  }

  const isAccountFile = (name, text) => /^MT5_Account_/i.test(name || '') || /^﻿?Key;Value/.test(text || '');

  // Facts the broker knows better than the journal. Everything else on a trade belongs to the trader.
  const BROKER_FIELDS = ['status','entry','exit','volume','realizedPnl','date','fees'];
  // Filled once and then left alone: the plan at entry, and what the trader may have typed already.
  const FILL_ONCE = ['stopLoss','takeProfit','plannedRR','plannedRiskPct','openedAt','closedAt','session','deposit','broker','accountLabel'];
  const LIVE_FIELDS = ['currentPrice','floatingResult','riskMoney'];

  /**
   * Fold freshly parsed broker rows into the journal without touching anything the trader wrote.
   * Pure: returns the trades to add and the changed copies of existing ones.
   */
  function mergeBrokerTrades(existing, parsed, options = {}) {
    const byId = new Map(), byRef = new Map();
    for (const t of existing || []) { byId.set(String(t.id), t); if (t.importRef) byRef.set(t.importRef, t); }
    const deposit = Number(options.deposit) > 0 ? Number(options.deposit) : 0;
    const added = [], updated = [], live = [];

    for (const p of parsed || []) {
      const known = byId.get(String(p.id)) || byRef.get(p.importRef) || (p.legacyRef && byRef.get(p.legacyRef));
      const incoming = { ...p };
      delete incoming.legacyRef;
      for (const key of LIVE_FIELDS) delete incoming[key];
      if (deposit && !incoming.deposit) incoming.deposit = String(deposit);
      if (deposit && p.riskMoney > 0 && !incoming.plannedRiskPct) incoming.plannedRiskPct = String(round2(p.riskMoney / deposit * 100));

      if (!known) {
        added.push(incoming);
        live.push({ id: incoming.id, values: p });
        continue;
      }
      live.push({ id: known.id, values: p });
      // A trade already closed in the journal is never reopened by a stale file.
      if (known.status !== 'open' && incoming.status === 'open') continue;
      const next = { ...known };
      // The day a trade closed is settled once; re-reading the file later must not move it.
      const settled = known.status === 'closed' && incoming.status === 'closed' && known.date;
      for (const key of BROKER_FIELDS) {
        if (key === 'date' && settled) continue;
        if (incoming[key] !== '' && incoming[key] != null) next[key] = incoming[key];
      }
      for (const key of FILL_ONCE) if ((next[key] === '' || next[key] == null) && incoming[key] !== '' && incoming[key] != null) next[key] = incoming[key];
      next.tags = [...new Set([...(Array.isArray(known.tags) ? known.tags : []), ...(incoming.tags || [])])];
      const changed = [...BROKER_FIELDS, ...FILL_ONCE].some(key => String(next[key] ?? '') !== String(known[key] ?? ''))
        || next.tags.length !== (Array.isArray(known.tags) ? known.tags.length : 0);
      if (changed) updated.push(next);
    }
    return { added, updated, live };
  }

  function rememberAccount(account) {
    try { localStorage.setItem('tk_mt5_account', JSON.stringify(account)); } catch (_) {}
    window.TradingPropGuard?.applySnapshot?.(account);
    document.dispatchEvent(new CustomEvent('journal:mt5-account', { detail: account }));
  }

  function savedAccount() {
    try { return JSON.parse(localStorage.getItem('tk_mt5_account') || 'null'); } catch (_) { return null; }
  }

  // The account size is the base for risk and PNL percentages of imported trades.
  function depositFor(parsed) {
    const account = savedAccount();
    if (!account || !parsed.some(t => String(t.importRef || '').includes(':' + account.login + ':'))) return 0;
    return account.initialBalance || account.balance || 0;
  }

  /**
   * Save parsed broker rows into the journal. Returns what happened; never asks or alerts,
   * so it can run from the automatic folder sync as well as from a manual import.
   */
  async function applyBrokerTrades(parsed, options = {}) {
    if (typeof trades === 'undefined' || typeof tradesLoaded === 'undefined' || !tradesLoaded) return { ok: false, added: 0, updated: 0, error: 'not-loaded' };
    const { added, updated, live } = mergeBrokerTrades(trades, parsed, { deposit: depositFor(parsed) });
    const changed = [...added, ...updated];
    if (changed.length) {
      if (options.quiet) {
        // The automatic sync must never interrupt with a dialog: report the problem and try again next time.
        if (tradeWriteBusy) return { ok: false, added: 0, updated: 0, error: 'busy' };
        tradeWriteBusy = true;
        try { await window.TradingCloud.pushTrades(changed); }
        catch (e) { return { ok: false, added: 0, updated: 0, error: e.message }; }
        finally { tradeWriteBusy = false; }
      } else if (!await saveTrades(changed)) return { ok: false, added: 0, updated: 0 };
      for (const next of updated) { const current = trades.find(t => t.id === next.id); if (current) Object.assign(current, next); }
      trades.push(...added);
    }
    // Live figures are shown but not stored: they change every few seconds.
    for (const { id, values } of live) {
      const trade = trades.find(t => t.id === id);
      if (trade) for (const key of LIVE_FIELDS) if (values[key] != null) trade[key] = values[key];
    }
    if (changed.length) { if (typeof renderAll === 'function') renderAll(); }
    else if (typeof renderLiveCells === 'function') renderLiveCells();
    return { ok: true, added: added.length, updated: updated.length, open: live.filter(x => x.values.status === 'open').length };
  }

  async function importFiles(files) {
    const loaded = [];
    for (const file of files) loaded.push({ name: file.name, text: await file.text() });
    // Read the account first: it supplies the account size used for the trades.
    for (const item of loaded.filter(x => isAccountFile(x.name, x.text))) rememberAccount(parseAccount(item.text));
    const journals = loaded.filter(x => !isAccountFile(x.name, x.text));
    if (!journals.length) { alert('MT5 account snapshot loaded. Open Trading System to see the prop limits.'); return; }

    if (typeof tradesLoaded === 'undefined' || !tradesLoaded) {
      alert('Sign in by email and wait for the journal to load, then import again.');
      return;
    }
    for (const item of journals) {
      const parsed = parse(item.text, item.name);
      const preview = mergeBrokerTrades(typeof trades !== 'undefined' ? trades : [], parsed, { deposit: depositFor(parsed) });
      const fresh = preview.added, changed = preview.updated;
      if (!fresh.length && !changed.length) {
        alert('No new trades found. The file may already be imported.');
        continue;
      }
      const sample = fresh.slice(0,5).map(t => `${t.date || '—'} · ${t.ticker} · ${t.side} · ${t.status === 'open' ? 'open' : (t.realizedPnl || 'PNL n/a')}`).join('\n');
      const ok = confirm(`Detected ${fresh.length} new and ${changed.length} updated trades from ${detectBroker(item.name)}.\n\n${sample}\n\nImport them into the journal?`);
      if (!ok) continue;
      const done = await applyBrokerTrades(parsed);
      if (done.ok) alert(`Imported ${done.added} new trades, updated ${done.updated}. Broker-reported PNL is preserved when available.`);
    }
  }

  function openPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv,.txt,.tsv';
    input.addEventListener('change', async e => {
      const files = [...(e.target.files || [])];
      if (!files.length) return;
      try { await importFiles(files); }
      catch (err) { alert('Broker CSV import failed: ' + err.message); }
    });
    input.click();
  }

  document.getElementById('importBrokerCsvBtn')?.addEventListener('click', openPicker);
  document.getElementById('systemBrokerImportBtn')?.addEventListener('click', openPicker);

  window.BrokerCSVImporter = { parse, parseAccount, isAccountFile, mergeBrokerTrades, applyBrokerTrades, rememberAccount, savedAccount, depositFor, sessionOf, openPicker };
})();
