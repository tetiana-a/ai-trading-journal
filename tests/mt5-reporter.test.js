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
