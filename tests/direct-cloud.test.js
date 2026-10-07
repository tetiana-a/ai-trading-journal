const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');
const root = path.join(__dirname, '..');
const code = f => fs.readFileSync(path.join(root,'src/js',f),'utf8');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const doms=[];
const flush=()=>new Promise(r=>setImmediate(r));
function setup({session={user:{id:'owner'}},uploadError=null,dbError=null,rows=[]}={}) {
 const dom=new JSDOM(html,{url:'https://journal.test',runScripts:'outside-only'});doms.push(dom);const w=dom.window;
 const upload=jest.fn(async()=>({error:uploadError}));
 const signed=jest.fn(async()=>({data:{signedUrl:'https://example.test/image.jpg'}}));
 const upsert=jest.fn(input=>({select:jest.fn(async()=>({data:input.map(t=>({external_id:t.external_id})),error:dbError}))}));
 const range=jest.fn(async(start,end)=>({data:rows.slice(start,end+1)}));
 const query={select:()=>query,eq:()=>query,order:()=>query,range};
 const client={storage:{from:()=>({upload,createSignedUrl:signed})},from:()=>({...query,upsert})};
 w.TradingCloud={client,session:jest.fn(async()=>session)};
 w.eval(code('cloud-tools.js'));
 return {w,upload,upsert,range};
}
function journal() {
 const ctx=setup();const {w}=ctx;
 w.currentLang='ru';w.translations={ru:{}};w.alert=jest.fn();w.setInterval=()=>0;
 w.db={set:jest.fn(async()=>{throw new Error('Browser quota full')})};
 w.eval(code('trades.js')+'\nrenderAll=()=>{}; window.readTrades=()=>trades; window.setTrades=x=>{trades=x}; window.closeId=x=>{closingTradeId=x};');
 return ctx;
}
afterEach(()=>doms.splice(0).forEach(d=>d.window.close()));
test('photo upload must succeed before the database write and ownership is included',async()=>{
 const {w,upload,upsert}=setup();
 await w.TradingCloud.pushTrades([{id:'one',ticker:'BTC',screenshots:['data:image/jpeg;base64,YQ==']}]);
 expect(upload).toHaveBeenCalledWith('owner/one/0.jpg',expect.anything(),expect.objectContaining({upsert:true}));
 expect(upload.mock.invocationCallOrder[0]).toBeLessThan(upsert.mock.invocationCallOrder[0]);
 expect(upsert.mock.calls[0][0][0]).toMatchObject({user_id:'owner',screenshot_paths:['owner/one/0.jpg']});
});
test('failed photo upload prevents reporting a saved trade',async()=>{
 const {w,upsert}=setup({uploadError:{message:'Storage offline'}});
 await expect(w.TradingCloud.pushTrades([{id:'one',screenshots:['data:image/jpeg;base64,YQ==']}])).rejects.toThrow('Storage offline');
 expect(upsert).not.toHaveBeenCalled();
});
test('database rejection propagates to the journal',async()=>{
 const {w}=setup({dbError:new Error('RLS denied')});
 await expect(w.TradingCloud.pushTrades([{id:'one'}])).rejects.toThrow('RLS denied');
});
test('signed-out users cannot upload or delete records',async()=>{
 const {w,upload,upsert}=setup({session:null});
 await expect(w.TradingCloud.pushTrades([{id:'one'}])).rejects.toThrow();
 await expect(w.TradingCloud.deleteTrade('one')).rejects.toThrow();
 expect(upload).not.toHaveBeenCalled();expect(upsert).not.toHaveBeenCalled();
});
test('history paginates beyond the server default page limit',async()=>{
 const {w,range}=setup({rows:Array.from({length:1101},(_,i)=>({id:i,screenshot_paths:[]}))});
 expect(await w.TradingCloud.pullTrades()).toHaveLength(1101);expect(range).toHaveBeenCalledTimes(3);
});
test('saving no longer depends on browser quota or writes local trade history',async()=>{
 const {w,upsert}=journal();
 expect(await w.saveTrades([{id:'one'}])).toBe(true);expect(upsert).toHaveBeenCalled();expect(w.db.set).not.toHaveBeenCalled();
 expect(w.document.getElementById('cloudState').textContent).toContain('сохранены');
});
test('failed close preserves the open trade and close form',async()=>{
 const {w}=journal();w.TradingCloud.pushTrades=jest.fn(async()=>{throw new Error('Offline')});
 w.setTrades([{id:'one',status:'open',exit:''}]);w.closeId('one');
 w.document.getElementById('closeTradeModal').classList.add('show');
 w.document.getElementById('closeExitPrice').value='99';w.document.getElementById('confirmCloseBtn').click();await flush();
 expect(w.readTrades()[0].status).toBe('open');expect(w.document.getElementById('closeTradeModal').classList.contains('show')).toBe(true);
 expect(w.document.getElementById('closeExitPrice').value).toBe('99');
});
test('loading replaces stale local history and sign-out clears the visible account',async()=>{
 const {w}=journal();w.setTrades([{id:'stale'}]);
 w.TradingCloud.pullTrades=jest.fn(async()=>[{external_id:'cloud',ticker:'ETH'}]);
 await w.loadTrades();expect(w.readTrades().map(t=>t.id)).toEqual(['cloud']);
 w.TradingCloud.session=jest.fn(async()=>null);await w.loadTrades();expect(w.readTrades()).toEqual([]);
});
test('concurrent saves do not submit the same action twice',async()=>{
 const {w}=journal();let finish;w.TradingCloud.pushTrades=jest.fn(()=>new Promise(r=>{finish=r}));
 const first=w.saveTrades([{id:'one'}]);expect(await w.saveTrades([{id:'one'}])).toBe(false);finish(1);expect(await first).toBe(true);
 expect(w.TradingCloud.pushTrades).toHaveBeenCalledTimes(1);
});
test('missing client never silently falls back to browser storage',async()=>{
 const {w}=journal();delete w.TradingCloud;expect(await w.saveTrades([{id:'one'}])).toBe(false);expect(w.db.set).not.toHaveBeenCalled();
});
test('risk guard uses cloud history and blocks when risk cannot be checked',async()=>{
 const {w}=setup();w.eval(code('trade-tools.js'));
 w.TradingCloud.pullTrades=jest.fn(async()=>[{entry:100,exit:90,volume:1,side:'Long',status:'closed'},{entry:100,exit:90,volume:1,side:'Long',status:'closed'}]);
 expect((await w.TradingRiskGuard.canAddTrade()).ok).toBe(false);
 w.TradingCloud.pullTrades.mockRejectedValue(new Error('Offline'));
 expect((await w.TradingRiskGuard.canAddTrade()).ok).toBe(false);
});
test('legacy migration skips cloud records and keeps the browser backup',async()=>{
 const {w}=setup();const old=[{id:'old',ticker:'BTC'},{id:'existing',ticker:'STALE'}];
 w.localStorage.setItem('tk_journal_trades_v2',JSON.stringify(old));
 w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'owner',email:'owner@example.test'}}}}),onAuthStateChange:jest.fn()}})};
 w.eval(code('cloud-sync.js'));
 w.TradingCloud.pullTrades=jest.fn(async()=>[{external_id:'existing'}]);w.TradingCloud.pushTrades=jest.fn(async rows=>rows.length);
 await flush();w.document.getElementById('cloudSync').click();await flush();
 expect(w.TradingCloud.pushTrades).toHaveBeenCalledWith([old[0]]);
 expect(JSON.parse(w.localStorage.getItem('tk_journal_trades_v2'))).toEqual(old);
});
test('database must confirm every submitted row before success',async()=>{
 const {w,upsert}=setup();upsert.mockImplementation(()=>({select:async()=>({data:[],error:null})}));
 await expect(w.TradingCloud.pushTrades([{id:'one'}])).rejects.toThrow('не подтвердила');
});
test('failed JSON import keeps displayed history unchanged',async()=>{
 const {w}=journal();w.uid=()=> 'imported';w.TradingCloud.pushTrades=jest.fn(async()=>{throw new Error('Offline')});
 w.setTrades([{id:'existing'}]);w.eval(code('export-import.js'));
 let picker;const create=w.document.createElement.bind(w.document);
 w.document.createElement=(tag)=>{const el=create(tag);if(tag==='input')picker=el;return el};
 w.importJSON();Object.defineProperty(picker,'files',{value:[{text:async()=>JSON.stringify([{ticker:'BTC'}])}]});
 picker.dispatchEvent(new w.Event('change'));await flush();
 expect(w.readTrades().map(t=>t.id)).toEqual(['existing']);
});
test('failed cloud delete leaves the trade visible',async()=>{
 const {w}=journal();w.TradingCloud.deleteTrade=jest.fn(async()=>{throw new Error('Offline')});
 w.fetchLivePrice=jest.fn(async()=>null);w.escapeHtml=s=>String(s);w.calcPnl=()=>({pnl:0,pct:0});w.fmtMoney=()=> '0';w.fmtPct=()=> '0';
 w.setTrades([{id:'one',ticker:'BTC',status:'open',date:'2026-01-01',screenshots:[]}]);
 w.renderTrades({});w.document.querySelector('[data-del]').click();await flush();
 expect(w.readTrades()).toHaveLength(1);expect(w.document.getElementById('cloudState').textContent).toContain('Не удалось удалить');
});
