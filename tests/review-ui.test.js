const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),script=fs.readFileSync(path.join(__dirname,'../src/js/ai-service.js'),'utf8');
const opened=[],flush=()=>new Promise(r=>setImmediate(r));
const report={id:'report-1',created_at:'2026-10-07T12:00:00Z',provider:'openai',model:'test-model',metadata:{scope:'history',narrative:{summary:'<img src=x onerror=alert(1)>',strengths:['Evidence'],findings:[{title:'Check stop',detail:'Missing stop',trade_ids:['t1']}],actions:['Define risk'],limitations:['Small sample']},metrics:{accounts:[]},coverage:{tradesComputed:2,tradeDetailsReviewed:2,photosReviewed:0,photosAvailable:1,photosUnavailable:1,knowledgeReviewed:0,detailTextLimit:1200}},review:'Review'};
function create({error=null}={}){
 const dom=new JSDOM(html,{url:'https://journal.test',runScripts:'outside-only'});opened.push(dom);const w=dom.window;
 w.trades=[{id:'t1',ticker:'BTCUSDC',date:'2026-10-07',notes:'test'}];
 const invoke=jest.fn(async()=>error?{error:{context:{json:async()=>({error})}}}:{data:{report}});
 const query={select:()=>query,order:()=>query,range:async()=>({data:[report]})};w.TradingCloud={session:async()=>({user:{id:'owner'}}),client:{functions:{invoke},from:()=>query}};
 w.eval(script);w.document.dispatchEvent(new w.Event('journal:trades-updated'));
 return {w,invoke,$:id=>w.document.getElementById(id)};
}
afterEach(()=>opened.splice(0).forEach(d=>d.window.close()));
test('three review actions invoke the authenticated function with correct scopes',async()=>{
 const {w,invoke,$}=create();await flush();$('reviewTrade').value='t1';$('reviewSingle').click();await flush();
 expect(invoke.mock.calls[0][1].body).toMatchObject({scope:'trade',tradeId:'t1',includePhotos:true});
 $('reviewHistory').click();await flush();$('reviewWeekly').click();await flush();expect(invoke.mock.calls.map(c=>c[1].body.scope)).toEqual(['trade','history','weekly']);
 expect(w.document.querySelector('#aiContent img')).toBeNull();expect($('aiContent').textContent).toContain('<img');expect($('reviewDownload').hidden).toBe(false);
});
test('server setup errors remain actionable and do not offer an unsaved report download',async()=>{
 const {invoke,$}=create({error:'Add OPENAI_API_KEY in Secrets'});await flush();$('reviewHistory').click();await flush();
 expect($('aiContent').textContent).toContain('OPENAI_API_KEY');expect($('reviewDownload').hidden).toBe(true);
 const id=invoke.mock.calls[0][1].body.requestId;$('reviewHistory').click();await flush();expect(invoke.mock.calls[1][1].body.requestId).toBe(id);
});
test('saved reports open without a new paid call and sign-out hides content',async()=>{
 const {w,invoke,$}=create();await flush();$('reviewArchive').querySelector('button').click();expect(invoke).not.toHaveBeenCalled();expect($('aiContent').textContent).toContain('Сохранён');
 w.TradingCloud.session=async()=>null;w.document.dispatchEvent(new w.Event('journal:cloud-session'));await flush();expect($('aiContent').textContent).toBe('');expect($('reviewArchive').children.length).toBe(0);
});
test('photo opt-out and per-row trade analysis use the same pipeline',async()=>{
 const {w,invoke,$}=create();await flush();$('reviewPhotos').checked=false;await w.analyzeTrade('t1');expect(invoke.mock.calls[0][1].body).toMatchObject({scope:'trade',tradeId:'t1',includePhotos:false});
});
