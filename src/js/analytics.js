/**
 * analytics.js — Pure calculation functions for PNL, statistics and strategy analytics.
 * All functions are side-effect-free and testable.
 */

/**
 * Calculate PNL for a single trade.
 * - Imported broker statements may provide realizedPnl (net broker result).
 * - Manual trades fall back to price-difference × volume minus fees.
 */
function calcPnl(t) {
  if (t.status === 'open') return { pnl: 0, pct: 0 };

  const explicit = Number(t.realizedPnl);
  const fees = Number(t.fees || 0);
  let pnl;

  if (Number.isFinite(explicit) && t.realizedPnl !== '' && t.realizedPnl != null) {
    pnl = explicit;
  } else {
    const entry = parseFloat(t.entry);
    const exit  = parseFloat(t.exit);
    const vol   = parseFloat(t.volume);

    if (isNaN(entry) || isNaN(exit) || isNaN(vol)) {
      return { pnl: 0, pct: 0 };
    }

    pnl = t.side === 'Short'
      ? (entry - exit) * vol
      : (exit - entry) * vol;

    if (Number.isFinite(fees)) pnl -= fees;
  }

  const dep = parseFloat(t.deposit) || 0;
  const pct = dep ? pnl / dep : 0;
  return { pnl, pct };
}

function computeStats(trades) {
  const pnls = trades.filter(tr => tr.status !== 'open').map(calcPnl);
  const total = pnls.length;
  const wins  = pnls.filter(p => p.pnl > 0);
  const losses = pnls.filter(p => p.pnl < 0);

  const winRate     = total ? wins.length / total : 0;
  const totalPnl    = pnls.reduce((s, p) => s + p.pnl, 0);
  const totalPct    = pnls.reduce((s, p) => s + p.pct, 0);
  const avgWin      = wins.length ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length : 0;
  const avgLoss     = losses.length ? losses.reduce((s, p) => s + p.pnl, 0) / losses.length : 0;
  const grossWin    = wins.reduce((s, p) => s + p.pnl, 0);
  const grossLoss   = Math.abs(losses.reduce((s, p) => s + p.pnl, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0);
  const openCount   = trades.filter(tr => tr.status === 'open').length;

  return { total, openCount, winRate, profitFactor, totalPnl, totalPct, avgWin, avgLoss };
}

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

/**
 * Strategy analytics grouped by strategy / timeframe / session.
 * Expectancy here is average realized PNL per closed trade.
 */
function computeStrategyStats(trades) {
  const groups = new Map();

  trades.filter(t => t.status !== 'open').forEach(t => {
    const strategy = (t.strategy || 'Unclassified').trim() || 'Unclassified';
    const timeframe = (t.timeframe || '—').trim() || '—';
    const session = (t.session || '—').trim() || '—';
    const key = [strategy, timeframe, session].join('||');
    if (!groups.has(key)) {
      groups.set(key, { strategy, timeframe, session, trades:0, wins:0, pnl:0, rrSum:0, rrCount:0 });
    }
    const g = groups.get(key);
    const { pnl } = calcPnl(t);
    g.trades++;
    if (pnl > 0) g.wins++;
    g.pnl += pnl;
    const rr = Number(t.plannedRR);
    if (Number.isFinite(rr) && rr > 0) { g.rrSum += rr; g.rrCount++; }
  });

  return [...groups.values()]
    .map(g => ({
      ...g,
      winRate: g.trades ? g.wins / g.trades : 0,
      expectancy: g.trades ? g.pnl / g.trades : 0,
      avgPlannedRR: g.rrCount ? g.rrSum / g.rrCount : 0
    }))
    .sort((a,b) => b.trades - a.trades || b.expectancy - a.expectancy);
}

/* ===== Formatting helpers ===== */

function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  return (n * 100).toFixed(2) + '%';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function uid() {
  return 't' + Date.now() + Math.random().toString(36).slice(2, 8);
}
