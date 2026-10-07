const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = file => fs.readFileSync(path.join(root, 'src/js', file), 'utf8');
const row = {
  id:'history-1', ticker:'BTCUSDT', date:'2026-10-06', side:'Short', status:'closed',
  deposit:'10000', entry:'65000', exit:'64000', volume:'0.1', emotion:'Спокойствие',
  broker:'Binance', accountLabel:'Spot', strategy:'Breakout', setup:'Retest', timeframe:'H1',
  session:'London', stopLoss:'65500', takeProfit:'64000', plannedRiskPct:'0.5', plannedRR:'2',
  fees:'0', tags:['plan','review'], entryReason:'Retest held', exitReason:'Target reached',
  notes:'Wait for confirmation', screenshots:['existing-image.png']
};
const opened = [];
function create({draft,context,storedError=false,actualTrades=false,rows=[row]} = {}) {
  const dom = new JSDOM(html, {url:'https://journal.test',runScripts:'outside-only'});
  opened.push(dom); const w = dom.window;
  w.currentLang = 'en'; w.translations = {en:{emo_calm:'Calm',val_required:'Required',val_positive:'Positive'},ru:{emo_calm:'Спокойствие'}};
  w.document.querySelector('[data-i18n="emo_calm"]').textContent = 'Calm';
  w.trades = JSON.parse(JSON.stringify(rows)); w.fetchLivePrice = jest.fn(async () => 66000);
  w.clearValidationErrors = jest.fn();
  if(draft)w.localStorage.setItem('tk_trade_draft_v1',JSON.stringify(draft));
  if(context)w.localStorage.setItem('tk_trade_context_v1',JSON.stringify(context));
  if(storedError)w.Storage.prototype.setItem = () => {throw new Error('Quota exceeded')};
  if(actualTrades) {
    w.STORAGE_KEYS = {TRADES:'trades'}; w.db = {set:jest.fn(async()=>{}),get:jest.fn(async()=>null)};
    w.uid = () => 'new-trade'; w.alert = jest.fn(); w.renderFormScreenshots = jest.fn();
    w.setInterval = () => 0;
    w.TradingRiskGuard = {canAddTrade:jest.fn(async()=>({ok:true}))};
    w.eval(script('validation.js')+'\n'+script('trades.js')+'\n'+
      'trades = window.trades; renderAll = () => document.dispatchEvent(new Event("journal:trades-updated"));\n'+script('trade-autofill.js')+'\nwindow.getActualTrades = () => trades;');
  } else w.eval(script('trade-autofill.js'));
  const q = id => w.document.getElementById(id);
  const edit = (id,value) => {q(id).value=value;q(id).dispatchEvent(new w.Event('input',{bubbles:true}))};
  const flush = () => w.dispatchEvent(new w.Event('pagehide'));
  const fill = () => {q('autofillTrade').value=String(rows[0].id);q('autofillTrade').dispatchEvent(new w.Event('change'));q('autofillApply').click()};
  return {w,q,edit,flush,fill};
}
afterEach(()=>{opened.splice(0).forEach(dom=>dom.window.close());jest.restoreAllMocks()});

test('all 24 fields have stable names and labels; history suggestions cover numeric/text and close fields',()=>{
  const {q,w}=create();
  const fields=[...w.document.querySelectorAll('#add input[id^="f"],#add select[id^="f"],#add textarea[id^="f"]')];
  expect(fields).toHaveLength(24);
  fields.forEach(field=>{expect(field.name).toBeTruthy();expect(w.document.querySelector(`label[for="${field.id}"]`)).not.toBeNull()});
  expect(q('fFeesSuggestions').options[0].value).toBe('0');
  expect(q('fTickerSuggestions').options[0].value).toBe('BTCUSDT');
  expect(q('closeExitReason').getAttribute('list')).toBe('fExitReasonSuggestions');
  expect(q('autofillApply').disabled).toBe(true);
});
test('explicit template fills every trade value including localized emotion and zero fees, without adding a trade',()=>{
  const {q,w,fill}=create();fill();
  expect(q('fEntry').value).toBe(row.entry);expect(q('fExit').value).toBe(row.exit);
  expect(q('fFees').value).toBe('0');expect(q('fEmotion').value).toBe('Calm');
  expect(q('fDate').value).toBe(row.date);expect(q('fSide').value).toBe('Short');
  expect(q('fNotes').value).toBe(row.notes);expect(q('fTags').value).toBe('plan, review');
  expect(q('fPlannedRR').value).toBe('2');expect(q('fSession').value).toBe('London');
  expect(w.trades).toHaveLength(1);expect(q('ssPreviews').children).toHaveLength(0);
  expect(q('autofillState').textContent).toContain('Review');
});
test('reload restores a complete draft and clear fields persists the cleared state',()=>{
  const first=create();first.fill();first.edit('fNotes','My unfinished note');first.flush();
  const draft=JSON.parse(first.w.localStorage.getItem('tk_trade_draft_v1'));
  const second=create({draft});expect(second.q('fNotes').value).toBe('My unfinished note');expect(second.q('fEntry').value).toBe('65000');
  second.q('autofillClear').click();second.flush();
  const third=create({draft:JSON.parse(second.w.localStorage.getItem('tk_trade_draft_v1'))});
  expect(third.q('fEntry').value).toBe('');expect(third.q('fTicker').value).toBe('');expect(third.q('fDate').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
test('context never restores old execution prices, quantity or deposit',()=>{
  const {q}=create({context:{fBroker:'Binance',fStrategy:'Breakout',fEntry:'65000',fVolume:'3',fDeposit:'9000'}});
  expect(q('fBroker').value).toBe('Binance');expect(q('fStrategy').value).toBe('Breakout');
  ['fEntry','fVolume','fDeposit'].forEach(id=>expect(q(id).value).toBe(''));
});
test('note picker and hostile imported suggestions are treated as plain text',()=>{
  const {q,w}=create({rows:[{...row,ticker:'<img src=x onerror=alert(1)>',notes:'<script>bad()</script>'}]});
  expect(q('fTickerSuggestions').querySelector('img')).toBeNull();
  q('autofillNotes').value='0';q('autofillNotes').dispatchEvent(new w.Event('change'));
  expect(q('fNotes').value).toBe('<script>bad()</script>');
});
test('draft storage failure leaves form usable and reports the failure',()=>{
  const {edit,flush,q}=create({storedError:true});edit('fTicker','ETHUSDT');flush();
  expect(q('fTicker').value).toBe('ETHUSDT');expect(q('autofillState').textContent).toContain('unavailable');
});
test('late history updates refresh suggestions without overwriting user edits',()=>{
  const {w,q,edit}=create({rows:[]});edit('fTicker','MYVALUE');w.trades.push(row);
  w.document.dispatchEvent(new w.Event('journal:trades-updated'));
  expect(q('fTicker').value).toBe('MYVALUE');expect(q('fTickerSuggestions').options.length).toBe(1);
});
test('real Add handler keeps validation and prop guard; clears draft only after an accepted add',async()=>{
  const {w,q,edit,flush,fill}=create({actualTrades:true});
  edit('fTicker','');flush();q('btnAdd').click();await Promise.resolve();
  expect(w.TradingRiskGuard.canAddTrade).not.toHaveBeenCalled();expect(w.localStorage.getItem('tk_trade_draft_v1')).not.toBeNull();
  fill();w.TradingRiskGuard.canAddTrade.mockResolvedValue({ok:false,reason:'Stop day'});
  q('btnAdd').click();await new Promise(resolve=>setImmediate(resolve));
  expect(w.getActualTrades()).toHaveLength(1);expect(q('fEntry').value).toBe('65000');
  expect(w.localStorage.getItem('tk_trade_draft_v1')).not.toBeNull();
  w.TradingRiskGuard.canAddTrade.mockResolvedValue({ok:true});q('btnAdd').click();await new Promise(resolve=>setImmediate(resolve));
  expect(w.getActualTrades()).toHaveLength(2);expect(q('fEntry').value).toBe('');expect(q('fStrategy').value).toBe('Breakout');
  flush();expect(w.localStorage.getItem('tk_trade_draft_v1')).toBeNull();
});

test('a failed local save preserves the draft and does not leave a duplicate trade',async()=>{
  const {w,q,fill,flush}=create({actualTrades:true});fill();flush();
  w.db.set.mockRejectedValue(new Error('Storage full'));
  const log=jest.spyOn(w.console,'error').mockImplementation(()=>{});
  q('btnAdd').click();await new Promise(resolve=>setImmediate(resolve));
  expect(w.getActualTrades()).toHaveLength(1);expect(q('fEntry').value).toBe('65000');
  expect(w.localStorage.getItem('tk_trade_draft_v1')).not.toBeNull();log.mockRestore();
});

test('late price responses cannot overwrite the hint for a different ticker; chosen quote enters the draft',async()=>{
  const {w,q,edit,flush}=create({actualTrades:true});let finishOld;
  w.fetchLivePrice.mockImplementation(symbol=>symbol==='BTCUSDT'?new Promise(resolve=>{finishOld=resolve}):Promise.resolve(2400));
  edit('fTicker','BTCUSDT');await new Promise(resolve=>setTimeout(resolve,450));
  edit('fTicker','ETHUSDT');await new Promise(resolve=>setTimeout(resolve,450));
  finishOld(65000);await Promise.resolve();
  q('livePriceHint').click();flush();
  expect(q('fEntry').value).toBe('2400');
  expect(JSON.parse(w.localStorage.getItem('tk_trade_draft_v1')).fields.fEntry).toBe('2400');
});
