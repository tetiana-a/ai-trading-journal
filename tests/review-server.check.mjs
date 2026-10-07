import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodFor,selectTrades,resultOf,summarize,validateReview,detailSample} from '../supabase/functions/journal-review/core.mjs';
import {createHandler} from '../supabase/functions/journal-review/handler.mjs';
const owner='00000000-0000-4000-8000-000000000001';
const row={id:'00000000-0000-4000-8000-000000000002',external_id:'trade1',user_id:owner,ticker:'BTCUSDC',side:'Long',status:'closed',entry:100,exit:120,volume:2,fees:1,trade_date:'2026-10-07',screenshot_paths:[],broker:'Binance',account_label:'spot'};
const narrative={summary:'Review',strengths:['Plan'],findings:[{title:'Execution',detail:'Check fees',trade_ids:['trade1']}],actions:['Record stop'],limitations:['Small sample']};
const req=(body={},token='valid')=>new Request('https://project.test/functions/v1/journal-review',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify({scope:'history',requestId:'00000000-0000-4000-8000-000000000003',...body})});
function harness(options={}){
 const calls=[],saved=[],provider=[];
 const fetchImpl=async(url,init={})=>{
  calls.push({url,init});const u=new URL(url),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  if(u.pathname==='/auth/v1/user')return options.badAuth?json({},401):json({id:owner,is_anonymous:false});
  if(u.pathname==='/v1/chat/completions'){provider.push(JSON.parse(init.body));if(options.aiFailure)return json({},429);return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(options.narrative||narrative)}}],usage:{total_tokens:100}});}
  if(u.pathname.startsWith('/storage/'))return options.imageFailure?json({},404):new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});
  if(u.pathname==='/rest/v1/trades'){
   assert.equal(u.searchParams.get('user_id'),'eq.'+owner);
   let rows=options.rows||[row];if(u.searchParams.has('external_id'))rows=rows.filter(r=>'eq.'+r.external_id===u.searchParams.get('external_id'));
   const start=Number(u.searchParams.get('offset')||0);return json(rows.slice(start,start+500));
  }
  if(u.pathname==='/rest/v1/ai_reviews'){
   if(init.method==='POST'){if(options.saveFailure)return json({},500);const r={...JSON.parse(init.body),id:'saved',created_at:'2026-10-07T12:00:00Z'};saved.push(r);return json([r]);}
   assert.equal(u.searchParams.get('user_id'),'eq.'+owner);
   if(u.searchParams.has('metadata->>request_id'))return json(options.cached?[{id:'prior'}]:[]);
   return json(options.limited?Array.from({length:20},()=>({id:'old'})):[]);
  }
  if(u.pathname==='/rest/v1/knowledge_documents'||u.pathname==='/rest/v1/prop_accounts'){assert.equal(u.searchParams.get('user_id'),'eq.'+owner);return json([]);}
  throw Error('Unexpected '+url);
 };
 const handler=createHandler({env:k=>({SUPABASE_URL:'https://project.test',SUPABASE_ANON_KEY:'public-key',OPENAI_API_KEY:options.noKey?'':'private-model-key'})[k],fetchImpl,now:()=>new Date('2026-10-07T12:00:00Z')});
 return {handler,calls,saved,provider};
}
test('weekly scope uses Prague midnight and close dates including DST',()=>{
 const p=periodFor('weekly',new Date('2026-10-07T23:30:00Z'));assert.equal(p.end,'2026-10-08');assert.equal(p.start,'2026-10-02');
 assert.equal(selectTrades([{...row,trade_date:'2026-09-01',closed_at:'2026-10-01T22:30:00Z'}],'weekly',null,p).length,1);
 assert.equal(periodFor('weekly',new Date('2026-10-25T23:30:00Z')).end,'2026-10-26');
});
test('broker net PNL includes zero and never subtracts commissions twice',()=>{
 assert.equal(resultOf({...row,realized_pnl:0,fees:100}).value,0);assert.equal(resultOf({...row,realized_pnl:10,fees:100}).value,10);
 assert.equal(resultOf(row).value,39);assert.equal(resultOf({...row,side:'Short'}).value,-41);
});
test('lot PNL and open equity cannot be invented from prices',()=>{
 assert.equal(resultOf({...row,broker:'FTMO / MT5'}).value,null);assert.equal(resultOf({...row,ticker:'EURUSD'}).value,null);assert.equal(resultOf({...row,status:'open',realized_pnl:10}).value,null);
});
test('metrics distinguish unknown results and calculate closed-PNL drawdown',()=>{
 const m=summarize([{...row,realized_pnl:100,closed_at:'2026-10-01'},{...row,realized_pnl:-40,closed_at:'2026-10-02'},{...row,realized_pnl:-20,closed_at:'2026-10-03'}]);const g=m.accounts[0];
 assert.equal(g.netPnl,40);assert.equal(g.closedPnlDrawdown,60);assert.equal(g.maxLossStreak,2);assert.equal(g.winRate,0.3333);
 assert.equal(summarize([{...row,broker:'MT5'}]).accounts[0].unknownPnl,1);
});
test('different accounts are not combined; no-loss profit factor is undefined',()=>{
 const m=summarize([row,{...row,account_label:'other'}]);assert.equal(m.accounts.length,2);assert.equal(m.accounts[0].profitFactor,null);
});
test('detail limits and fabricated trade citations are explicit',()=>{
 assert.equal(detailSample(Array.from({length:90},(_,i)=>({...row,id:String(i)}))).length,80);
 assert.throws(()=>validateReview({...narrative,findings:[{title:'x',detail:'y',trade_ids:['fake']}]},new Set(['trade1'])));
});
test('auth is checked before any reads or provider calls',async()=>{
 const h=harness();assert.equal((await h.handler(req({},''))).status,401);assert.equal(h.calls.length,0);
 const bad=harness({badAuth:true});assert.equal((await bad.handler(req())).status,401);assert.equal(bad.provider.length,0);
});
test('missing key is actionable and never produces fake AI reports',async()=>{
 const h=harness({noKey:true}),res=await h.handler(req());assert.equal(res.status,503);assert.equal((await res.json()).code,'AI_NOT_CONFIGURED');assert.equal(h.saved.length,0);
});
test('full authenticated pipeline scopes queries, sends images and saves private report',async()=>{
 const h=harness({rows:[{...row,screenshot_paths:[owner+'/trade1/0.jpg']}]});const res=await h.handler(req());assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.report.metadata.coverage.photosReviewed,1);assert.equal(h.saved[0].user_id,owner);assert.equal(h.saved[0].metadata.metrics.total,1);
 assert.equal(h.provider[0].store,false);assert.ok(h.provider[0].messages[1].content.some(c=>c.type==='image_url'));
 assert.ok(!JSON.stringify(data).includes('private-model-key'));
});
test('missing or foreign photos are counted, never sent as public URLs',async()=>{
 const h=harness({rows:[{...row,screenshot_paths:['other/private.jpg',owner+'/trade1/0.jpg']}],imageFailure:true});const data=await (await h.handler(req())).json();
 assert.equal(data.report.metadata.coverage.photosUnavailable,2);assert.equal(data.report.metadata.coverage.photosReviewed,0);assert.equal(h.calls.filter(c=>c.url.includes('/storage/')).length,1);
});
test('history pagination includes every row in server metrics',async()=>{
 const h=harness({rows:Array.from({length:1001},(_,i)=>({...row,id:String(i)}))});const data=await (await h.handler(req())).json();assert.equal(data.report.metadata.metrics.total,1001);assert.equal(h.calls.filter(c=>c.url.includes('/rest/v1/trades')).length,3);
});
test('another user trade cannot be retrieved by external id',async()=>{
 const h=harness();assert.equal((await h.handler(req({scope:'trade',tradeId:'unknown'}))).status,404);assert.equal(h.provider.length,0);
});
test('provider errors and failed saves never report success',async()=>{
 const failed=harness({aiFailure:true});assert.equal((await failed.handler(req())).status,502);assert.equal(failed.saved.length,0);
 const save=harness({saveFailure:true});assert.equal((await save.handler(req())).status,502);assert.equal(save.saved.length,0);
});
test('retry returns saved report without another paid API request',async()=>{
 const h=harness({cached:true});assert.equal((await (await h.handler(req())).json()).cached,true);assert.equal(h.provider.length,0);
});
test('hourly guard and user-selected photo opt-out work',async()=>{
 const limited=harness({limited:true});assert.equal((await limited.handler(req())).status,429);assert.equal(limited.provider.length,0);
 const h=harness({rows:[{...row,screenshot_paths:[owner+'/trade1/0.jpg']}]});const data=await (await h.handler(req({includePhotos:false}))).json();assert.equal(data.report.metadata.coverage.photosReviewed,0);assert.equal(h.calls.filter(c=>c.url.includes('/storage/')).length,0);
});
