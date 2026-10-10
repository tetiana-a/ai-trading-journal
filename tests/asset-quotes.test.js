const fs=require('fs'),{JSDOM}=require('jsdom');
const RATES={data:{currency:'USD',rates:{EUR:'0.8926',GBP:'0.7559',JPY:'158.29',CHF:'0.8305',CZK:'21.766',BTC:'0.0000121'}}};
const BINANCE=[{symbol:'BTCUSDT',price:'82550.10'},{symbol:'ETHUSDT',price:'3120.5'},{symbol:'PAXGUSDT',price:'2655.4'},{symbol:'ETHBTC',price:'0.0378'},{symbol:'BTCUPUSDT',price:'12'},{symbol:'ZZZUSDT',price:'0.00012345'}];
function page(html=''){
 const dom=new JSDOM('<html><body>'+html+'</body></html>',{url:'https://example.com/',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.fetch=async url=>{calls.push(String(url));const body=String(url).includes('coinbase')?RATES:String(url).includes('symbol=')?BINANCE.find(r=>String(url).endsWith('symbol='+r.symbol))||null:BINANCE;return {ok:!!body,json:async()=>body};};
 w.eval(fs.readFileSync('src/js/market-api.js','utf8'));return {dom,w,calls};}

test('a currency pair is priced from public exchange rates and marked as indicative',async()=>{
 const x=page();const q=await x.w.eval('fetchAssetQuote("EURUSD")');
 expect(q.source).toBe('coinbase');expect(q.approximate).toBe(true);expect(q.price).toBeCloseTo(1/0.8926,6);
 expect((await x.w.eval('fetchAssetQuote("eur/jpy")')).price).toBeCloseTo(158.29/0.8926,4);
 expect((await x.w.eval('fetchAssetQuote("USDCZK.r")')).price).toBeCloseTo(21.766,6);
 expect(x.calls.filter(u=>u.includes('coinbase'))).toHaveLength(1);
 expect(await x.w.eval('fetchAssetQuote("USDXXX")')).toBeNull();x.dom.window.close();});

test('crypto is priced by Binance under any spelling; gold falls back to PAXG and says so',async()=>{
 const x=page();
 for(const t of ['BTCUSDT','btc','BTCUSD','BTC/USDT']){const q=await x.w.eval('fetchAssetQuote('+JSON.stringify(t)+')');expect(q.price).toBe(82550.1);expect(q.source).toBe('binance');expect(q.approximate).toBe(false);}
 const gold=await x.w.eval('fetchAssetQuote("XAUUSD")');expect(gold.price).toBe(2655.4);expect(gold.approximate).toBe(true);
 expect(await x.w.eval('fetchAssetQuote("US30")')).toBeNull();expect(await x.w.eval('fetchLivePrice("ETHUSDT")')).toBe(3120.5);expect(await x.w.eval('fetchLivePrice("")')).toBeNull();x.dom.window.close();});

test('a fresh MT5 quote wins over every public source; a stale one is ignored',async()=>{
 const x=page();x.w.MT5Quotes={at:Date.now(),symbols:new Map([['EURUSD',{symbol:'EURUSD',bid:1.1705,ask:1.17058,digits:5}],['US30.CASH',{symbol:'US30.cash',bid:42150.5,ask:42152.5,digits:2}]])};
 const fx=await x.w.eval('fetchAssetQuote("EURUSD")');expect(fx.source).toBe('mt5');expect(fx.approximate).toBe(false);expect(fx.bid).toBe(1.1705);expect(fx.price).toBeCloseTo(1.17054,6);
 expect((await x.w.eval('fetchAssetQuote("us30.cash")')).price).toBe(42151.5);expect(x.calls).toHaveLength(0);
 x.w.MT5Quotes.at=Date.now()-10*60*1000;expect((await x.w.eval('fetchAssetQuote("EURUSD")')).source).toBe('coinbase');expect(await x.w.eval('fetchAssetQuote("US30.cash")')).toBeNull();x.dom.window.close();});

test('prices are formatted with the decimals the instrument is quoted in',()=>{
 const x=page();const f=(...a)=>x.w.eval('formatQuote('+a.join(',')+')').replace(/\s/g,' ');
 expect(f(1.120304)).toBe('1,1203');expect(f(1.12031)).toBe('1,12031');expect(f(167.3349)).toBe('167,335');expect(f(82550.1)).toBe('82 550,10');expect(f(42150.5,2)).toBe('42 150,50');expect(f(0.00012345)).toBe('0,00012345');x.dom.window.close();});

test('asset list: every group, typed search, keyboard choice, and prices per source',async()=>{
 const x=page('<div class="f-field"><input id="fTicker" list="fTickerSuggestions"><span id="livePriceHint"></span></div>'),w=x.w,doc=w.document;
 w.eval('var currentLang="ru";var trades=[{ticker:"gbpjpy",date:"2026-10-09",broker:"FTMO"},{ticker:"SOLUSDT",date:"2026-10-01"}];');
 w.MT5Quotes={at:Date.now(),symbols:new Map([['US30.CASH',{symbol:'US30.cash',bid:42150.5,ask:42152.5,digits:2,group:'Indices',description:'US Wall Street 30'}],['EURUSD',{symbol:'EURUSD',bid:1.1705,ask:1.17058,digits:5,group:'Forex',description:'Euro vs US Dollar'}]])};
 w.eval(fs.readFileSync('src/js/asset-picker.js','utf8'));
 try{
 const input=doc.getElementById('fTicker'),panel=doc.querySelector('.asset-picker'),rows=()=>[...doc.querySelectorAll('.asset-row')].map(r=>r.children[0].textContent+'|'+r.children[2].textContent.replace(/\s/g,' '));
 expect(input.hasAttribute('list')).toBe(false);expect(panel.hidden).toBe(true);
 input.focus();expect(panel.hidden).toBe(true);
 input.click();expect(panel.hidden).toBe(false);expect(input.getAttribute('aria-expanded')).toBe('true');
 await w.AssetPicker.loadPrices();
 expect([...doc.querySelectorAll('.asset-tab')].map(b=>b.dataset.group)).toEqual(['all','mine','mt5','forex','crypto','metals','indices','commodities']);
 const all=rows();expect(all.slice(0,4)).toEqual(['US30.cash|42 151,50','EURUSD|1,17054','GBPJPY|209,406','SOLUSDT|—']);expect(all.filter(r=>r.startsWith('EURUSD|'))).toHaveLength(1);
 expect(w.AssetPicker.assets('crypto').map(a=>a.symbol)).toEqual(['BTCUSDT','ETHUSDT','PAXGUSDT','ZZZUSDT']);
 doc.querySelector('[data-group=indices]').click();expect(rows()[0]).toBe('US30.cash|42 151,50');expect(rows()).toContain('GER40|—');
 doc.querySelector('[data-group=metals]').click();expect(rows().slice(0,2)).toEqual(['XAUUSD|2 655,40','XAGUSD|—']);expect(doc.querySelector('.asset-price.approx')).not.toBeNull();
 doc.querySelector('[data-group=all]').click();
 let heard=0;input.addEventListener('input',()=>heard++);
 input.value='usdc';input.dispatchEvent(new w.Event('input',{bubbles:true}));expect(rows().map(r=>r.split('|')[0])).toEqual(['USDCHF','USDCAD','USDCZK','USDCNH']);
 input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
 expect(input.getAttribute('aria-activedescendant')).toBe('assetOption1');
 input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 expect(input.value).toBe('USDCAD');expect(panel.hidden).toBe(true);expect(heard).toBe(2);
 input.click();input.value='zzzz';input.dispatchEvent(new w.Event('input',{bubbles:true}));expect(doc.querySelector('.asset-empty')).not.toBeNull();
 input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(panel.hidden).toBe(true);expect(input.value).toBe('zzzz');
 }finally{x.dom.window.close();}});

test('MT5 quotes file is parsed into a symbol book',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});dom.window.eval(fs.readFileSync('src/js/import-tools.js','utf8'));const api=dom.window.BrokerCSVImporter;
 const book=api.parseQuotes('Symbol;Bid;Ask;Digits;Group;Description;Server Time\r\nEURUSD;1.17050;1.17058;5;Forex;Euro vs US Dollar;2026.10.12 10:20:05\r\nUS30.cash;42150.50;42152.50;2;Indices;US Wall Street 30;2026.10.12 10:20:05\r\n');
 expect(book.size).toBe(2);expect(book.get('US30.CASH')).toEqual({symbol:'US30.cash',bid:42150.5,ask:42152.5,digits:2,group:'Indices',description:'US Wall Street 30'});expect(()=>api.parseQuotes('Key;Value\n')).toThrow();dom.window.close();});
