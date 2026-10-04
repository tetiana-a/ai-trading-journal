# 🔌 Official Integrations

AI Trading Journal follows a **read-only first** integration policy.

The application may read market/account history, import statements, calculate risk and send alerts. It does **not** automatically place live orders.

## Free market-data adapters

| Provider | Status | Auth | Use |
|---|---|---|---|
| Binance | ✅ Live | None | Public candles / prices |
| Bybit | ✅ Live | None | V5 public candles |
| OKX | ✅ Live | None | V5 public candles |
| Kraken | ✅ Live | None | Public OHLC |

The browser uses a normalized Supabase Edge Function so all four providers return the same candle shape.

## Account / broker history

| Platform | Integration path | Status |
|---|---|---|
| MetaTrader 5 | CSV statement import today; local read-only bridge can be added | ✅ CSV |
| cTrader | Official Open API OAuth with `accounts` (view-only) scope | 🟡 Requires cTrader app credentials |
| FTMO | Import / connect through the actual trading platform used by the FTMO account | ✅ CSV / platform dependent |
| The5ers | Import / connect through the underlying platform | ✅ CSV / platform dependent |
| iTrade | Import / connect through the underlying platform | ✅ CSV / platform dependent |
| FundedNext | Import / connect through the underlying platform | ✅ CSV / platform dependent |

## Universal Broker CSV importer

The Journal can detect common statement fields such as:

- ticket / order / deal ID
- symbol
- buy / sell
- volume / lots
- open / close time
- entry / exit price
- SL / TP
- profit / net PNL
- commission
- swap / funding
- comment
- strategy / account

When broker-reported net PNL exists, it is preserved instead of recomputing CFD/FX profit with a crypto-style formula.

## Secret handling

Never put private exchange/broker credentials in frontend JavaScript.

Recommended patterns:

1. **OAuth** when the provider supports it.
2. **Read-only API key** stored only on a backend.
3. **Statement/CSV import** when no reliable API is available.
4. Avoid `Trade` / `Withdraw` permission for analytics integrations.

## cTrader

cTrader Open API supports OAuth. For an analytics-only integration, request the `accounts` scope rather than `trading`. That gives account/statistics access without permission to execute trades.

## MetaTrader 5

MetaTrader 5 provides official APIs for positions, orders and deal history. A future local bridge can sync `history_deals_get` / `positions_get` into Supabase while keeping terminal access on the user's own computer.

---

This layer is intentionally separated from execution. **Analytics should never require live-order permissions.**
