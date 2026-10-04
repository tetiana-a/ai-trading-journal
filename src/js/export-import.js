/**
 * export-import.js — JSON and CSV export / import for trades.
 */

function exportJSON() {
  // Export trades without screenshots to keep file size reasonable
  const cleanTrades = trades.map(({ screenshots, ...rest }) => rest);
  const blob = new Blob([JSON.stringify(cleanTrades, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const headers = ['date','ticker','side','status','broker','account','strategy','setup','timeframe','session','deposit','entry','exit','volume','stop_loss','take_profit','planned_risk_pct','planned_rr','fees','realized_pnl','emotion','entryReason','exitReason','notes','tags','pnl_usd','pnl_pct'];
  const rows = trades.map(tr => {
    const { pnl, pct } = calcPnl(tr);
    return [
      tr.date || '',
      tr.ticker || '',
      tr.side || '',
      tr.status || '',
      tr.broker || '',
      tr.accountLabel || '',
      tr.strategy || '',
      tr.setup || '',
      tr.timeframe || '',
      tr.session || '',
      tr.deposit || '',
      tr.entry || '',
      tr.exit || '',
      tr.volume || '',
      tr.stopLoss || '',
      tr.takeProfit || '',
      tr.plannedRiskPct || '',
      tr.plannedRR || '',
      tr.fees || '',
      tr.realizedPnl || '',
      tr.emotion || '',
      `"${(tr.entryReason || '').replace(/"/g, '”“')}"`,
      `"${(tr.exitReason || '').replace(/"/g, '”“')}"`,
      `"${(tr.notes || '').replace(/"/g, '”“')}"`,
      `"${(Array.isArray(tr.tags) ? tr.tags.join('|') : '').replace(/"/g, '”“')}"`,
      pnl.toFixed(2),
      (pct * 100).toFixed(2),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) {
        alert('Invalid file: expected a JSON array of trades.');
        return;
      }
      // Assign new IDs to avoid collisions
      imported.forEach(tr => {
        tr.id = uid();
        tr.screenshots = tr.screenshots || [];
      });
      trades = [...trades, ...imported];
      await saveTrades();
      renderAll();
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
  });
  input.click();
}
