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

  function pick(headers, aliases) {
    const map = headers.map(norm);
    for (const a of aliases) {
      const n = norm(a);
      const idx = map.findIndex(h => h === n || h.includes(n) || n.includes(h));
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
    const clean = String(text || '').replace(/^\uFEFF/,'').replace(/\r/g,'');
    const lines = clean.split('\n').filter(x => x.trim());
    if (lines.length < 2) throw new Error('CSV has no trade rows');
    const delimiter = detectDelimiter(lines[0]);
    const headers = splitCsvLine(lines[0], delimiter);

    const idx = {
      ticket: pick(headers,['ticket','order','deal','trade id','id']),
      symbol: pick(headers,['symbol','ticker','instrument','market','pair']),
      side: pick(headers,['type','side','direction','action']),
      volume: pick(headers,['volume','lots','lot','size','qty','quantity']),
      openTime: pick(headers,['open time','opentime','entry time','time open','date open']),
      closeTime: pick(headers,['close time','closetime','exit time','time close','date close','time']),
      openPrice: pick(headers,['open price','price open','entry price','entry','open']),
      closePrice: pick(headers,['close price','price close','exit price','exit','close']),
      sl: pick(headers,['s/l','sl','stop loss','stoploss']),
      tp: pick(headers,['t/p','tp','take profit','takeprofit']),
      profit: pick(headers,['profit','gross pnl','pnl','realized pnl','realizedpnl']),
      net: pick(headers,['net pnl','netpnl','net profit','netprofit']),
      commission: pick(headers,['commission','fee','fees']),
      swap: pick(headers,['swap','funding']),
      comment: pick(headers,['comment','notes','remark']),
      strategy: pick(headers,['strategy','setup']),
      account: pick(headers,['account','account id','accountid'])
    };

    if (idx.symbol < 0) throw new Error('Could not detect Symbol/Ticker column');

    const broker = detectBroker(fileName);
    const result = [];

    for (let lineNo=1; lineNo<lines.length; lineNo++) {
      const row = splitCsvLine(lines[lineNo], delimiter);
      if (!row.length || !row[idx.symbol]) continue;

      const profit = idx.profit >= 0 ? num(row[idx.profit]) : null;
      const net = idx.net >= 0 ? num(row[idx.net]) : null;
      const commission = idx.commission >= 0 ? num(row[idx.commission]) : null;
      const swap = idx.swap >= 0 ? num(row[idx.swap]) : null;
      const realized = net != null ? net : (profit != null ? profit + (commission || 0) + (swap || 0) : null);

      const openTimeRaw = idx.openTime >= 0 ? row[idx.openTime] : '';
      const closeTimeRaw = idx.closeTime >= 0 ? row[idx.closeTime] : '';
      const entry = idx.openPrice >= 0 ? num(row[idx.openPrice]) : null;
      const exit = idx.closePrice >= 0 ? num(row[idx.closePrice]) : null;
      const volume = idx.volume >= 0 ? num(row[idx.volume]) : null;
      const ticket = idx.ticket >= 0 ? row[idx.ticket] : '';
      const refBase = [fileName,ticket,row[idx.symbol],openTimeRaw,closeTimeRaw,entry,exit,volume,realized].join('|');
      const importRef = 'csv:' + hash(refBase);

      result.push({
        id: 'imp_' + hash(refBase),
        ticker: String(row[idx.symbol]).trim().toUpperCase().replace(/\s/g,''),
        date: isoDate(closeTimeRaw || openTimeRaw),
        side: idx.side >= 0 ? sideOf(row[idx.side]) : 'Long',
        status: (exit != null || realized != null || closeTimeRaw) ? 'closed' : 'open',
        deposit: '',
        entry: entry == null ? '' : String(entry),
        exit: exit == null ? '' : String(exit),
        volume: volume == null ? '' : String(volume),
        emotion: '',
        entryReason: '',
        exitReason: '',
        notes: idx.comment >= 0 ? row[idx.comment] : '',
        broker,
        accountLabel: idx.account >= 0 ? row[idx.account] : '',
        strategy: idx.strategy >= 0 ? row[idx.strategy] : '',
        setup: '',
        timeframe: '',
        session: '',
        stopLoss: idx.sl >= 0 && num(row[idx.sl]) != null ? String(num(row[idx.sl])) : '',
        takeProfit: idx.tp >= 0 && num(row[idx.tp]) != null ? String(num(row[idx.tp])) : '',
        plannedRiskPct: '',
        plannedRR: '',
        fees: net != null ? '' : String(Math.abs((commission || 0) + (swap || 0))),
        realizedPnl: realized == null ? '' : String(realized),
        importRef,
        source: 'broker-csv',
        openedAt: isoTimestamp(openTimeRaw),
        closedAt: isoTimestamp(closeTimeRaw),
        tags: ['imported'],
        screenshots: []
      });
    }
    return result;
  }

  async function importFile(file) {
    const parsed = parse(await file.text(), file.name);
    const existing = new Set((window.trades || trades || []).map(t => t.importRef).filter(Boolean));
    const fresh = parsed.filter(t => !existing.has(t.importRef));
    if (!fresh.length) {
      alert('No new trades found. The file may already be imported.');
      return;
    }

    const sample = fresh.slice(0,5).map(t => `${t.date || '—'} · ${t.ticker} · ${t.side} · ${t.realizedPnl || 'PNL n/a'}`).join('\n');
    const ok = confirm(`Detected ${fresh.length} new trades from ${detectBroker(file.name)}.\n\n${sample}\n\nImport them into the journal?`);
    if (!ok) return;

    trades = [...trades, ...fresh];
    await saveTrades();
    renderAll();
    alert(`Imported ${fresh.length} trades. Broker-reported PNL is preserved when available.`);
  }

  function openPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,.tsv';
    input.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try { await importFile(file); }
      catch (err) { alert('Broker CSV import failed: ' + err.message); }
    });
    input.click();
  }

  document.getElementById('importBrokerCsvBtn')?.addEventListener('click', openPicker);
  document.getElementById('systemBrokerImportBtn')?.addEventListener('click', openPicker);

  window.BrokerCSVImporter = { parse, openPicker };
})();