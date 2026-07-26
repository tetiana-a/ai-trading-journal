/**
 * analytics.test.js — Unit tests for PNL calculations, stats, and monthly grouping.
 * 
 * Run with: npx jest tests/analytics.test.js
 */

/* ===== Inline the pure functions for test isolation ===== */

function calcPnl(t) {
  const entry = parseFloat(t.entry);
  const exit  = parseFloat(t.exit);
  const vol   = parseFloat(t.volume);
  if (isNaN(entry) || isNaN(exit) || isNaN(vol) || t.status === 'open') {
    return { pnl: 0, pct: 0 };
  }
  const pnl = t.side === 'Short' ? (entry - exit) * vol : (exit - entry) * vol;
  const dep = parseFloat(t.deposit) || 0;
  const pct = dep ? pnl / dep : 0;
  return { pnl, pct };
}

function computeStats(trades) {
  const pnls = trades.filter(tr => tr.status !== 'open').map(calcPnl);
  const total = pnls.length;
  const wins = pnls.filter(p => p.pnl > 0);
  const losses = pnls.filter(p => p.pnl < 0);
  const winRate = total ? wins.length / total : 0;
  const totalPnl = pnls.reduce((s, p) => s + p.pnl, 0);
  const totalPct = pnls.reduce((s, p) => s + p.pct, 0);
  const avgWin = wins.length ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, p) => s + p.pnl, 0) / losses.length : 0;
  const grossWin = wins.reduce((s, p) => s + p.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p.pnl, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : (grossWin ? Infinity : 0);
  const openCount = trades.filter(tr => tr.status === 'open').length;
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

/* ===== Tests ===== */

describe('calcPnl', () => {
  test('Long trade — profit', () => {
    const result = calcPnl({ side: 'Long', entry: 100, exit: 120, volume: 1, deposit: 1000, status: 'closed' });
    expect(result.pnl).toBe(20);
    expect(result.pct).toBeCloseTo(0.02);
  });

  test('Long trade — loss', () => {
    const result = calcPnl({ side: 'Long', entry: 100, exit: 80, volume: 2, deposit: 1000, status: 'closed' });
    expect(result.pnl).toBe(-40);
    expect(result.pct).toBeCloseTo(-0.04);
  });

  test('Short trade — profit', () => {
    const result = calcPnl({ side: 'Short', entry: 100, exit: 80, volume: 1, deposit: 1000, status: 'closed' });
    expect(result.pnl).toBe(20);
    expect(result.pct).toBeCloseTo(0.02);
  });

  test('Short trade — loss', () => {
    const result = calcPnl({ side: 'Short', entry: 100, exit: 120, volume: 2, deposit: 1000, status: 'closed' });
    expect(result.pnl).toBe(-40);
    expect(result.pct).toBeCloseTo(-0.04);
  });

  test('Open trade returns 0', () => {
    const result = calcPnl({ side: 'Long', entry: 100, exit: 120, volume: 1, deposit: 1000, status: 'open' });
    expect(result.pnl).toBe(0);
    expect(result.pct).toBe(0);
  });

  test('Missing exit price returns 0 (treated as incomplete)', () => {
    const result = calcPnl({ side: 'Long', entry: 100, exit: '', volume: 1, deposit: 1000, status: 'closed' });
    expect(result.pnl).toBe(0);
  });

  test('Zero deposit gives 0% PNL', () => {
    const result = calcPnl({ side: 'Long', entry: 100, exit: 110, volume: 1, deposit: 0, status: 'closed' });
    expect(result.pnl).toBe(10);
    expect(result.pct).toBe(0);
  });

  test('String numeric inputs are parsed correctly', () => {
    const result = calcPnl({ side: 'Long', entry: '62150.5', exit: '63400', volume: '0.05', deposit: '1000', status: 'closed' });
    expect(result.pnl).toBeCloseTo(62.475);
  });
});

describe('computeStats', () => {
  const trades = [
    { side: 'Long', entry: 100, exit: 120, volume: 1, deposit: 1000, status: 'closed' },   // +20
    { side: 'Long', entry: 100, exit: 90,  volume: 1, deposit: 1000, status: 'closed' },   // -10
    { side: 'Short', entry: 100, exit: 80, volume: 1, deposit: 1000, status: 'closed' },  // +20
    { side: 'Long', entry: 50, exit: 60,  volume: 2, deposit: 500, status: 'closed' },    // +20
    { side: 'Long', entry: 200, exit: 180, volume: 1, deposit: 1000, status: 'open' },   // ignored
  ];

  test('total count excludes open trades', () => {
    const s = computeStats(trades);
    expect(s.total).toBe(4);
  });

  test('openCount', () => {
    const s = computeStats(trades);
    expect(s.openCount).toBe(1);
  });

  test('winRate — 3 wins out of 4', () => {
    const s = computeStats(trades);
    expect(s.winRate).toBeCloseTo(0.75);
  });

  test('totalPnl = +50', () => {
    const s = computeStats(trades);
    expect(s.totalPnl).toBe(50);
  });

  test('profitFactor', () => {
    const s = computeStats(trades);
    // grossWin = 60, grossLoss = 10, PF = 6
    expect(s.profitFactor).toBeCloseTo(6);
  });

  test('avgWin', () => {
    const s = computeStats(trades);
    // 3 wins: 20, 20, 20 → avg = 20
    expect(s.avgWin).toBeCloseTo(20);
  });

  test('avgLoss', () => {
    const s = computeStats(trades);
    // 1 loss: -10 → avg = -10
    expect(s.avgLoss).toBeCloseTo(-10);
  });

  test('empty trades returns zeros', () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.totalPnl).toBe(0);
    expect(s.profitFactor).toBe(0);
  });
});

describe('computeMonthly', () => {
  const trades = [
    { side: 'Long', entry: 100, exit: 120, volume: 1, deposit: 1000, status: 'closed', date: '2025-01-15' },
    { side: 'Long', entry: 100, exit: 90,  volume: 1, deposit: 1000, status: 'closed', date: '2025-01-20' },
    { side: 'Short', entry: 200, exit: 180, volume: 1, deposit: 1000, status: 'closed', date: '2025-02-10' },
    { side: 'Long', entry: 50, exit: 60,  volume: 2, deposit: 500, status: 'closed', date: '2025-02-15' },
    { side: 'Long', entry: 100, exit: 120, volume: 1, deposit: 1000, status: 'open', date: '2025-03-01' },
  ];

  test('groups by month', () => {
    const months = computeMonthly(trades);
    expect(months).toHaveLength(2);
    expect(months[0].key).toBe('2025-01');
    expect(months[1].key).toBe('2025-02');
  });

  test('Jan: 2 trades, 1 win, PNL +10', () => {
    const months = computeMonthly(trades);
    expect(months[0].count).toBe(2);
    expect(months[0].wins).toBe(1);
    expect(months[0].pnl).toBe(10);
  });

  test('Feb: 2 trades, 2 wins, PNL +40', () => {
    const months = computeMonthly(trades);
    expect(months[1].count).toBe(2);
    expect(months[1].wins).toBe(2);
    expect(months[1].pnl).toBe(40);
  });

  test('open trades excluded from monthly', () => {
    const months = computeMonthly(trades);
    expect(months.find(m => m.key === '2025-03')).toBeUndefined();
  });

  test('trades without date are skipped', () => {
    const result = computeMonthly([{ side: 'Long', entry: 10, exit: 20, volume: 1, deposit: 100, status: 'closed', date: '' }]);
    expect(result).toHaveLength(0);
  });
});
