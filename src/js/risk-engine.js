/* Pure pre-trade estimation. No broker access or order execution. */
(function(root){
 'use strict';
 function calculate(p){
  const fail=code=>({ok:false,code});
  const required=['balance','equity','riskPct','entry','stop','target','tickSize','tickValue','step','minQty','maxQty','dailyFloor','totalFloor','openRisk','portfolioPct','reserve','cost','slippageTicks','marginPerUnit','freeMargin','unitNotional','minNotional'];
  if(required.some(k=>typeof p[k]!=='number'||!Number.isFinite(p[k])))return fail('missing');
  if(!['long','short'].includes(p.side)||!['balance','equity','conservative'].includes(p.basis))return fail('missing');
  if(['balance','equity','riskPct','entry','stop','target','tickSize','tickValue','step','minQty','maxQty','portfolioPct','marginPerUnit','unitNotional'].some(k=>p[k]<=0)||['dailyFloor','totalFloor','openRisk','reserve','cost','slippageTicks','freeMargin','minNotional'].some(k=>p[k]<0)||p.riskPct>100||p.portfolioPct>100||p.maxQty<p.minQty)return fail('invalid');
  if(p.side==='long'?(p.stop>=p.entry||p.target<=p.entry):(p.stop<=p.entry||p.target>=p.entry))return fail('direction');
  const onTick=v=>Math.abs(v/p.tickSize-Math.round(v/p.tickSize))<1e-5;
  if(![p.entry,p.stop,p.target].every(onTick))return fail('tick');
  const base=p.basis==='balance'?p.balance:p.basis==='equity'?p.equity:Math.min(p.balance,p.equity);
  // openRisk is additional loss from CURRENT equity to all existing stops, not original entry risk.
  const requested=base*p.riskPct/100;
  const dailyRoom=p.equity-p.dailyFloor-p.openRisk-p.reserve;
  const totalRoom=p.equity-p.totalFloor-p.openRisk-p.reserve;
  const portfolioRoom=base*p.portfolioPct/100-p.openRisk;
  const budget=Math.min(requested,dailyRoom,totalRoom,portfolioRoom);
  if(budget<=0)return fail('limit');
  const perUnit=Math.abs(p.entry-p.stop)/p.tickSize*p.tickValue+p.cost+p.slippageTicks*p.tickValue;
  const rewardPerUnit=Math.abs(p.target-p.entry)/p.tickSize*p.tickValue-p.cost-p.slippageTicks*p.tickValue;
  const raw=Math.min(budget/perUnit,p.freeMargin/p.marginPerUnit,p.maxQty);
  let units=Math.floor(raw/p.step)*p.step;
  units=Number(units.toPrecision(12));
  // Floating-point rounding must never create an over-budget position.
  if(units*perUnit>budget+1e-8||units*p.marginPerUnit>p.freeMargin+1e-8)units=Number((units-p.step).toPrecision(12));
  if(!Number.isFinite(units)||units<p.minQty||units<=0||units*p.unitNotional<p.minNotional)return fail('minimum');
  const risk=units*perUnit,reward=units*rewardPerUnit,margin=units*p.marginPerUnit;
  if(![risk,reward,margin,units*p.unitNotional].every(Number.isFinite))return fail('invalid');
  return {ok:true,base,requested,budget,dailyRoom,totalRoom,portfolioRoom,units,risk,reward,rr:reward/risk,margin,notional:units*p.unitNotional,limited:budget<requested||raw<budget/perUnit};
 }
 const api={calculate};if(typeof module==='object'&&module.exports)module.exports=api;else root.TradingRiskEngine=api;
})(typeof window==='object'?window:globalThis);
