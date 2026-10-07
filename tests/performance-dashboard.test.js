const fs=require('fs');
const {summarize,outcome,group}=require('../src/js/performance-dashboard');
const {JSDOM}=require('jsdom');
const now=new Date('2026-10-07T12:00:00Z');
const trade=(pnl,date='2026-10-07')=>({status:'closed',realizedPnl:pnl,date});
test('dashboard calculates daily cumulative PNL and end-of-day drawdown without rounding distortion',()=>{
 const m=summarize([trade(100,'2026-10-01'),trade(-40,'2026-10-02'),trade(20,'2026-10-03'),trade(0)],0,now);
 expect(m.total).toBe(80);expect(m.drawdown).toBe(40);expect(m.winRate).toBe(.5);expect(m.pf).toBe(3);expect(m.expectancy).toBe(20);
});
test('dashboard excludes unknown results, open trades and undated records; counts zero',()=>{
 const m=summarize([trade(0),{status:'closed',date:'2026-10-07'},trade(5,''),{status:'open'}],0,now);
 expect(m.count).toBe(1);expect(m.unknown).toBe(1);expect(m.missingDate).toBe(1);expect(m.open).toBe(1);expect(m.pf).toBeNull();
});
test('rolling calendar period uses close date and Prague midnight, without future data',()=>{
 const m=summarize([trade(9,'2026-09-30'),trade(4,'2026-10-01'),{...trade(3,'2026-09-01'),closedAt:'2026-10-06T23:30:00Z'},trade(88,'2026-10-08')],7,now);
 expect(m.total).toBe(7);expect(m.points.at(-1).date).toBe('2026-10-07');
});
test('broker net PNL is not charged twice; lot contracts are not guessed; groups separate currency/account',()=>{
 expect(outcome({...trade(40),fees:8})).toBe(40);
 expect(outcome({status:'closed',broker:'MT5',entry:1,exit:2,volume:1,ticker:'BTCUSDT',side:'Long'})).toBeNull();
 expect(group({ticker:'BTCUSDT'})).not.toBe(group({ticker:'BTCUSDC'}));
 expect(group({accountLabel:'A'})).not.toBe(group({accountLabel:'B'}));
});
test('dashboard renders four languages, handles filters, account isolation and escapes external labels',()=>{
 const dom=new JSDOM('<div id="performanceDashboard"></div>',{runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync('src/js/performance-dashboard.js','utf8'));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const rows=[{...trade(30,today),accountLabel:'<img src=x onerror=alert(1)>'},{...trade(-12,today),accountLabel:'B'}];
 for(const lang of ['ru','uk','en','cs']){
   w.PerformanceDashboard.render(rows,lang);expect(w.document.querySelector('svg')).not.toBeNull();expect(w.document.querySelector('img')).toBeNull();
   expect(w.document.querySelector('.pd-kpi strong').textContent).toBe('30');
   w.document.querySelector('[data-mode="dd"]').click();expect(w.document.querySelector('[data-mode="dd"]').getAttribute('aria-pressed')).toBe('true');
   w.document.querySelector('[data-days="30"]').click();expect(w.document.querySelector('[data-days="30"]').getAttribute('aria-pressed')).toBe('true');
 }
 const select=w.document.querySelector('#pdAccount');select.value='1';select.dispatchEvent(new w.Event('change'));expect(w.document.querySelector('.pd-kpi strong').textContent).toBe('-12');
 w.PerformanceDashboard.render([], 'en');expect(w.document.querySelector('.pd-empty')).not.toBeNull();expect(w.document.querySelector('svg')).toBeNull();dom.window.close();
});
