/**
 * trade-insights.js — What a trade was worth in R, where the edge is, and what mistakes cost.
 * Pure calculations: no page, no network, no stored state. Every function takes the trade list.
 */
(function (root) {
  'use strict';
  const num = v => v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  // Price difference times volume is money only when the instrument is quoted in a dollar stablecoin.
  const stable = t => /USD[TC]$/i.test(t.ticker || '');
  const PRAGUE = 'Europe/Prague';

  /** Net result in account currency, or null when the journal cannot know it. */
  function resultOf(t) {
    if (!t || t.status === 'open') return null;
    const stated = num(t.realizedPnl);
    if (stated !== null) return stated;
    const entry = num(t.entry), exit = num(t.exit), volume = num(t.volume);
    if (!stable(t) || entry === null || exit === null || volume === null || volume <= 0) return null;
    return (t.side === 'Short' ? entry - exit : exit - entry) * volume - (num(t.fees) || 0);
  }

  /** Distance from entry to the planned stop, or null when the stop is missing or on the wrong side. */
  function stopDistance(t) {
    const entry = num(t.entry), stop = num(t.stopLoss);
    if (entry === null || stop === null || stop <= 0) return null;
    const distance = t.side === 'Short' ? stop - entry : entry - stop;
    return distance > 0 ? distance : null;
  }

  /** Money put at risk when the trade was opened, or null. */
  function riskOf(t) {
    const reported = num(t.riskMoney);
    if (reported !== null && reported > 0) return reported;
    const deposit = num(t.deposit), pct = num(t.plannedRiskPct);
    if (deposit !== null && deposit > 0 && pct !== null && pct > 0) return deposit * pct / 100;
    const distance = stopDistance(t), volume = num(t.volume);
    if (stable(t) && distance !== null && volume !== null && volume > 0) return distance * volume;
    return null;
  }

  /**
   * The result of a closed trade in units of its initial risk.
   * Broker money over broker risk is the most exact, because it includes commission and swap.
   * Without them, the price move over the stop distance gives the same ratio for any instrument.
   */
  function rOf(t) {
    if (!t || t.status === 'open') return null;
    const result = resultOf(t), reported = num(t.riskMoney);
    if (result !== null && reported !== null && reported > 0) return result / reported;
    const entry = num(t.entry), exit = num(t.exit), distance = stopDistance(t);
    if (entry !== null && exit !== null && distance !== null) return (t.side === 'Short' ? entry - exit : exit - entry) / distance;
    const risk = riskOf(t);
    return result !== null && risk !== null ? result / risk : null;
  }

  /** Worst and best floating result while the trade was open, in R. Needs the reporter's figures. */
  function excursionOf(t) {
    const risk = num(t.riskMoney), mae = num(t.mae), mfe = num(t.mfe);
    if (risk === null || risk <= 0 || mae === null || mfe === null) return null;
    return { mae: -Math.abs(mae) / risk, mfe: Math.abs(mfe) / risk };
  }

  /* ---- Time ---- */
  function pragueParts(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PRAGUE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = type => parts.find(p => p.type === type)?.value || '';
    return { date: get('year') + '-' + get('month') + '-' + get('day'), hour: Number(get('hour')) };
  }
  const validDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s + 'T12:00:00Z'));
  const shiftDay = (day, by) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
  /** 1 = Monday … 7 = Sunday. */
  const weekdayOf = day => { const n = new Date(day + 'T12:00:00Z').getUTCDay(); return n === 0 ? 7 : n; };
  /** The Monday of the week a day belongs to. */
  const weekStart = day => shiftDay(day, 1 - weekdayOf(day));
  /** The day and hour the trade was entered, Prague time. Falls back to the journal date. */
  function entryMoment(t) {
    const opened = t.openedAt ? pragueParts(t.openedAt) : null;
    if (opened) return opened;
    return validDay(t.date) ? { date: t.date, hour: null } : null;
  }

  /* ---- Aggregation ---- */
  const blank = key => ({ key, trades: 0, decided: 0, wins: 0, rCount: 0, totalR: 0, pnlCount: 0, pnl: 0 });
  function add(row, t) {
    const result = resultOf(t), r = rOf(t), verdict = result !== null ? result : r;
    row.trades++;
    if (verdict !== null) { row.decided++; if (verdict > 0) row.wins++; }
    if (r !== null) { row.rCount++; row.totalR += r; }
    if (result !== null) { row.pnlCount++; row.pnl += result; }
    return row;
  }
  const finish = row => ({ ...row, winRate: row.decided ? row.wins / row.decided : null, avgR: row.rCount ? row.totalR / row.rCount : null });
  const closed = list => (list || []).filter(t => t && t.status !== 'open');

  const DIMENSIONS = ['weekday', 'hour', 'session', 'setup', 'ticker', 'emotion', 'strategy'];
  function keyOf(t, dimension) {
    if (dimension === 'weekday') { const m = entryMoment(t); return m ? weekdayOf(m.date) : ''; }
    if (dimension === 'hour') { const m = entryMoment(t); return m && m.hour !== null ? m.hour : ''; }
    return String(t[dimension] || '').trim();
  }

  /** Closed trades grouped by one property. An empty key collects the trades that do not have it. */
  function breakdown(list, dimension) {
    const groups = new Map();
    for (const t of closed(list)) {
      const key = keyOf(t, dimension);
      if (!groups.has(key)) groups.set(key, blank(key));
      add(groups.get(key), t);
    }
    const rows = [...groups.values()].map(finish);
    const ordered = dimension === 'weekday' || dimension === 'hour';
    return rows.sort((a, b) => (a.key === '') - (b.key === '')
      || (ordered ? a.key - b.key : (b.totalR - a.totalR) || (b.pnl - a.pnl) || String(a.key).localeCompare(String(b.key))));
  }

  const marksOf = t => Array.isArray(t.marks) ? t.marks : [];
  const mistakesOf = t => marksOf(t).filter(id => id !== 'plan');

  /** Headline figures for a set of trades. */
  function summary(list) {
    const rows = closed(list), total = finish(rows.reduce(add, blank('all')));
    const rated = rows.filter(t => marksOf(t).length), planned = rated.filter(t => !mistakesOf(t).length);
    const moves = rows.map(excursionOf).filter(Boolean);
    const kept = rows.map(t => { const x = excursionOf(t), r = rOf(t); return x && x.mfe > 0 && r !== null ? Math.max(0, r) / x.mfe : null; }).filter(v => v !== null);
    const mean = values => values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
    return {
      ...total, open: (list || []).length - rows.length,
      rated: rated.length, planned: planned.length, planRate: rated.length ? planned.length / rated.length : null,
      avgMae: mean(moves.map(x => x.mae)), avgMfe: mean(moves.map(x => x.mfe)), capture: mean(kept), excursions: moves.length
    };
  }

  /**
   * What each execution mark is associated with. A trade with two mistakes counts in both rows,
   * so the rows do not add up to the total; "plan" and "unrated" are exclusive.
   */
  function markCost(list) {
    const rows = closed(list), groups = new Map();
    const row = key => { if (!groups.has(key)) groups.set(key, blank(key)); return groups.get(key); };
    for (const t of rows) {
      const marks = marksOf(t), mistakes = mistakesOf(t);
      if (!marks.length) add(row('unrated'), t);
      else if (!mistakes.length) add(row('plan'), t);
      else for (const id of new Set(mistakes)) add(row(id), t);
    }
    const rank = r => r.key === 'plan' ? 0 : r.key === 'unrated' ? 2 : 1;
    return [...groups.values()].map(finish).sort((a, b) => rank(a) - rank(b) || (a.totalR - b.totalR) || (a.pnl - b.pnl));
  }

  /** Trades entered with the whole checklist ticked against trades where something was skipped. */
  function checklistStats(list) {
    const full = blank('full'), partial = blank('partial'), none = blank('none'), items = new Map();
    for (const t of closed(list)) {
      const done = t.checklist?.done, missed = t.checklist?.missed;
      if (!Array.isArray(done) || !Array.isArray(missed) || !(done.length + missed.length)) { add(none, t); continue; }
      add(missed.length ? partial : full, t);
      for (const id of missed) { if (!items.has(id)) items.set(id, blank(id)); add(items.get(id), t); }
    }
    return { full: finish(full), partial: finish(partial), none: finish(none), items: [...items.values()].map(finish).sort((a, b) => a.totalR - b.totalR || b.trades - a.trades) };
  }

  /** A trade still waiting for the part only the trader can add. */
  function isIncomplete(t) {
    if (!t) return false;
    if (!String(t.setup || '').trim()) return true;
    return t.status !== 'open' && !marksOf(t).length;
  }
  function incomplete(list) {
    return (list || []).filter(isIncomplete)
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || String(b.date || '').localeCompare(String(a.date || '')));
  }

  /** One trading week, Monday to Sunday, by the journal date of each trade. */
  function weekReview(list, monday) {
    const from = weekStart(monday), to = shiftDay(from, 6);
    const week = (list || []).filter(t => validDay(t.date) && t.date >= from && t.date <= to);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftDay(from, i);
      days.push({ date, ...finish(closed(week).filter(t => t.date === date).reduce(add, blank(date))) });
    }
    const traded = days.filter(d => d.trades);
    const score = d => d.rCount ? d.totalR : d.pnlCount ? d.pnl : null;
    const pick = (rows, direction) => rows.filter(r => score(r) !== null).sort((a, b) => direction * (score(b) - score(a)))[0] || null;
    const setups = breakdown(week, 'setup').filter(r => r.key !== '');
    const mistakes = markCost(week).filter(r => r.key !== 'plan' && r.key !== 'unrated');
    const best = pick(setups, 1), worst = pick(setups, -1);
    return {
      from, to, summary: summary(week), days,
      bestSetup: best, worstSetup: worst && best && worst.key !== best.key ? worst : null,
      // The mistake that cost the most; when R is unknown, the one made most often.
      topMistake: mistakes.slice().sort((a, b) => (a.totalR - b.totalR) || (b.trades - a.trades))[0] || null,
      bestDay: pick(traded, 1), worstDay: traded.length > 1 ? pick(traded, -1) : null,
      incomplete: week.filter(isIncomplete).length
    };
  }

  /** Keep the trades of the last `days` calendar days (Prague). 0 keeps everything. */
  function recent(list, days, now = new Date()) {
    if (!days) return list || [];
    const today = pragueParts(now.toISOString()).date, start = shiftDay(today, 1 - days);
    return (list || []).filter(t => validDay(t.date) && t.date >= start && t.date <= today);
  }

  const api = { resultOf, riskOf, rOf, excursionOf, stopDistance, breakdown, summary, markCost, checklistStats, isIncomplete, incomplete, weekReview, weekStart, shiftDay, weekdayOf, entryMoment, recent, DIMENSIONS };
  root.TradeInsights = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
