/**
 * analytics.js — Pure calculation functions for PNL, statistics, and monthly breakdown.
 * All functions are side-effect-free and testable.
 */

/**
 * Calculate PNL for a single trade.
 * @param {{side: string, entry: string|number, exit: string|number, volume: string|number, deposit: string|number, status: string}} t
 * @returns {{pnl: number, pct: number}}
 */
function calcPnl(t) {
  const entry = parseFloat(t.entry);
  const exit  = parseFloat(t.exit);
  const vol   = parseFloat(t.volume);

  if (isNaN(entry) || isNaN(exit) || isNaN(vol) || t.status === 'open') {
    return { pnl: 0, pct: 0 };
  }

  // Long: profit when exit > entry;  Short: profit when entry > exit
  const pnl = t.side === 'Short'
    ? (entry - exit) * vol
    : (exit - entry) * vol;

  const dep = parseFloat(t.deposit) || 0;
  const pct = dep ? pnl / dep : 0;

  return { pnl, pct };
}

/**
 * Compute aggregate KPIs from a list of trades.
 * @param {Array} trades
 * @returns {{total: number, openCount: number, winRate: number, profitFactor: number, totalPnl: number, totalPct: number, avgWin: number, avgLoss: number}}
 */
function computeStats(trades) {
  const pnls = trades.filter(tr => tr.status !== 'open').map(calcPnl);
  const total = pnls.length;
  const wins  = pnls.filter(p => p.pnl > 0);
  const losses = pnls.filter(p => p.pnl < 0);

  const winRate     = total ? wins.length / total : 0;
  const totalPnl    = pnls.reduce((s, p) => s + p.pnl, 0);
  const totalPct    = pnls.reduce((s, p) => s + p.pct, 0);
  const avgWin      = wins.length   ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length   : 0;
  const avgLoss     = losses.length  ? losses.reduce((s, p) => s + p.pnl, 0) / losses.length : 0;
  const grossWin    = wins.reduce((s, p) => s + p.pnl, 0);
  const grossLoss   = Math.abs(losses.reduce((s, p) => s + p.pnl, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0);
  const openCount   = trades.filter(tr => tr.status === 'open').length;

  return { total, openCount, winRate, profitFactor, totalPnl, totalPct, avgWin, avgLoss };
}

/**
 * Group closed trades by month (YYYY-MM) and compute per-month stats.
 * @param {Array} trades
 * @returns {Array<{key: string, year: number, month: number, count: number, wins: number, pnl: number}>}
 */
function computeMonthly(trades) {
  const map = {};
  trades.filter(tr => tr.status !== 'open').forEach(tr => {
    if (!tr.date) return;
    const key = tr.date.slice(0, 7);
    if (!map[key]) map[key] = { count: 0, wins: 0, pnl: 0 };
    const { pnl } = calcPnl(tr);
    map[key].count++;
    if (pnl > 0) map[key].wins++;
    map[key].pnl += pnl;
  });

  return Object.keys(map).sort().map(key => {
    const [y, m] = key.split('-').map(Number);
    return { key, year: y, month: m, ...map[key] };
  });
}

/* ===== Formatting helpers ===== */

function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  return (n * 100).toFixed(2) + '%';
}

/** Escape HTML to prevent XSS in innerHTML. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Generate a unique ID for a trade. */
function uid() {
  return 't' + Date.now() + Math.random().toString(36).slice(2, 8);
}
