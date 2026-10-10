const fs=require('fs'),{JSDOM}=require('jsdom');
test('MT5 reporter CSV imports net result, lots, account and stable identity without inventing UTC',()=>{
const dom=new JSDOM('',{runScripts:'outside-only'});dom.window.eval(fs.readFileSync('src/js/import-tools.js','utf8'));
const csv='Ticket;Symbol;Type;Volume;Open Time;Close Time;Open Price;Close Price;Net Pnl;Account;Comment\nDemo:123:42;EURUSD;Short;0.20;2026.10.07 09:00:00;2026.10.07 11:00:00;1.17;1.16;195.5;Demo / 123 / USD;MT5 Reporter\n';
const parse=dom.window.BrokerCSVImporter.parse;const a=parse(csv,'MT5_Journal_123.csv')[0],b=parse(csv,'MT5_Journal_123.csv')[0];
expect(a.realizedPnl).toBe('195.5');expect(a.side).toBe('Short');expect(a.volume).toBe('0.2');expect(a.accountLabel).toBe('Demo / 123 / USD');expect(a.date).toBe('2026-10-07');expect(a.closedAt).toBe('');expect(a.openedAt).toBe('');expect(a.id).toBe(b.id);expect(a.status).toBe('closed');dom.window.close();
});
test('download and guide match; reporter has no trading or networking API calls',()=>{
const s=fs.readFileSync('downloads/mt5/TK_Journal_Reporter.mq5','utf8');expect(s).not.toMatch(/\b(OrderSend|OrderSendAsync|WebRequest|CTrade|SocketConnect)\s*\(/);expect(s).toContain('DEAL_ENTRY_INOUT');expect(s).toContain('DEAL_FEE');const dom=new JSDOM(fs.readFileSync('mt5-reporter.html','utf8'));const link=dom.window.document.querySelector('[download]');expect(fs.existsSync(link.getAttribute('href'))).toBe(true);dom.window.close();
});

/* ---- Reporter 1.10: open positions, account snapshot, merging ---- */
const HEADER='Ticket;Symbol;Type;Volume;Open Time;Close Time;Open Price;Close Price;Net Pnl;Account;Comment;Status;Stop Loss;Take Profit;Risk Money;Commission;Swap;Current Price;Floating Result;Server UTC Offset';
const ACC='FTMO-Demo / 1514878695 / USD';
const OPEN_ROW='FTMO-Demo:1514878695:7001;EURUSD;Long;0.25000000;2026.10.12 10:15:00;;1.17000000;;;'+ACC+';MT5 Reporter 1.10: open position;open;1.16800000;1.17400000;50.00;-0.75;0.00;1.17050000;11.75;10800';
const CLOSED_ROW='FTMO-Demo:1514878695:7001;EURUSD;Long;0.25000000;2026.10.12 10:15:00;2026.10.12 12:40:00;1.17000000;1.17400000;98.50;'+ACC+';MT5 Reporter 1.10: lots, server time, fully closed position;closed;1.16800000;1.17400000;50.00;-1.50;0.00;;;10800';
function importer(){const dom=new JSDOM('',{runScripts:'outside-only',url:'https://example.com/'});dom.window.eval(fs.readFileSync('src/js/import-tools.js','utf8'));return {dom,api:dom.window.BrokerCSVImporter};}

test('1.10 open position: broker facts, real UTC time, Prague day, session and planned risk are filled',()=>{
const {dom,api}=importer();const t=api.parse(HEADER+'\n'+OPEN_ROW+'\n','MT5_Journal_1514878695.csv')[0];
expect(t.status).toBe('open');expect(t.id).toBe('mt5_FTMO-Demo_1514878695_7001');expect(t.importRef).toBe('mt5:FTMO-Demo:1514878695:7001');
expect(t.entry).toBe('1.17');expect(t.exit).toBe('');expect(t.realizedPnl).toBe('');expect(t.volume).toBe('0.25');
expect(t.stopLoss).toBe('1.168');expect(t.takeProfit).toBe('1.174');expect(t.plannedRR).toBe('2');
expect(t.openedAt).toBe('2026-10-12T07:15:00.000Z');expect(t.closedAt).toBe('');expect(t.date).toBe('2026-10-12');expect(t.session).toBe('London');
expect(t.currentPrice).toBe(1.1705);expect(t.floatingResult).toBe(11.75);expect(t.riskMoney).toBe(50);expect(t.notes).toBe('');expect(t.fees).toBe('0.75');
dom.window.close();});

test('a header-only reporter file means "no positions yet", not an error; other brokers still need rows',()=>{
const {dom,api}=importer();expect(api.parse(HEADER+'\n','MT5_Journal_1.csv')).toHaveLength(0);expect(()=>api.parse('Symbol;Profit\n','binance.csv')).toThrow();dom.window.close();});

test('"Take Profit" and "Net Pnl" are never confused with the profit or T/P columns',()=>{
const {dom,api}=importer();const t=api.parse(HEADER+'\n'+CLOSED_ROW+'\n','MT5_Journal_1514878695.csv')[0];
expect(t.realizedPnl).toBe('98.5');expect(t.takeProfit).toBe('1.174');expect(t.exit).toBe('1.174');expect(t.status).toBe('closed');expect(t.closedAt).toBe('2026-10-12T09:40:00.000Z');expect(t.fees).toBe('1.5');
const old=api.parse('Ticket;Symbol;Type;Volume;Open Time;Close Time;Open Price;Close Price;Net Pnl;Account;Comment\nDemo:123:42;EURUSD;Short;0.20;2026.10.07 09:00:00;2026.10.07 11:00:00;1.17;1.16;195.5;Demo / 123 / USD;MT5 Reporter\n','MT5_Journal_123.csv')[0];
expect(old.takeProfit).toBe('');expect(old.fees).toBe('');dom.window.close();});

test('open then closed is one trade: facts update, the trader\'s notes and first stop survive',()=>{
const {dom,api}=importer();const file='MT5_Journal_1514878695.csv';
const first=api.mergeBrokerTrades([],api.parse(HEADER+'\n'+OPEN_ROW+'\n',file),{deposit:10000});
expect(first.added).toHaveLength(1);expect(first.updated).toHaveLength(0);const stored=first.added[0];
expect(stored.deposit).toBe('10000');expect(stored.plannedRiskPct).toBe('0.5');expect(stored.riskMoney).toBe(50);expect('mae' in stored).toBe(false);expect('legacyRef' in stored).toBe(false);
Object.assign(stored,{emotion:'Спокойствие',setup:'EMA pullback',entryReason:'откат к EMA 20',notes:'по плану',stopLoss:'1.168'});
const again=api.mergeBrokerTrades([stored],api.parse(HEADER+'\n'+OPEN_ROW+'\n',file),{deposit:10000});
expect(again.added).toHaveLength(0);expect(again.updated).toHaveLength(0);expect(again.live[0].values.currentPrice).toBe(1.1705);
const movedStop=CLOSED_ROW.replace(';closed;1.16800000;',';closed;1.17000000;');
const closed=api.mergeBrokerTrades([stored],api.parse(HEADER+'\n'+movedStop+'\n',file),{deposit:10000});
expect(closed.added).toHaveLength(0);expect(closed.updated).toHaveLength(1);const done=closed.updated[0];
expect(done.id).toBe(stored.id);expect(done.status).toBe('closed');expect(done.exit).toBe('1.174');expect(done.realizedPnl).toBe('98.5');expect(done.closedAt).toBe('2026-10-12T09:40:00.000Z');
expect(done.emotion).toBe('Спокойствие');expect(done.setup).toBe('EMA pullback');expect(done.entryReason).toBe('откат к EMA 20');expect(done.notes).toBe('по плану');expect(done.stopLoss).toBe('1.168');
const stale=api.mergeBrokerTrades([done],api.parse(HEADER+'\n'+OPEN_ROW+'\n',file),{deposit:10000});
expect(stale.added).toHaveLength(0);expect(stale.updated).toHaveLength(0);
const repeat=api.mergeBrokerTrades([done],api.parse(HEADER+'\n'+movedStop+'\n',file),{deposit:10000});
expect(repeat.updated).toHaveLength(0);dom.window.close();});

test('a trade imported by reporter 1.00 is recognised and enriched, never duplicated',()=>{
const {dom,api}=importer();const file='MT5_Journal_1514878695.csv';
const v100='Ticket;Symbol;Type;Volume;Open Time;Close Time;Open Price;Close Price;Net Pnl;Account;Comment\nFTMO-Demo:1514878695:7001;EURUSD;Long;0.25000000;2026.10.12 10:15:00;2026.10.12 12:40:00;1.17000000;1.17400000;98.50000000;'+ACC+';MT5 Reporter\n';
const legacy=api.parse(v100,file)[0];const existing={...legacy,id:'imp_old',importRef:legacy.legacyRef,emotion:'Уверенность',tags:['imported']};delete existing.legacyRef;
const merged=api.mergeBrokerTrades([existing],api.parse(HEADER+'\n'+CLOSED_ROW.replace(';98.50;',';98.50000000;')+'\n',file),{});
expect(merged.added).toHaveLength(0);expect(merged.updated).toHaveLength(1);const t=merged.updated[0];
expect(t.id).toBe('imp_old');expect(t.emotion).toBe('Уверенность');expect(t.stopLoss).toBe('1.168');expect(t.openedAt).toBe('2026-10-12T07:15:00.000Z');expect(t.session).toBe('London');dom.window.close();});

test('account snapshot is parsed; a file that is not one is rejected',()=>{
const {dom,api}=importer();const text='Key;Value\r\nReporter;1.10\r\nLogin;1514878695\r\nServer;FTMO-Demo\r\nCurrency;USD\r\nTradeMode;demo\r\nBalance;9950.00\r\nEquity;9961.75\r\nInitialBalance;10000.00\r\nDayStartBalance;10000.00\r\nDayClosedResult;-50.00\r\nDayTrades;2\r\nOpenPositions;1\r\nOpenRisk;61.75\r\nOpenWithoutStop;0\r\nFloatingResult;11.75\r\nServerUtcOffset;10800\r\nUpdatedUtc;2026.10.12 07:20:05\r\n';
const a=api.parseAccount(text);expect(a.login).toBe('1514878695');expect(a.balance).toBe(9950);expect(a.equity).toBe(9961.75);expect(a.initialBalance).toBe(10000);expect(a.dayStartBalance).toBe(10000);expect(a.dayClosedResult).toBe(-50);expect(a.dayTrades).toBe(2);expect(a.openRisk).toBe(61.75);expect(a.updatedAt).toBe('2026-10-12T07:20:05.000Z');
expect(api.isAccountFile('MT5_Account_1.csv','')).toBe(true);expect(api.isAccountFile('x.csv',HEADER)).toBe(false);expect(()=>api.parseAccount(HEADER)).toThrow();dom.window.close();});

test('reporter 1.10 source stays read-only and writes both files atomically',()=>{
const s=fs.readFileSync('downloads/mt5/TK_Journal_Reporter.mq5','utf8');
expect(s).not.toMatch(/\b(OrderSend|OrderSendAsync|OrderModify|PositionClose|PositionModify|WebRequest|CTrade|SocketConnect|SendMail|SendFTP)\s*\(/);
expect(s).toContain('#property version   "1.20"');expect(s).toContain(HEADER+';MAE;MFE"');expect(s).toContain('ChartScreenShot(');expect(s).toContain('CopyRates(');expect(s).toContain('"MT5_Shot_"');expect(s).toContain('MT5_Quotes_');expect(s).toContain('Symbol;Bid;Ask;Digits;Group;Description;Server Time');expect(s).toContain(HEADER);expect(s).toContain('MT5_Account_');expect(s).toContain('FileMove(');expect(s).toContain('DEAL_TYPE_CREDIT');
const braces=(s.match(/\{/g)||[]).length-(s.match(/\}/g)||[]).length,parens=(s.match(/\(/g)||[]).length-(s.match(/\)/g)||[]).length;expect(braces).toBe(0);expect(parens).toBe(0);});

test('reporter 1.20: risk at entry is kept once, MAE and MFE are saved only when the position has closed',()=>{
const {dom,api}=importer();const file='MT5_Journal_1514878695.csv',H=HEADER+';MAE;MFE';
const open=api.parse(H+'\n'+OPEN_ROW+';30.00;12.50\n',file);expect(open[0].mae).toBe(30);expect(open[0].mfe).toBe(12.5);
const first=api.mergeBrokerTrades([],open,{deposit:10000});const stored=first.added[0];
expect(stored.riskMoney).toBe(50);expect('mae' in stored).toBe(false);expect(first.live[0].values.mfe).toBe(12.5);
// The floating extremes move with every tick; they must not trigger a save while the position is open.
const moving=api.mergeBrokerTrades([stored],api.parse(H+'\n'+OPEN_ROW+';35.00;60.00\n',file),{deposit:10000});expect(moving.updated).toHaveLength(0);
const closed=api.mergeBrokerTrades([stored],api.parse(H+'\n'+CLOSED_ROW.replace(';closed;1.16800000;',';closed;1.17000000;').replace(';50.00;',';25.00;')+';35.00;110.00\n',file),{deposit:10000});
const done=closed.updated[0];expect(done.mae).toBe(35);expect(done.mfe).toBe(110);expect(done.riskMoney).toBe(50);
expect(api.mergeBrokerTrades([done],api.parse(H+'\n'+CLOSED_ROW+';35.00;110.00\n',file),{deposit:10000}).updated).toHaveLength(0);
// A file from an older reporter, without the two columns, changes nothing.
expect(api.mergeBrokerTrades([done],api.parse(HEADER+'\n'+CLOSED_ROW+'\n',file),{deposit:10000}).updated).toHaveLength(0);
// A trade synced before 1.20 has no stored risk: the next sync fills it in.
const old={...done};delete old.riskMoney;delete old.mae;delete old.mfe;
const filled=api.mergeBrokerTrades([old],api.parse(H+'\n'+CLOSED_ROW+';35.00;110.00\n',file),{deposit:10000}).updated;expect(filled).toHaveLength(1);expect(filled[0].riskMoney).toBe(50);expect(filled[0].mae).toBe(35);
dom.window.close();});
