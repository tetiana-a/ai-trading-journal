const I=require('../src/js/trade-insights.js');
const base={status:'closed',side:'Long',ticker:'EURUSD',date:'2026-10-06'};
const mt5=(o)=>({...base,entry:'1.17',exit:'1.174',stopLoss:'1.168',volume:'0.25',realizedPnl:'98.5',riskMoney:50,...o});

test('R: broker money over broker risk, the price ratio without it, and nothing when the stop is unusable',()=>{
 expect(I.rOf(mt5())).toBeCloseTo(1.97,2);                                   // 98.5 / 50, costs included
 expect(I.rOf(mt5({riskMoney:''}))).toBeCloseTo(2,6);                        // 40 pips won over a 20 pip stop
 expect(I.rOf(mt5({riskMoney:'',side:'Short',entry:'1.17',exit:'1.166',stopLoss:'1.172',realizedPnl:'99'}))).toBeCloseTo(2,6);
 expect(I.rOf(mt5({riskMoney:'',exit:'1.168',realizedPnl:'-50'}))).toBeCloseTo(-1,6);
 // A stop already moved above entry is not the initial risk; fall back to the planned risk in percent.
 expect(I.rOf(mt5({riskMoney:'',stopLoss:'1.171',deposit:'10000',plannedRiskPct:'0.5'}))).toBeCloseTo(1.97,2);
 expect(I.rOf(mt5({riskMoney:'',stopLoss:'1.171'}))).toBeNull();
 expect(I.rOf(mt5({riskMoney:'',stopLoss:''}))).toBeNull();
 expect(I.rOf(mt5({status:'open'}))).toBeNull();
 // Crypto entered by hand: no broker result, the price ratio still works.
 expect(I.rOf({status:'closed',side:'Long',ticker:'BTCUSDT',entry:'60000',exit:'63000',stopLoss:'59000',volume:'0.05'})).toBeCloseTo(3,6);
 expect(I.resultOf({status:'closed',side:'Long',ticker:'BTCUSDT',entry:'60000',exit:'63000',volume:'0.05',fees:'5'})).toBeCloseTo(145,6);
 expect(I.resultOf({status:'closed',side:'Long',ticker:'EURUSD',entry:'1.17',exit:'1.174',volume:'0.25'})).toBeNull();   // lots are not money
 expect(I.riskOf({ticker:'BTCUSDT',side:'Long',entry:'60000',stopLoss:'59000',volume:'0.05'})).toBeCloseTo(50,6);
});

test('MAE and MFE are expressed in R and need the risk reported at entry',()=>{
 const x=I.excursionOf(mt5({mae:30,mfe:110}));expect(x.mae).toBeCloseTo(-0.6,6);expect(x.mfe).toBeCloseTo(2.2,6);
 expect(I.excursionOf(mt5({mae:30,mfe:110,riskMoney:''}))).toBeNull();expect(I.excursionOf(mt5())).toBeNull();
});

test('breakdowns group closed trades and keep unknown results out of the averages',()=>{
 const list=[
  mt5({openedAt:'2026-10-05T07:15:00.000Z',date:'2026-10-05',setup:'Breakout',session:'London'}),                       // Monday 09:15 Prague, +1.97R
  mt5({openedAt:'2026-10-05T07:40:00.000Z',date:'2026-10-05',setup:'Breakout',session:'London',realizedPnl:'-50',exit:'1.168'}),   // −1R
  mt5({openedAt:'2026-10-07T13:05:00.000Z',date:'2026-10-07',setup:'Sweep',session:'New York',realizedPnl:'150'}),          // Wednesday 15:05, +3R
  mt5({date:'2026-10-08',setup:'',riskMoney:'',stopLoss:'',realizedPnl:'20'}),                                             // no stop: money only
  mt5({status:'open',date:'2026-10-08',setup:'Sweep'})
 ];
 const days=I.breakdown(list,'weekday');expect(days.map(r=>r.key)).toEqual([1,3,4]);
 expect(days[0].trades).toBe(2);expect(days[0].winRate).toBe(0.5);expect(days[0].totalR).toBeCloseTo(0.97,2);expect(days[0].avgR).toBeCloseTo(0.485,3);expect(days[0].pnl).toBeCloseTo(48.5,6);
 expect(days[2].rCount).toBe(0);expect(days[2].avgR).toBeNull();expect(days[2].pnl).toBe(20);expect(days[2].winRate).toBe(1);
 expect(I.breakdown(list,'hour').map(r=>r.key)).toEqual([9,15,'']);       // the trade without an entry time goes last
 const setups=I.breakdown(list,'setup');expect(setups.map(r=>r.key)).toEqual(['Sweep','Breakout','']);expect(setups[0].totalR).toBeCloseTo(3,6);
 const s=I.summary(list);expect(s.trades).toBe(4);expect(s.open).toBe(1);expect(s.rCount).toBe(3);expect(s.totalR).toBeCloseTo(3.97,2);expect(s.winRate).toBe(0.75);expect(s.pnl).toBeCloseTo(218.5,6);
});

test('the cost of mistakes: plan, each mistake and unrated trades are separated; two mistakes count twice',()=>{
 const list=[
  mt5({marks:['plan']}),mt5({marks:['plan'],realizedPnl:'100'}),
  mt5({marks:['fomo'],realizedPnl:'-50',exit:'1.168'}),
  mt5({marks:['fomo','moved_stop'],realizedPnl:'-75',exit:'1.167'}),
  mt5({marks:[]}),mt5({status:'open',marks:['fomo']})
 ];
 const rows=I.markCost(list);expect(rows.map(r=>r.key)).toEqual(['plan','fomo','moved_stop','unrated']);
 expect(rows[0].trades).toBe(2);expect(rows[0].totalR).toBeCloseTo(3.97,2);expect(rows[0].winRate).toBe(1);
 expect(rows[1].trades).toBe(2);expect(rows[1].totalR).toBeCloseTo(-2.5,6);expect(rows[1].winRate).toBe(0);
 expect(rows[2].trades).toBe(1);expect(rows[2].totalR).toBeCloseTo(-1.5,6);expect(rows[3].trades).toBe(1);
 const s=I.summary(list);expect(s.rated).toBe(4);expect(s.planned).toBe(2);expect(s.planRate).toBe(0.5);
});

test('checklist: full, partial and not recorded; skipped items are ranked by what they cost',()=>{
 const list=[
  mt5({checklist:{done:['trend','level'],missed:[]}}),
  mt5({checklist:{done:['trend'],missed:['level']},realizedPnl:'-50',exit:'1.168'}),
  mt5({checklist:{done:['level'],missed:['trend','news']},realizedPnl:'-25',exit:'1.169'}),
  mt5({checklist:null}),mt5({})
 ];
 const c=I.checklistStats(list);expect(c.full.trades).toBe(1);expect(c.partial.trades).toBe(2);expect(c.none.trades).toBe(2);
 expect(c.partial.totalR).toBeCloseTo(-1.5,6);expect(c.items.map(i=>i.key)).toEqual(['level','trend','news']);expect(c.items[0].totalR).toBeCloseTo(-1,6);
});

test('unfinished trades: no setup, or a closed trade whose execution is not rated; open positions come first',()=>{
 expect(I.isIncomplete(mt5({setup:'',marks:['plan']}))).toBe(true);
 expect(I.isIncomplete(mt5({setup:'Sweep',marks:[]}))).toBe(true);
 expect(I.isIncomplete(mt5({setup:'Sweep',marks:['fomo']}))).toBe(false);
 expect(I.isIncomplete(mt5({status:'open',setup:'Sweep'}))).toBe(false);     // nothing to rate until it closes
 const list=[mt5({id:'a',date:'2026-10-05'}),mt5({id:'b',date:'2026-10-07'}),mt5({id:'c',status:'open',date:'2026-10-01'}),mt5({id:'d',setup:'x',marks:['plan']})];
 expect(I.incomplete(list).map(t=>t.id)).toEqual(['c','b','a']);
});

test('weekly review: Monday to Sunday, best and worst setup, the most expensive mistake, best and worst day',()=>{
 const list=[
  mt5({date:'2026-10-05',setup:'Breakout',marks:['plan'],realizedPnl:'100'}),                       // Mon +2R
  mt5({date:'2026-10-06',setup:'Sweep',marks:['fomo'],realizedPnl:'-50',exit:'1.168'}),              // Tue −1R
  mt5({date:'2026-10-06',setup:'Sweep',marks:['fomo','revenge'],realizedPnl:'-60',exit:'1.168'}),    // Tue −1.2R
  mt5({date:'2026-10-11',setup:'Breakout',marks:[],realizedPnl:'25'}),                               // Sun +0.5R, unrated
  mt5({date:'2026-10-12',setup:'Breakout',realizedPnl:'500'}),                                       // next week
  mt5({date:'2026-10-04',setup:'Sweep',realizedPnl:'-500',exit:'1.16'})                              // previous week
 ];
 expect(I.weekStart('2026-10-08')).toBe('2026-10-05');expect(I.weekStart('2026-10-11')).toBe('2026-10-05');expect(I.weekStart('2026-10-12')).toBe('2026-10-12');
 const w=I.weekReview(list,'2026-10-08');expect(w.from).toBe('2026-10-05');expect(w.to).toBe('2026-10-11');
 expect(w.summary.trades).toBe(4);expect(w.summary.totalR).toBeCloseTo(0.3,6);expect(w.summary.pnl).toBeCloseTo(15,6);expect(w.summary.planRate).toBeCloseTo(1/3,6);
 expect(w.bestSetup.key).toBe('Breakout');expect(w.worstSetup.key).toBe('Sweep');expect(w.topMistake.key).toBe('fomo');expect(w.topMistake.totalR).toBeCloseTo(-2.2,6);
 expect(w.bestDay.date).toBe('2026-10-05');expect(w.worstDay.date).toBe('2026-10-06');expect(w.incomplete).toBe(1);expect(w.days).toHaveLength(7);
 const empty=I.weekReview(list,'2026-09-21');expect(empty.summary.trades).toBe(0);expect(empty.bestSetup).toBeNull();expect(empty.topMistake).toBeNull();
 // One setup only: it is the best, and nothing is called the worst.
 expect(I.weekReview(list,'2026-10-12').worstSetup).toBeNull();
});

test('recent() keeps the last N Prague days including today',()=>{
 const list=[mt5({date:'2026-10-10'}),mt5({date:'2026-10-04'}),mt5({date:'2026-10-03'})];
 const now=new Date('2026-10-10T20:00:00Z');
 expect(I.recent(list,7,now)).toHaveLength(2);expect(I.recent(list,0,now)).toHaveLength(3);expect(I.recent(list,1,now)).toHaveLength(1);
});
