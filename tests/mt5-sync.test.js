const fs=require('fs'),{JSDOM}=require('jsdom');
const HEADER='Ticket;Symbol;Type;Volume;Open Time;Close Time;Open Price;Close Price;Net Pnl;Account;Comment;Status;Stop Loss;Take Profit;Risk Money;Commission;Swap;Current Price;Floating Result;Server UTC Offset';
const ACC='FTMO-Demo / 1514878695 / USD';
const OPEN_ROW='FTMO-Demo:1514878695:7001;EURUSD;Long;0.25000000;2026.10.12 10:15:00;;1.17000000;;;'+ACC+';MT5 Reporter 1.10: open position;open;1.16800000;1.17400000;50.00;-0.75;0.00;1.17050000;11.75;10800';
const CLOSED_ROW='FTMO-Demo:1514878695:7001;EURUSD;Long;0.25000000;2026.10.12 10:15:00;2026.10.12 12:40:00;1.17000000;1.17400000;98.50;'+ACC+';MT5 Reporter 1.10: lots, server time, fully closed position;closed;1.16800000;1.17400000;50.00;-1.50;0.00;;;10800';
const ACCOUNT='Key;Value\nReporter;1.10\nLogin;1514878695\nServer;FTMO-Demo\nCurrency;USD\nBalance;10000.00\nEquity;10011.75\nInitialBalance;10000.00\nDayStartBalance;10000.00\nDayClosedResult;0.00\nDayTrades;1\nOpenPositions;1\nOpenRisk;61.75\nOpenWithoutStop;0\nFloatingResult;11.75\nServerUtcOffset;10800\nUpdatedUtc;2026.10.12 07:20:05\n';
const PANEL='<div id="mt5Sync" hidden><span id="mt5SyncState"></span><button id="mt5Connect"></button><button id="mt5Resume" hidden></button><button id="mt5Now" hidden></button><button id="mt5Disconnect" hidden></button><a id="mt5Help"></a><div id="mt5Account" hidden></div><div id="mt5Todo" hidden></div></div>';

function folderOf(files,permission='granted'){return {permission,files,async queryPermission(){return this.permission;},async requestPermission(){this.permission='granted';return 'granted';},async *entries(){for(const [name,f] of Object.entries(this.files))yield [name,{kind:'file',getFile:async()=>({lastModified:f.modified,text:async()=>f.text})}];}};}
function setup({signedIn=true,loaded=true}={}){
 const dom=new JSDOM('<html lang="ru"><body>'+PANEL+'</body></html>',{url:'https://example.com/',runScripts:'outside-only'}),w=dom.window;
 w.TradingCloud={session:async()=>signedIn?{user:{id:'u1'}}:null,pushTrades:jest.fn(async rows=>rows.length)};
 w.eval('var trades=[];var tradesLoaded='+loaded+';var tradeWriteBusy=false;var renders=0;function renderAll(){renders++;document.dispatchEvent(new Event("journal:trades-updated"));}function saveTrades(){throw new Error("the automatic sync must use the quiet path");}');
 w.eval(fs.readFileSync('src/js/import-tools.js','utf8'));w.eval(fs.readFileSync('src/js/mt5-sync.js','utf8'));
 return {dom,w,state:()=>w.document.getElementById('mt5SyncState').textContent};}

test('folder sync: an open position appears once, is not re-saved while unchanged, and closes in place',async()=>{
 const x=setup(),folder=folderOf({'MT5_Journal_1514878695.csv':{modified:1,text:HEADER+'\n'+OPEN_ROW+'\n'},'MT5_Account_1514878695.csv':{modified:1,text:ACCOUNT},'tmp_MT5_Journal_1514878695.csv':{modified:9,text:'half written'},'notes.txt':{modified:1,text:'x'}});
 await x.w.MT5Sync.use(folder);
 expect(x.w.TradingCloud.pushTrades).toHaveBeenCalledTimes(1);const saved=x.w.TradingCloud.pushTrades.mock.calls[0][0];expect(saved).toHaveLength(1);
 expect(saved[0].status).toBe('open');expect(saved[0].deposit).toBe('10000');expect(saved[0].plannedRiskPct).toBe('0.5');
 const list=x.w.eval('trades');expect(list).toHaveLength(1);expect(list[0].currentPrice).toBe(1.1705);
 expect(x.w.MT5Sync.status.kind).toBe('synced');expect(x.w.MT5Sync.status.open).toBe(1);expect(x.state()).toContain('открыто: 1');
 expect(JSON.parse(x.w.localStorage.getItem('tk_mt5_account')).equity).toBe(10011.75);
 expect(x.w.document.getElementById('mt5Account').hidden).toBe(false);expect(x.w.document.getElementById('mt5Connect').hidden).toBe(true);expect(x.w.document.getElementById('mt5Disconnect').hidden).toBe(false);

 await x.w.MT5Sync.sync(false);expect(x.w.TradingCloud.pushTrades).toHaveBeenCalledTimes(1);expect(x.w.MT5Sync.status.open).toBe(1);

 folder.files['MT5_Journal_1514878695.csv']={modified:2,text:HEADER+'\n'+OPEN_ROW.replace('1.17050000;11.75','1.17100000;24.25')+'\n'};
 await x.w.MT5Sync.sync(false);expect(x.w.TradingCloud.pushTrades).toHaveBeenCalledTimes(1);expect(x.w.eval('trades')[0].currentPrice).toBe(1.171);

 x.w.eval('trades')[0].setup='EMA pullback';
 folder.files['MT5_Journal_1514878695.csv']={modified:3,text:HEADER+'\n'+CLOSED_ROW+'\n'};
 await x.w.MT5Sync.sync(false);expect(x.w.TradingCloud.pushTrades).toHaveBeenCalledTimes(2);
 const after=x.w.eval('trades');expect(after).toHaveLength(1);expect(after[0].status).toBe('closed');expect(after[0].realizedPnl).toBe('98.5');expect(after[0].setup).toBe('EMA pullback');expect(x.w.MT5Sync.status.open).toBe(0);
 x.dom.window.close();});

test('folder sync never saves before sign-in or before the journal has loaded, and recovers afterwards',async()=>{
 const files={'MT5_Journal_1514878695.csv':{modified:1,text:HEADER+'\n'+OPEN_ROW+'\n'},'MT5_Account_1514878695.csv':{modified:1,text:ACCOUNT}};
 const out=setup({signedIn:false});await out.w.MT5Sync.use(folderOf(files));
 expect(out.w.TradingCloud.pushTrades).not.toHaveBeenCalled();expect(out.w.MT5Sync.status.kind).toBe('signIn');expect(JSON.parse(out.w.localStorage.getItem('tk_mt5_account')).balance).toBe(10000);out.dom.window.close();

 const early=setup({loaded:false});await early.w.MT5Sync.use(folderOf(files));
 expect(early.w.TradingCloud.pushTrades).not.toHaveBeenCalled();expect(early.w.MT5Sync.status.kind).toBe('loading');
 early.w.eval('tradesLoaded=true');await early.w.MT5Sync.sync(false);
 expect(early.w.TradingCloud.pushTrades).toHaveBeenCalledTimes(1);expect(early.w.MT5Sync.status.kind).toBe('synced');early.dom.window.close();});

test('folder sync reports lost access, an empty folder and a failed save without dialogs',async()=>{
 const x=setup();x.w.alert=jest.fn();
 await x.w.MT5Sync.use(folderOf({},'granted'));expect(x.w.MT5Sync.status.kind).toBe('empty');
 const locked=folderOf({'MT5_Journal_1.csv':{modified:1,text:HEADER+'\n'}},'prompt');await x.w.MT5Sync.use(locked);
 expect(x.w.MT5Sync.status.kind).toBe('needAccess');expect(x.w.document.getElementById('mt5Resume').hidden).toBe(false);
 x.w.TradingCloud.pushTrades=jest.fn(async()=>{throw new Error('offline');});
 await x.w.MT5Sync.use(folderOf({'MT5_Journal_1514878695.csv':{modified:1,text:HEADER+'\n'+OPEN_ROW+'\n'}}));
 expect(x.w.MT5Sync.status.kind).toBe('saveFailed');expect(x.state()).toContain('offline');expect(x.w.eval('trades')).toHaveLength(0);expect(x.w.alert).not.toHaveBeenCalled();
 x.w.TradingCloud.pushTrades=jest.fn(async rows=>rows.length);await x.w.MT5Sync.sync(false);
 expect(x.w.TradingCloud.pushTrades).toHaveBeenCalledTimes(1);expect(x.w.eval('trades')).toHaveLength(1);x.dom.window.close();});

test('MT5 snapshot fills the prop form on the system page and keeps the stored guard current elsewhere',()=>{
 const account={login:'1514878695',server:'FTMO-Demo',currency:'USD',balance:9950,equity:9450,initialBalance:10000,dayStartBalance:10000,openPositions:1,openRisk:20,openWithoutStop:0,updatedAt:new Date().toISOString()};
 const form='<select id="propPreset"><option value="ftmo-1step">a</option><option value="ftmo-2step">b</option></select>'+['propFirm','propProgram','propSize','propBalance','propEquity','propDayStart','propDailyPct','propMaxPct','propTargetPct','propPersonalPct'].map(id=>'<input id="'+id+'" value="'+(/Size|Balance|Equity|DayStart/.test(id)?'5000':'')+'">').join('')+'<div id="propResult"></div><div id="propSource"></div>';
 const sys=new JSDOM('<html lang="ru"><body>'+form+'</body></html>',{url:'https://example.com/system.html',runScripts:'outside-only'});
 sys.window.localStorage.setItem('tk_prop_preset','ftmo-2step');sys.window.localStorage.setItem('tk_mt5_account',JSON.stringify(account));
 sys.window.eval(fs.readFileSync('src/js/trade-tools.js','utf8'));const $=id=>sys.window.document.getElementById(id);
 expect($('propPreset').value).toBe('ftmo-2step');expect($('propDailyPct').value).toBe('5');expect($('propSize').value).toBe('10000');expect($('propBalance').value).toBe('9950');expect($('propEquity').value).toBe('9450');expect($('propDayStart').value).toBe('10000');
 expect($('propSource').textContent).toContain('FTMO-Demo');expect($('propResult').textContent).toContain('FIRM LIMIT BREACH');
 expect(JSON.parse(sys.window.localStorage.getItem('tk_prop_guard')).blocked).toBe(true);sys.window.close();

 const page=new JSDOM('<html lang="ru"><body></body></html>',{url:'https://example.com/',runScripts:'outside-only'});
 page.window.localStorage.setItem('tk_prop_guard',JSON.stringify({accountSize:10000,personalDailyStopPct:1,firmDailyLossPct:5,maxLossPct:10,dayStartBalance:10000,currentEquity:10000,blocked:false}));
 page.window.eval(fs.readFileSync('src/js/trade-tools.js','utf8'));
 page.window.TradingPropGuard.applySnapshot({...account,equity:9990});let guard=JSON.parse(page.window.localStorage.getItem('tk_prop_guard'));
 expect(guard.currentEquity).toBe(9990);expect(guard.blocked).toBe(false);expect(guard.firmDailyLossPct).toBe(5);
 page.window.TradingPropGuard.applySnapshot({...account,equity:9890});guard=JSON.parse(page.window.localStorage.getItem('tk_prop_guard'));expect(guard.blocked).toBe(true);page.window.close();});
