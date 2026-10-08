#property strict
#property version "1.00"
#property description "Read-only closed-position reporter. No trade requests or network calls."
input int RefreshSeconds=60;
input datetime HistoryFrom=D'2020.01.01 00:00';
bool dirty=true;
long boundLogin;
string boundServer;
string Safe(string s){StringReplace(s,";","_");StringReplace(s,"\r"," ");StringReplace(s,"\n"," ");StringReplace(s,"\"","'");return s;}
string Stamp(datetime t){return TimeToString(t,TIME_DATE|TIME_SECONDS);}
int OnInit(){boundLogin=AccountInfoInteger(ACCOUNT_LOGIN);boundServer=AccountInfoString(ACCOUNT_SERVER);EventSetTimer(MathMax(10,RefreshSeconds));return INIT_SUCCEEDED;}
void OnDeinit(const int reason){EventKillTimer();Comment("");}
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result){dirty=true;}
void OnTimer(){
 if(AccountInfoInteger(ACCOUNT_LOGIN)!=boundLogin||AccountInfoString(ACCOUNT_SERVER)!=boundServer){Comment("Journal Reporter: account changed. Reattach reporter.");return;}
 if(!TerminalInfoInteger(TERMINAL_CONNECTED))return;
 if(!dirty)return;
 if(!HistorySelect(HistoryFrom,TimeCurrent())){Print("Journal Reporter: history unavailable");return;}
 ulong ids[];int n=0,total=HistoryDealsTotal();
 for(int i=0;i<total;i++){ulong deal=HistoryDealGetTicket(i);long type=HistoryDealGetInteger(deal,DEAL_TYPE);if(type!=DEAL_TYPE_BUY&&type!=DEAL_TYPE_SELL)continue;ulong id=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);bool exists=false;for(int j=0;j<n;j++)if(ids[j]==id){exists=true;break;}if(!exists&&id>0){ArrayResize(ids,n+1);ids[n++]=id;}}
 string filename="MT5_Journal_"+IntegerToString(boundLogin)+".csv";
 int f=FileOpen(filename,FILE_WRITE|FILE_CSV|FILE_ANSI,';',CP_UTF8);
 if(f==INVALID_HANDLE){Print("Journal Reporter: cannot write CSV, error ",GetLastError());return;}
 FileWrite(f,"Ticket","Symbol","Type","Volume","Open Time","Close Time","Open Price","Close Price","Net Pnl","Account","Comment");
 int exported=0,skipped=0;
 for(int i=0;i<n;i++){
  ulong id=ids[i];bool active=false;
  for(int j=0;j<PositionsTotal();j++){ulong ticket=PositionGetTicket(j);if(ticket>0&&(ulong)PositionGetInteger(POSITION_IDENTIFIER)==id){active=true;break;}}
  if(active){skipped++;continue;}
  if(!HistorySelectByPosition(id)){skipped++;continue;}
  double vin=0,vout=0,entrySum=0,exitSum=0,net=0;datetime opened=0,closed=0;string symbol="",side="";bool supported=true;
  for(int j=0;j<HistoryDealsTotal();j++){
   ulong deal=HistoryDealGetTicket(j);long type=HistoryDealGetInteger(deal,DEAL_TYPE),entry=HistoryDealGetInteger(deal,DEAL_ENTRY);datetime tm=(datetime)HistoryDealGetInteger(deal,DEAL_TIME);
   if(type!=DEAL_TYPE_BUY&&type!=DEAL_TYPE_SELL){supported=false;continue;}
   if(entry==DEAL_ENTRY_INOUT){supported=false;continue;}
   double vol=HistoryDealGetDouble(deal,DEAL_VOLUME),price=HistoryDealGetDouble(deal,DEAL_PRICE);
   net+=HistoryDealGetDouble(deal,DEAL_PROFIT)+HistoryDealGetDouble(deal,DEAL_COMMISSION)+HistoryDealGetDouble(deal,DEAL_SWAP)+HistoryDealGetDouble(deal,DEAL_FEE);
   symbol=HistoryDealGetString(deal,DEAL_SYMBOL);
   if(entry==DEAL_ENTRY_IN){string direction=type==DEAL_TYPE_BUY?"Long":"Short";if(side!=""&&side!=direction)supported=false;side=direction;vin+=vol;entrySum+=vol*price;if(opened==0||tm<opened)opened=tm;}
   else if(entry==DEAL_ENTRY_OUT||entry==DEAL_ENTRY_OUT_BY){vout+=vol;exitSum+=vol*price;if(tm>closed)closed=tm;}
   else supported=false;
  }
  if(!supported||vin<=0||vout<=0||MathAbs(vin-vout)>0.00000001||opened<HistoryFrom){skipped++;continue;}
  string reference=Safe(boundServer)+":"+IntegerToString(boundLogin)+":"+IntegerToString((long)id);
  string account=Safe(boundServer)+" / "+IntegerToString(boundLogin)+" / "+Safe(AccountInfoString(ACCOUNT_CURRENCY));
  FileWrite(f,reference,Safe(symbol),side,DoubleToString(vin,8),Stamp(opened),Stamp(closed),DoubleToString(entrySum/vin,8),DoubleToString(exitSum/vout,8),DoubleToString(net,8),account,"MT5 Reporter: lots; broker server time; fully closed position; verify separate account charges");exported++;
 }
 FileFlush(f);FileClose(f);dirty=false;
 Comment("Journal Reporter v1.00 | READ ONLY\n",filename,"\nExported: ",exported," | Skipped/open/unsupported: ",skipped,"\nFile > Open Data Folder > MQL5 > Files\nLast export: ",TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS));
 Print("Journal Reporter: CSV ready. Exported=",exported," skipped=",skipped);
}
