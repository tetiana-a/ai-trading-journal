//+------------------------------------------------------------------+
//| TK Journal Reporter 1.10                                         |
//| Writes two CSV files for the trading journal:                    |
//|   MT5_Journal_<login>.csv  open and fully closed positions       |
//|   MT5_Account_<login>.csv  balance, equity and day-start figures |
//| Read-only: sends no orders, changes nothing, makes no network    |
//| calls. Algo Trading, DLL and WebRequest are not needed.          |
//+------------------------------------------------------------------+
#property strict
#property version   "1.10"
#property description "Read-only reporter: open and closed positions plus an account snapshot, as CSV."
#property description "No trade requests and no network calls."

input int      RefreshSeconds = 15;                    // Rewrite the files every N seconds (minimum 5)
input datetime HistoryFrom    = D'2020.01.01 00:00';   // Ignore positions opened before this moment
input int      DayResetHour   = -1;                    // Trading day starts at this server hour; -1 = midnight Prague time (FTMO)

#define REPORTER_VERSION "1.10"
#define JOURNAL_HEADER   "Ticket;Symbol;Type;Volume;Open Time;Close Time;Open Price;Close Price;Net Pnl;Account;Comment;Status;Stop Loss;Take Profit;Risk Money;Commission;Swap;Current Price;Floating Result;Server UTC Offset"

long   boundLogin   = 0;
string boundServer  = "";
bool   historyDirty = true;   // set whenever a trade event arrives; closed rows are rebuilt only then
string closedRows[];          // cached CSV lines for closed positions
int    closedCount  = 0;
int    skippedCount = 0;
int    previousOpen = -1;     // open positions seen on the last cycle
int    cycles       = 0;

//--- text helpers ---------------------------------------------------
string Safe(string s)
  {
   StringReplace(s, ";", "_");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\"", "'");
   return s;
  }

string Stamp(datetime t)
  {
   return TimeToString(t, TIME_DATE | TIME_SECONDS);
  }

string Num(double value)
  {
   return DoubleToString(value, 8);
  }

string Money(double value)
  {
   return DoubleToString(value, 2);
  }

string PositionReference(ulong positionId)
  {
   return Safe(boundServer) + ":" + IntegerToString(boundLogin) + ":" + IntegerToString((long)positionId);
  }

string AccountLabel()
  {
   return Safe(boundServer) + " / " + IntegerToString(boundLogin) + " / " + Safe(AccountInfoString(ACCOUNT_CURRENCY));
  }

//--- time helpers ---------------------------------------------------
// Seconds the trade server is ahead of UTC. Rounded to 15 minutes because the two clocks are read a moment apart.
int ServerUtcOffset()
  {
   long diff = (long)TimeTradeServer() - (long)TimeGMT();
   return (int)(MathRound((double)diff / 900.0) * 900.0);
  }

// Last Sunday of the month at 01:00 UTC: the moment European summer time starts (March) or ends (October).
datetime EuropeanClockChange(int year, int month)
  {
   MqlDateTime parts;
   ZeroMemory(parts);
   parts.year = year;
   parts.mon  = month;
   parts.day  = 31;
   parts.hour = 1;
   datetime lastDay = StructToTime(parts);
   MqlDateTime check;
   TimeToStruct(lastDay, check);
   return (datetime)((long)lastDay - (long)check.day_of_week * 86400);   // day_of_week: 0 = Sunday
  }

// Seconds Prague (CET/CEST) is ahead of UTC at the given UTC moment.
int PragueUtcOffset(datetime utc)
  {
   MqlDateTime parts;
   TimeToStruct(utc, parts);
   bool summer = (utc >= EuropeanClockChange(parts.year, 3) && utc < EuropeanClockChange(parts.year, 10));
   return summer ? 7200 : 3600;
  }

// Start of the current trading day, expressed in server time.
datetime DayStartServer()
  {
   datetime nowServer = TimeTradeServer();
   if(DayResetHour >= 0 && DayResetHour <= 23)
     {
      MqlDateTime parts;
      TimeToStruct(nowServer, parts);
      parts.hour = DayResetHour;
      parts.min  = 0;
      parts.sec  = 0;
      datetime start = StructToTime(parts);
      if(start > nowServer)
         start = (datetime)((long)start - 86400);
      return start;
     }
   long serverOffset   = ServerUtcOffset();
   long utc            = (long)nowServer - serverOffset;
   long pragueOffset   = PragueUtcOffset((datetime)utc);
   long prague         = utc + pragueOffset;
   long pragueMidnight = prague - (prague % 86400);
   return (datetime)(pragueMidnight - pragueOffset + serverOffset);
  }

//--- money helpers --------------------------------------------------
double DealNet(ulong deal)
  {
   return HistoryDealGetDouble(deal, DEAL_PROFIT) + HistoryDealGetDouble(deal, DEAL_COMMISSION)
          + HistoryDealGetDouble(deal, DEAL_SWAP) + HistoryDealGetDouble(deal, DEAL_FEE);
  }

// Result in account currency if the position were closed at `price`. Calculation only: nothing is sent to the server.
bool ProfitAt(string symbol, bool isLong, double volume, double openPrice, double price, double &profit)
  {
   profit = 0;
   if(volume <= 0 || openPrice <= 0 || price <= 0)
      return false;
   return OrderCalcProfit(isLong ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, symbol, volume, openPrice, price, profit);
  }

// Money lost if the stop is hit, measured from the entry price. 0 when there is no stop or it already locks in a profit.
double RiskMoney(string symbol, bool isLong, double volume, double openPrice, double stop)
  {
   double profit = 0;
   if(!ProfitAt(symbol, isLong, volume, openPrice, stop, profit))
      return 0;
   return profit < 0 ? -profit : 0;
  }

//--- files ----------------------------------------------------------
// Write to a temporary file first, then replace the real one in a single step,
// so the journal never reads a half-written file.
bool WriteLines(string fileName, string &lines[], int count)
  {
   string temporary = "tmp_" + fileName;
   int handle = FileOpen(temporary, FILE_WRITE | FILE_TXT | FILE_ANSI, '\t', CP_UTF8);
   if(handle == INVALID_HANDLE)
     {
      Print("Journal Reporter: cannot write ", temporary, ", error ", GetLastError());
      return false;
     }
   for(int i = 0; i < count; i++)
      FileWriteString(handle, lines[i] + "\r\n");
   FileClose(handle);
   if(!FileMove(temporary, 0, fileName, FILE_REWRITE))
     {
      Print("Journal Reporter: cannot replace ", fileName, ", error ", GetLastError(), ". Is it open in another program?");
      return false;
     }
   return true;
  }

//--- closed positions -----------------------------------------------
bool IsPositionOpen(ulong positionId)
  {
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && (ulong)PositionGetInteger(POSITION_IDENTIFIER) == positionId)
         return true;
     }
   return false;
  }

// Rebuild the cached rows for fully closed positions. Runs only after a trade event.
bool RebuildClosedRows()
  {
   if(!HistorySelect(HistoryFrom, TimeTradeServer() + 86400))
     {
      Print("Journal Reporter: history unavailable");
      return false;
     }
   ulong ids[];
   int   idCount = 0;
   int   dealCount = HistoryDealsTotal();
   for(int i = 0; i < dealCount; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      long  type = HistoryDealGetInteger(deal, DEAL_TYPE);
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL)
         continue;
      ulong id = (ulong)HistoryDealGetInteger(deal, DEAL_POSITION_ID);
      if(id == 0)
         continue;
      bool known = false;
      for(int j = 0; j < idCount; j++)
         if(ids[j] == id)
           {
            known = true;
            break;
           }
      if(!known)
        {
         ArrayResize(ids, idCount + 1);
         ids[idCount++] = id;
        }
     }

   string account = AccountLabel();
   string offset  = IntegerToString(ServerUtcOffset());
   ArrayResize(closedRows, 0);
   closedCount  = 0;
   skippedCount = 0;

   for(int i = 0; i < idCount; i++)
     {
      ulong id = ids[i];
      if(IsPositionOpen(id))
         continue;   // written separately, as an open row
      if(!HistorySelectByPosition(id))
        {
         skippedCount++;
         continue;
        }
      double   volumeIn = 0, volumeOut = 0, entrySum = 0, exitSum = 0, net = 0, commission = 0, swap = 0;
      double   entryStop = 0, entryTarget = 0, exitStop = 0, exitTarget = 0;
      datetime opened = 0, closed = 0;
      string   symbol = "", side = "";
      bool     supported = true;
      int      deals = HistoryDealsTotal();
      for(int j = 0; j < deals; j++)
        {
         ulong    deal  = HistoryDealGetTicket(j);
         long     type  = HistoryDealGetInteger(deal, DEAL_TYPE);
         long     entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
         datetime when  = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
         if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL)
           {
            supported = false;
            continue;
           }
         if(entry == DEAL_ENTRY_INOUT)   // a reversal cannot be shown as one position
           {
            supported = false;
            continue;
           }
         double volume = HistoryDealGetDouble(deal, DEAL_VOLUME);
         double price  = HistoryDealGetDouble(deal, DEAL_PRICE);
         net        += DealNet(deal);
         commission += HistoryDealGetDouble(deal, DEAL_COMMISSION) + HistoryDealGetDouble(deal, DEAL_FEE);
         swap       += HistoryDealGetDouble(deal, DEAL_SWAP);
         symbol      = HistoryDealGetString(deal, DEAL_SYMBOL);
         if(entry == DEAL_ENTRY_IN)
           {
            string direction = (type == DEAL_TYPE_BUY) ? "Long" : "Short";
            if(side != "" && side != direction)
               supported = false;
            side = direction;
            volumeIn += volume;
            entrySum += volume * price;
            if(opened == 0 || when < opened)
              {
               opened      = when;
               entryStop   = HistoryDealGetDouble(deal, DEAL_SL);
               entryTarget = HistoryDealGetDouble(deal, DEAL_TP);
              }
           }
         else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
           {
            volumeOut += volume;
            exitSum   += volume * price;
            if(when >= closed)
              {
               closed     = when;
               exitStop   = HistoryDealGetDouble(deal, DEAL_SL);
               exitTarget = HistoryDealGetDouble(deal, DEAL_TP);
              }
           }
         else
            supported = false;
        }
      if(!supported || volumeIn <= 0 || volumeOut <= 0 || MathAbs(volumeIn - volumeOut) > 0.00000001 || opened < HistoryFrom)
        {
         skippedCount++;
         continue;
        }
      // The stop set at entry is the planned risk. If it was added later, fall back to the last known one.
      double stop      = entryStop > 0 ? entryStop : exitStop;
      double target    = entryTarget > 0 ? entryTarget : exitTarget;
      double openPrice = entrySum / volumeIn;
      double risk      = RiskMoney(symbol, side == "Long", volumeIn, openPrice, stop);

      string row = PositionReference(id) + ";" + Safe(symbol) + ";" + side + ";" + Num(volumeIn) + ";"
                   + Stamp(opened) + ";" + Stamp(closed) + ";" + Num(openPrice) + ";" + Num(exitSum / volumeOut) + ";"
                   + Num(net) + ";" + account + ";MT5 Reporter " + REPORTER_VERSION + ": lots, server time, fully closed position;closed;"
                   + (stop > 0 ? Num(stop) : "") + ";" + (target > 0 ? Num(target) : "") + ";" + (risk > 0 ? Money(risk) : "") + ";"
                   + Money(commission) + ";" + Money(swap) + ";;;" + offset;
      ArrayResize(closedRows, closedCount + 1);
      closedRows[closedCount++] = row;
     }
   return true;
  }

//--- open positions -------------------------------------------------
// Build one row per open position. Also totals what the account file needs.
int BuildOpenRows(string &rows[], double &openRisk, int &withoutStop, double &floating)
  {
   string account = AccountLabel();
   string offset  = IntegerToString(ServerUtcOffset());
   int    count   = 0;
   openRisk    = 0;
   withoutStop = 0;
   floating    = 0;
   ArrayResize(rows, 0);

   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);   // also selects the position
      if(ticket == 0)
         continue;
      // Read everything about the position before touching history.
      ulong    id        = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
      string   symbol    = PositionGetString(POSITION_SYMBOL);
      bool     isLong    = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
      double   volume    = PositionGetDouble(POSITION_VOLUME);
      double   openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double   stop      = PositionGetDouble(POSITION_SL);
      double   target    = PositionGetDouble(POSITION_TP);
      double   current   = PositionGetDouble(POSITION_PRICE_CURRENT);
      double   profit    = PositionGetDouble(POSITION_PROFIT);
      double   swap      = PositionGetDouble(POSITION_SWAP);
      datetime opened    = (datetime)PositionGetInteger(POSITION_TIME);

      // Commission so far and the stop that was set at entry come from the position's own deals.
      double commission = 0, entryStop = 0, entryTarget = 0;
      if(HistorySelectByPosition(id))
        {
         datetime first = 0;
         int deals = HistoryDealsTotal();
         for(int j = 0; j < deals; j++)
           {
            ulong deal = HistoryDealGetTicket(j);
            commission += HistoryDealGetDouble(deal, DEAL_COMMISSION) + HistoryDealGetDouble(deal, DEAL_FEE);
            datetime when = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
            if(HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN && (first == 0 || when < first))
              {
               first       = when;
               entryStop   = HistoryDealGetDouble(deal, DEAL_SL);
               entryTarget = HistoryDealGetDouble(deal, DEAL_TP);
              }
           }
        }
      double plannedStop   = entryStop > 0 ? entryStop : stop;
      double plannedTarget = entryTarget > 0 ? entryTarget : target;
      double risk          = RiskMoney(symbol, isLong, volume, openPrice, plannedStop);

      // Extra loss from where the price is now down to the current stop: what the prop limits care about.
      if(stop > 0)
        {
         double atStop = 0;
         if(ProfitAt(symbol, isLong, volume, openPrice, stop, atStop))
            openRisk += MathMax(0.0, profit - atStop);
        }
      else
         withoutStop++;
      double result = profit + swap + commission;
      floating += result;

      string row = PositionReference(id) + ";" + Safe(symbol) + ";" + (isLong ? "Long" : "Short") + ";" + Num(volume) + ";"
                   + Stamp(opened) + ";;" + Num(openPrice) + ";;;" + account + ";MT5 Reporter " + REPORTER_VERSION + ": open position;open;"
                   + (plannedStop > 0 ? Num(plannedStop) : "") + ";" + (plannedTarget > 0 ? Num(plannedTarget) : "") + ";"
                   + (risk > 0 ? Money(risk) : "") + ";" + Money(commission) + ";" + Money(swap) + ";"
                   + Num(current) + ";" + Money(result) + ";" + offset;
      ArrayResize(rows, count + 1);
      rows[count++] = row;
     }
   return count;
  }

//--- account snapshot -----------------------------------------------
bool WriteAccount(int openCount, double openRisk, int withoutStop, double floating, double &dayResult, double &initialBalance)
  {
   dayResult      = 0;
   initialBalance = 0;
   datetime dayStart = DayStartServer();
   double   sinceDayStart = 0;   // trading results and charges since the day began
   int      dayTrades = 0;
   ulong    dayIds[];

   if(HistorySelect(0, TimeTradeServer() + 86400))
     {
      bool haveInitial = false;
      int  deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
        {
         ulong    deal = HistoryDealGetTicket(i);
         long     type = HistoryDealGetInteger(deal, DEAL_TYPE);
         datetime when = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
         if(type == DEAL_TYPE_BALANCE && !haveInitial)
           {
            initialBalance = HistoryDealGetDouble(deal, DEAL_PROFIT);   // the first deposit is the account size
            haveInitial = true;
           }
         if(when < dayStart)
            continue;
         // Deposits and credits are not trading results: on the day the account is funded,
         // the day-start balance must be the funded amount, not zero.
         if(type == DEAL_TYPE_BALANCE || type == DEAL_TYPE_CREDIT)
            continue;
         sinceDayStart += DealNet(deal);
         if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL)
            continue;
         dayResult += DealNet(deal);
         if(HistoryDealGetInteger(deal, DEAL_ENTRY) != DEAL_ENTRY_IN)
            continue;
         ulong id = (ulong)HistoryDealGetInteger(deal, DEAL_POSITION_ID);
         bool known = false;
         for(int j = 0; j < dayTrades; j++)
            if(dayIds[j] == id)
              {
               known = true;
               break;
              }
         if(!known)
           {
            ArrayResize(dayIds, dayTrades + 1);
            dayIds[dayTrades++] = id;
           }
        }
     }

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   long   mode    = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string modeText = (mode == ACCOUNT_TRADE_MODE_DEMO) ? "demo" : (mode == ACCOUNT_TRADE_MODE_CONTEST) ? "contest" : "real";
   int    offset  = ServerUtcOffset();

   string lines[];
   ArrayResize(lines, 24);
   int n = 0;
   lines[n++] = "Key;Value";
   lines[n++] = "Reporter;" + REPORTER_VERSION;
   lines[n++] = "Login;" + IntegerToString(boundLogin);
   lines[n++] = "Server;" + Safe(boundServer);
   lines[n++] = "Company;" + Safe(AccountInfoString(ACCOUNT_COMPANY));
   lines[n++] = "Currency;" + Safe(AccountInfoString(ACCOUNT_CURRENCY));
   lines[n++] = "Leverage;" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE));
   lines[n++] = "TradeMode;" + modeText;
   lines[n++] = "Balance;" + Money(balance);
   lines[n++] = "Equity;" + Money(AccountInfoDouble(ACCOUNT_EQUITY));
   lines[n++] = "Margin;" + Money(AccountInfoDouble(ACCOUNT_MARGIN));
   lines[n++] = "FreeMargin;" + Money(AccountInfoDouble(ACCOUNT_MARGIN_FREE));
   lines[n++] = "InitialBalance;" + Money(initialBalance);
   lines[n++] = "DayStartBalance;" + Money(balance - sinceDayStart);
   lines[n++] = "DayStartServerTime;" + Stamp(dayStart);
   lines[n++] = "DayClosedResult;" + Money(dayResult);
   lines[n++] = "DayTrades;" + IntegerToString(dayTrades);
   lines[n++] = "OpenPositions;" + IntegerToString(openCount);
   lines[n++] = "OpenRisk;" + Money(openRisk);
   lines[n++] = "OpenWithoutStop;" + IntegerToString(withoutStop);
   lines[n++] = "FloatingResult;" + Money(floating);
   lines[n++] = "ServerTime;" + Stamp(TimeTradeServer());
   lines[n++] = "ServerUtcOffset;" + IntegerToString(offset);
   lines[n++] = "UpdatedUtc;" + Stamp(TimeGMT());
   return WriteLines("MT5_Account_" + IntegerToString(boundLogin) + ".csv", lines, n);
  }

//--- main cycle -----------------------------------------------------
void Export()
  {
   if(AccountInfoInteger(ACCOUNT_LOGIN) != boundLogin || AccountInfoString(ACCOUNT_SERVER) != boundServer)
     {
      Comment("Journal Reporter: the account changed. Remove the reporter from the chart and attach it again.");
      return;
     }
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
      return;

   // Trade events normally mark the history as changed. Two safety nets: a change in the number of
   // open positions, and a full re-read every 20 cycles in case history arrived late after a restart.
   int openNow = PositionsTotal();
   if(openNow != previousOpen || ++cycles % 20 == 0)
      historyDirty = true;
   previousOpen = openNow;

   bool closedChanged = false;
   if(historyDirty)
     {
      if(!RebuildClosedRows())
         return;
      historyDirty  = false;
      closedChanged = true;
     }

   string openRows[];
   double openRisk = 0, floating = 0;
   int    withoutStop = 0;
   int    openCount = BuildOpenRows(openRows, openRisk, withoutStop, floating);

   // Closed rows change only on a trade event; open rows carry live prices, so they are rewritten every cycle.
   string journalFile = "MT5_Journal_" + IntegerToString(boundLogin) + ".csv";
   if(closedChanged || openCount > 0)
     {
      string lines[];
      ArrayResize(lines, 1 + closedCount + openCount);
      int n = 0;
      lines[n++] = JOURNAL_HEADER;
      for(int i = 0; i < closedCount; i++)
         lines[n++] = closedRows[i];
      for(int i = 0; i < openCount; i++)
         lines[n++] = openRows[i];
      if(!WriteLines(journalFile, lines, n))
         historyDirty = true;   // try the whole file again on the next cycle
     }

   double dayResult = 0, initialBalance = 0;
   WriteAccount(openCount, openRisk, withoutStop, floating, dayResult, initialBalance);

   string dayText = Money(dayResult) + " " + AccountInfoString(ACCOUNT_CURRENCY);
   if(initialBalance > 0)
      dayText += " (" + DoubleToString(dayResult / initialBalance * 100.0, 2) + "% of " + Money(initialBalance) + ")";
   Comment("TK Journal Reporter v", REPORTER_VERSION, " | READ ONLY\n",
           AccountLabel(), "\n",
           "Open: ", openCount, " | Closed: ", closedCount, " | Skipped: ", skippedCount, "\n",
           "Closed result today: ", dayText, "\n",
           "Risk to current stops: ", Money(openRisk), (withoutStop > 0 ? " | WITHOUT STOP: " + IntegerToString(withoutStop) : ""), "\n",
           "Files: File > Open Data Folder > MQL5 > Files\n",
           "Updated: ", Stamp(TimeTradeServer()), " server time");
  }

int OnInit()
  {
   boundLogin  = AccountInfoInteger(ACCOUNT_LOGIN);
   boundServer = AccountInfoString(ACCOUNT_SERVER);
   EventSetTimer(MathMax(5, RefreshSeconds));
   Export();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
  {
   historyDirty = true;
  }

void OnTimer()
  {
   Export();
  }
//+------------------------------------------------------------------+
