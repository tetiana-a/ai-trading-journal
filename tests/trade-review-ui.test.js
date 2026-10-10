const fs=require('fs'),{JSDOM}=require('jsdom');
const code=f=>fs.readFileSync('src/js/'+f,'utf8');
const doms=[];afterEach(()=>doms.splice(0).forEach(d=>d.window.close()));
const tick=()=>new Promise(r=>setImmediate(r));
const FORM='<select id="langSelect"><option value="ru">RU</option><option value="en">EN</option></select>'
 +'<section id="add"><div class="form-card"><div id="playbookBar"></div><details class="advanced-trade"></details>'
 +'<input id="fStrategy"><input id="fSetup"><select id="fTimeframe"><option value="">—</option><option>M5</option><option>M15</option></select><select id="fSession"><option value="">—</option><option>London</option></select>'
 +'<input id="fEntryReason"><input id="fTags"><input id="fPlannedRisk"><input id="fPlannedRR"><select id="fEmotion"><option>Спокойствие</option><option>FOMO</option></select>'
 +'<div id="tradeExtras"></div></div></section>'
 +'<section id="trades"><div class="sec-head"></div><table><tbody id="openTradesBody"></tbody><tbody id="closedTradesBody"></tbody></table></section>'
 +'<section id="insights"><h2 id="insightsTitle"></h2><div id="insightsPeriod"></div><div id="insightsBody"></div></section><section id="weekReview"><h2 id="weekReviewTitle"></h2><div id="weekReviewBody"></div></section>';
function page({lang='ru',trades=[],cloud=null,stored=null}={}){
 const dom=new JSDOM('<html lang="ru"><body>'+FORM+'</body></html>',{url:'https://example.com/',runScripts:'outside-only'}),w=dom.window;doms.push(dom);
 if(stored)w.localStorage.setItem('tk_journal_settings_v1',JSON.stringify(stored));
 if(cloud)w.TradingCloud=cloud;
 w.eval('var currentLang='+JSON.stringify(lang)+';var translations={ru:{lbl_setup:"Сетап",lbl_strategy:"Стратегия"},en:{}};var trades='+JSON.stringify(trades)+';var saved=[];var renders=0;'
  +'async function saveTrades(list){saved.push(JSON.parse(JSON.stringify(list)));return true;}function renderAll(){renders++;document.dispatchEvent(new Event("journal:trades-updated"));}'
  +'function fmtMoney(n){return String(n);}');
 for(const f of ['trade-insights.js','journal-settings.js','trade-extras.js','trade-notes.js','insights-panel.js'])w.eval(code(f));
 return {dom,w,doc:w.document,S:w.JournalSettings};}
const press=el=>el.getAttribute('aria-pressed')==='true';

test('lists: built-in entries keep their id in every language, custom ones get a stable id, removed names stay readable',()=>{
 const {w,S}=page();
 expect(S.marks().map(m=>m.id)).toContain('fomo');expect(S.marks().some(m=>m.id==='plan')).toBe(false);expect(S.markLabel('plan')).toBe('По плану');expect(S.checklist()).toHaveLength(6);
 S.listFromText('marks','FOMO\n  Перенос стопа \nMoved the stop\nВход на эмоциях\n\nвход на эмоциях');
 const marks=S.marks();expect(marks.map(m=>m.id).slice(0,2)).toEqual(['fomo','moved_stop']);expect(marks).toHaveLength(3);expect(marks[2].label).toBe('Вход на эмоциях');expect(marks[2].id).toMatch(/^m_/);
 const custom=marks[2].id;
 w.eval('currentLang="en"');expect(S.marks()[1].label).toBe('Moved the stop');expect(S.markLabel('revenge')).toBe('Revenge trade');expect(S.markLabel(custom)).toBe('Вход на эмоциях');
 S.listFromText('marks','FOMO');expect(S.marks()).toHaveLength(1);expect(S.markLabel(custom)).toBe('Вход на эмоциях');          // an old trade still shows the name
 S.listFromText('checklist','Higher timeframe agrees\nSpread is normal');expect(S.checklist().map(c=>c.id)[0]).toBe('trend');expect(S.checklist()[1].id).toMatch(/^c_/);
 expect(JSON.parse(w.localStorage.getItem('tk_journal_settings_v1')).marks).toEqual([{id:'fomo'}]);
});

test('templates: a chip fills the form fields, a new one is saved from the fields, and one can be removed',()=>{
 const {w,doc,S}=page();const $=id=>doc.getElementById(id),bar=doc.querySelector('#playbookBar .playbook-bar');
 expect(bar.querySelectorAll('[data-playbook]')).toHaveLength(3);
 let heard=0;$('fSetup').addEventListener('input',()=>heard++);
 bar.querySelector('[data-playbook=pb_sweep]').click();
 expect($('fStrategy').value).toBe('Liquidity Sweep');expect($('fSetup').value).toBe('Sweep + CHOCH + retest');expect($('fTimeframe').value).toBe('M5');
 expect($('fSession').value).toBe('New York');expect($('fSession').options).toHaveLength(3);          // the missing option was added
 expect($('fTags').value).toBe('sweep');expect($('fPlannedRR').value).toBe('2');expect($('fEntryReason').value).toContain('ликвидности');expect(heard).toBe(1);
 expect(doc.querySelector('details.advanced-trade').open).toBe(true);expect(press(bar.querySelector('[data-playbook=pb_sweep]'))).toBe(true);
 expect(w.TradeExtras.form.read().playbook).toBe('Sweep + CHOCH · New York');
 // Save the current fields under a new name.
 $('fSetup').value='London open fade';$('fStrategy').value='Fade';$('fTags').value='fade, A+';
 bar.querySelector('[data-playbook-action=name]').click();const name=bar.querySelector('.playbook-name');name.value='Fade London';
 bar.querySelector('[data-playbook-action=save]').click();
 const list=S.playbooks();expect(list).toHaveLength(4);expect(list[3]).toMatchObject({name:'Fade London',setup:'London open fade',strategy:'Fade',tags:['fade','A+']});
 bar.querySelector('[data-playbook-action=manage]').click();bar.querySelector('[data-remove-playbook=pb_breakout]').click();expect(S.playbooks().map(p=>p.id)).not.toContain('pb_breakout');
 // Nothing to save from empty fields.
 $('fSetup').value='';$('fStrategy').value='';bar.querySelector('[data-playbook-action=manage]').click();bar.querySelector('[data-playbook-action=name]').click();bar.querySelector('[data-playbook-action=save]').click();
 expect(S.playbooks()).toHaveLength(3);expect(bar.querySelector('.playbook-note').textContent).toContain('Сначала');
});

test('checklist and marks: "by the plan" and a mistake exclude each other; an untouched checklist is not recorded',()=>{
 const {w,doc}=page();const box=doc.querySelector('#tradeExtras .trade-extras'),form=w.TradeExtras.form;
 expect(form.read()).toEqual({marks:[],checklist:null,playbook:''});
 const mark=id=>box.querySelector('[data-mark='+id+']');
 mark('fomo').click();mark('moved_stop').click();expect(form.read().marks).toEqual(['fomo','moved_stop']);
 mark('plan').click();expect(form.read().marks).toEqual(['plan']);expect(press(mark('fomo'))).toBe(false);
 mark('revenge').click();expect(form.read().marks).toEqual(['revenge']);expect(press(mark('plan'))).toBe(false);
 mark('revenge').click();expect(form.read().marks).toEqual([]);
 const tickBox=id=>{const c=box.querySelector('[data-check='+id+']');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));};
 tickBox('trend');tickBox('risk');expect(box.querySelector('.extras-score').textContent).toBe('2/6');
 expect(form.read().checklist).toEqual({done:['trend','risk'],missed:['level','confirm','target','news']});
 doc.dispatchEvent(new w.CustomEvent('journal:trade-added'));expect(form.read()).toEqual({marks:[],checklist:null,playbook:''});
});

test('unfinished queue: counts trades, walks through them, saves marks and checklist, and Enter saves',async()=>{
 const trades=[
  {id:'a',ticker:'EURUSD',side:'Long',status:'closed',date:'2026-10-05',setup:'',marks:[],tags:['mt5']},
  {id:'b',ticker:'GBPUSD',side:'Short',status:'closed',date:'2026-10-07',setup:'Sweep',marks:[],tags:[]},
  {id:'c',ticker:'XAUUSD',side:'Long',status:'open',date:'2026-10-08',setup:'',marks:[],tags:[]},
  {id:'d',ticker:'US30',side:'Long',status:'closed',date:'2026-10-08',setup:'Breakout',marks:['plan'],tags:[]}];
 const {w,doc}=page({trades});const bar=doc.getElementById('todoBar'),modal=doc.getElementById('tradeNotesModal');
 expect(bar.hidden).toBe(false);expect(bar.querySelector('b').textContent).toBe('3');
 doc.getElementById('todoStart').click();
 expect(modal.classList.contains('show')).toBe(true);expect(doc.getElementById('tradeNotesTitle').textContent).toContain('XAUUSD');          // the open position first
 expect(doc.getElementById('tradeNotesQueue').textContent).toBe('Незаполненные: 1 из 3');expect(doc.getElementById('tradeNotesSave').textContent).toBe('Сохранить и дальше');
 modal.querySelector('[data-playbook=pb_pullback]').click();expect(modal.querySelector('#tradeNotes_setup').value).toBe('Pullback to zone');
 const c=modal.querySelector('[data-check=trend]');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));
 modal.querySelector('#tradeNotes_setup').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await tick();
 const first=w.eval('saved')[0][0];expect(first.id).toBe('c');expect(first.setup).toBe('Pullback to zone');expect(first.strategy).toBe('Trend pullback');expect(first.checklist.done).toEqual(['trend']);expect(first.playbook).toBe('Откат по тренду');
 expect(doc.getElementById('tradeNotesTitle').textContent).toContain('GBPUSD');expect(doc.getElementById('tradeNotesQueue').textContent).toBe('Незаполненные: 2 из 3');
 expect(modal.querySelector('[data-check=trend]').checked).toBe(false);          // the next trade starts clean
 doc.getElementById('tradeNotesSkip').click();expect(doc.getElementById('tradeNotesTitle').textContent).toContain('EURUSD');expect(w.eval('saved')).toHaveLength(1);
 modal.querySelector('#tradeNotes_setup').value='Breakout';modal.querySelector('[data-mark=fomo]').click();modal.querySelector('[data-mark=early_exit]').click();
 doc.getElementById('tradeNotesSave').click();await tick();
 expect(w.eval('saved')[1][0]).toMatchObject({id:'a',setup:'Breakout',marks:['fomo','early_exit'],tags:['mt5']});
 expect(modal.classList.contains('show')).toBe(false);expect(bar.querySelector('b').textContent).toBe('1');          // only the skipped one is left
 // A single trade opens outside the queue and shows what is already stored.
 w.TradeNotes.open('a');expect(doc.getElementById('tradeNotesQueue').hidden).toBe(true);expect(doc.getElementById('tradeNotesSave').textContent).toBe('Сохранить');
 expect([...modal.querySelectorAll('[data-mark][aria-pressed=true]')].map(b=>b.dataset.mark)).toEqual(['fomo','early_exit']);
});

test('breakdowns and the weekly review are rendered from the journal and follow the language',async()=>{
 const t=(o)=>({status:'closed',side:'Long',ticker:'EURUSD',entry:'1.17',exit:'1.174',stopLoss:'1.168',volume:'0.25',realizedPnl:'100',riskMoney:50,setup:'Breakout',...o});
 const monday=require('../src/js/trade-insights.js').weekStart(new Date().toISOString().slice(0,10));
 const trades=[t({id:'1',date:monday,marks:['plan'],openedAt:monday+'T07:15:00.000Z'}),t({id:'2',date:monday,marks:['fomo'],setup:'Sweep',realizedPnl:'-50',exit:'1.168',checklist:{done:['trend'],missed:['news']}})];
 const {w,doc,S}=page({trades});const text=el=>el.textContent.replace(/\s+/g,' ');
 const body=doc.getElementById('insightsBody');expect(doc.getElementById('insightsTitle').textContent).toBe('Разрезы и ошибки');
 expect(text(body.querySelector('.insight-kpis'))).toContain('+1.00R');expect(text(body.querySelector('.insight-kpis'))).toContain('50%');
 const tables=body.querySelectorAll('table');expect(tables).toHaveLength(4);
 expect(text(tables[0])).toContain('Понедельник');expect(text(tables[1])).toContain('По плану');expect(text(tables[1])).toContain('FOMO');expect(text(tables[1])).toContain('−1.00R');
 expect(text(tables[3])).toContain('Нет важных новостей');expect(tables[1].querySelector('.r-bar i.neg').style.width).toBe('25%');
 body.querySelector('[data-dimension=setup]').click();expect(text(doc.querySelector('#insightsBody table'))).toContain('Sweep');expect(JSON.parse(w.localStorage.getItem('tk_insights_view')).dimension).toBe('setup');
 const week=doc.getElementById('weekReviewBody');expect(text(week)).toContain('Лучший сетап');expect(text(week.querySelector('.week-facts'))).toContain('Breakout');expect(text(week.querySelector('.week-facts'))).toContain('FOMO');
 const rule=doc.getElementById('weekRuleInput');rule.value='Не вхожу без подтверждения';rule.dispatchEvent(new w.Event('blur'));
 const next=w.TradeInsights.shiftDay(monday,7);expect(S.weekRule(next)).toBe('Не вхожу без подтверждения');
 w.InsightsPanel.setWeek(next);expect(text(week.querySelector('.week-rule'))).toContain('Не вхожу без подтверждения');expect(text(week)).toContain('За эту неделю сделок нет');
 expect(w.InsightsPanel.weekText()).toContain('Правило этой недели: Не вхожу без подтверждения');
 w.eval('currentLang="en"');doc.getElementById('langSelect').dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,5));
 expect(doc.getElementById('weekReviewTitle').textContent).toBe('Weekly review');expect(text(doc.getElementById('insightsBody'))).toContain('The cost of mistakes');
});

test('settings travel through the cloud: a newer remote copy replaces the local one, a newer local copy is pushed',async()=>{
 const remote={version:1,updatedAt:'2026-10-09T10:00:00.000Z',marks:[{id:'fomo'}],playbooks:[{id:'pb_x',name:'Remote one',setup:'X'}]};
 const cloud={session:async()=>({user:{id:'u'}}),loadSettings:jest.fn(async()=>remote),saveSettings:jest.fn(async()=>{})};
 const a=page({cloud,stored:{version:1,updatedAt:'2026-10-01T10:00:00.000Z',marks:[{id:'revenge'}]}});
 expect(a.S.marks().map(m=>m.id)).toEqual(['revenge']);
 await a.S.pull();expect(a.S.marks().map(m=>m.id)).toEqual(['fomo']);expect(a.S.playbooks()[0].name).toBe('Remote one');expect(cloud.saveSettings).not.toHaveBeenCalled();
 const b=page({cloud,stored:{version:1,updatedAt:'2026-10-10T10:00:00.000Z',marks:[{id:'revenge'}]}});
 await b.S.pull();expect(b.S.marks().map(m=>m.id)).toEqual(['revenge']);expect(cloud.saveSettings).toHaveBeenCalledTimes(1);expect(cloud.saveSettings.mock.calls[0][0].marks).toEqual([{id:'revenge'}]);
 // Signed out: nothing is read or written, and the local lists keep working.
 const off={session:async()=>null,loadSettings:jest.fn(),saveSettings:jest.fn()};const c=page({cloud:off});await c.S.pull();c.S.setWeekRule('2026-10-12','x');
 expect(off.loadSettings).not.toHaveBeenCalled();expect(c.S.weekRule('2026-10-12')).toBe('x');
});

test('cloud row: review details are packed into one column and empty ones are left out',async()=>{
 const dom=new JSDOM('',{url:'https://journal.test',runScripts:'outside-only'});doms.push(dom);const w=dom.window;
 const upsert=jest.fn(input=>({select:jest.fn(async()=>({data:input.map(t=>({external_id:t.external_id})),error:null}))}));
 w.TradingCloud={client:{from:()=>({upsert}),storage:{from:()=>({})}},session:async()=>({user:{id:'owner'}})};
 w.eval(code('cloud-tools.js'));
 await w.TradingCloud.pushTrades([{id:'one',marks:['fomo'],checklist:{done:['trend'],missed:['news']},riskMoney:50,mae:'30',mfe:110,playbook:'Sweep',shots:['open']},{id:'two',marks:[],checklist:null,riskMoney:'',mae:'',mfe:''}]);
 const rows=upsert.mock.calls[0][0];
 expect(rows[0].details).toEqual({marks:['fomo'],checklist:{done:['trend'],missed:['news']},riskMoney:50,mae:30,mfe:110,playbook:'Sweep',shots:['open']});expect(rows[1].details).toEqual({});
});
