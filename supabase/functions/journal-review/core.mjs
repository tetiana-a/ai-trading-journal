export const VERSION = 'journal-review-v1';
export const LIMITS = { trades: 20000, details: 80, images: 6, knowledge: 12 };
const number = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const round = n => Math.round(n * 10000) / 10000;
export function pragueDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Prague', year:'numeric',month:'2-digit',day:'2-digit' }).format(date) : null;
}
export function tradeDay(t) {
  const stamp = t.status === 'open' ? t.opened_at : t.closed_at;
  return (stamp && pragueDate(stamp)) || (/^\d{4}-\d{2}-\d{2}$/.test(t.trade_date || '') ? t.trade_date : null);
}
export function periodFor(scope, now = new Date()) {
  if (scope !== 'weekly') return null;
  const end = pragueDate(now), start = new Date(end + 'T12:00:00Z');
  start.setUTCDate(start.getUTCDate() - 6);
  return { start:start.toISOString().slice(0,10), end, timezone:'Europe/Prague', definition:'Last 7 calendar days including today; closed trades by close date, open trades by opening date; trade_date fallback.' };
}
export function selectTrades(rows, scope, tradeId, period) {
  if (scope === 'trade') return rows.filter(t => t.external_id === tradeId);
  if (scope === 'weekly') return rows.filter(t => { const day=tradeDay(t); return day && day>=period.start && day<=period.end; });
  return rows;
}
export function resultOf(t) {
  if (t.status === 'open') return { value:null, method:'open' };
  if (t.status !== 'closed') return { value:null, method:'unknown_status' };
  const actual=number(t.realized_pnl);
  if (actual !== null) return { value:actual, method:'broker_net' };
  // Lot-based instruments need contract size and conversion, which this schema does not store.
  const broker=String(t.broker || '').toLowerCase();
  if (/mt[45]|metatrader|ctrader|ftmo|the5ers|funded|itrade/.test(broker)) return { value:null, method:'missing_contract_specification' };
  if (!/USDT$|USDC$/.test(String(t.ticker || '').toUpperCase())) return { value:null, method:'missing_pnl_or_units' };
  const entry=number(t.entry), exit=number(t.exit), volume=number(t.volume), fees=number(t.fees);
  if (entry===null || exit===null || volume===null || volume<=0 || !['Long','Short'].includes(t.side)) return { value:null, method:'missing_execution_data' };
  const value=(t.side==='Short'?entry-exit:exit-entry)*volume-(fees || 0);
  return { value:round(value), method:'estimate_base_asset_units', feesKnown:fees!==null };
}
export function summarize(rows) {
  const groups = new Map();
  for (const t of [...rows].sort((a,b)=>String(a.closed_at || a.trade_date || '').localeCompare(String(b.closed_at || b.trade_date || '')) || String(a.id).localeCompare(String(b.id)))) {
    const currency = number(t.realized_pnl)!==null ? 'account currency (not recorded)' : String(t.ticker || '').toUpperCase().endsWith('USDT') ? 'USDT' : String(t.ticker || '').toUpperCase().endsWith('USDC') ? 'USDC' : 'account currency (not recorded)';
    const key=JSON.stringify([t.broker || 'Unspecified broker',t.account_label || 'Unspecified account',currency]);
    if (!groups.has(key)) groups.set(key,{broker:t.broker || 'Unspecified broker',account:t.account_label || 'Unspecified account',currency,trades:0,closed:0,open:0,knownPnl:0,unknownPnl:0,estimatedPnl:0,feesUnknown:0,wins:0,losses:0,breakeven:0,netPnl:0,grossProfit:0,grossLoss:0,closedPnlDrawdown:0,lossStreak:0,maxLossStreak:0,curve:0,peak:0,byStrategy:{},bySession:{}});
    const g=groups.get(key), r=resultOf(t);g.trades++;
    if(t.status==='open'){g.open++;continue;}g.closed++;
    if(r.value===null){g.unknownPnl++;g.lossStreak=0;continue;}
    g.knownPnl++;if(r.method.startsWith('estimate')){g.estimatedPnl++;if(!r.feesKnown)g.feesUnknown++;}
    const pnl=r.value;g.netPnl+=pnl;g.curve+=pnl;g.peak=Math.max(g.peak,g.curve);g.closedPnlDrawdown=Math.max(g.closedPnlDrawdown,g.peak-g.curve);
    if(pnl>0){g.wins++;g.grossProfit+=pnl;g.lossStreak=0;}
    else if(pnl<0){g.losses++;g.grossLoss-=pnl;g.lossStreak++;g.maxLossStreak=Math.max(g.maxLossStreak,g.lossStreak);}
    else {g.breakeven++;g.lossStreak=0;}
    for(const [field,source] of [['byStrategy','strategy'],['bySession','session']]) {
      const name=String(t[source] || 'Unclassified');
      if(!Object.hasOwn(g[field],name))Object.defineProperty(g[field],name,{value:{trades:0,pnl:0,wins:0},enumerable:true,writable:true});
      g[field][name].trades++;g[field][name].pnl+=pnl;if(pnl>0)g[field][name].wins++;
    }
  }
  return { total:rows.length, missingDates:rows.filter(t=>!tradeDay(t)).length,
    missingStop:rows.filter(t=>number(t.stop_loss)===null).length, missingEntryReason:rows.filter(t=>!t.entry_reason?.trim()).length,
    accounts:[...groups.values()].map(g=>{const {curve,peak,lossStreak,...out}=g;return {...out,netPnl:round(g.netPnl),closedPnlDrawdown:round(g.closedPnlDrawdown),winRate:g.knownPnl?round(g.wins/g.knownPnl):null,expectancy:g.knownPnl?round(g.netPnl/g.knownPnl):null,profitFactor:g.grossLoss?round(g.grossProfit/g.grossLoss):null};}),
    limitations:['PNL is grouped by broker/account/quote currency; totals across accounts are not combined.','Account currency and FX conversion are not recorded. Broker net PNL is in account currency; quote label is only indicative.','Price-based PNL is an estimate assuming base-asset units; lot contracts require broker net PNL.','Drawdown covers known closed-trade PNL only, excluding open equity, deposits and withdrawals. It cannot prove FTMO compliance.','Profit factor is undefined when gross loss is zero. Unknown outcomes are excluded, not counted as zero.','Small samples cannot establish a strategy edge.'] };
}
const clip = (v,n=1200) => String(v ?? '').slice(0,n);
export function detailSample(rows) {
  return [...rows].sort((a,b)=>String(tradeDay(b)||'').localeCompare(String(tradeDay(a)||'')) || String(a.id).localeCompare(String(b.id))).slice(0,LIMITS.details).map(t=>({
    id:t.external_id,ticker:clip(t.ticker,60),date:tradeDay(t),status:t.status,side:t.side,broker:clip(t.broker,80),account:clip(t.account_label,80),
    entry:t.entry,exit:t.exit,volume:t.volume,stop:t.stop_loss,target:t.take_profit,plannedRiskPct:t.planned_risk_pct,plannedRR:t.planned_rr,fees:t.fees,pnl:resultOf(t),
    strategy:clip(t.strategy,200),setup:clip(t.setup,200),timeframe:t.timeframe,session:t.session,emotion:clip(t.emotion,200),
    entryReason:clip(t.entry_reason),exitReason:clip(t.exit_reason),notes:clip(t.notes),tags:(t.tags || []).slice(0,20).map(x=>clip(x,80))
  }));
}
export function validateReview(value, ids) {
  const text=(s)=>{if(typeof s!=='string'||!s.trim()||s.length>6000)throw new Error('Invalid AI response');return s;};
  const list=(v)=>{if(!Array.isArray(v)||v.length>12)throw new Error('Invalid AI response');return v.map(text);};
  if(!value || !Array.isArray(value.findings) || value.findings.length>12)throw new Error('Invalid AI response');
  return {summary:text(value.summary),strengths:list(value.strengths),actions:list(value.actions),limitations:list(value.limitations),findings:value.findings.map(f=>{
    if(!Array.isArray(f.trade_ids)||f.trade_ids.some(id=>!ids.has(id)))throw new Error('AI cited an unknown trade');
    return {title:text(f.title),detail:text(f.detail),trade_ids:f.trade_ids};
  })};
}
