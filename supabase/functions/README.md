# Supabase Edge Functions

Production functions used by the personal Trading OS.

| Function | Purpose | Auth |
|---|---|---|
| `journal-review` | Server-calculated trade/history/weekly analysis, private images, saved reviews | Supabase user JWT + Auth validation |
| `market-data` | Normalizes public candles from Binance, Bybit, OKX and Kraken | Public / read-only |
| `market-alerts` | Scheduled price + prop-risk checks | Internal cron key |
| `telegram-bot` | Private Telegram command webhook | Telegram webhook secret |
| `telegram-register` | Registers Telegram webhook + commands | Supabase user JWT |
| `ctrader-connect` | Starts cTrader OAuth with `accounts` read-only scope | Supabase user JWT |
| `ctrader-callback` | Exchanges cTrader OAuth code and stores token server-side | OAuth callback |

## Required secrets

### Telegram

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`

### cTrader

- `CTRADER_CLIENT_ID`
- `CTRADER_CLIENT_SECRET`

The cTrader redirect URL is:

```text
https://fzaawuwfpewqfkwmobpj.supabase.co/functions/v1/ctrader-callback
```

Register that exact URL in the approved cTrader Open API application.

## Security model

- Browser code never receives broker private secrets.
- cTrader uses OAuth `accounts` scope (view-only).
- Dynamic OAuth access/refresh tokens are stored in the non-public `private` schema.
- Exchange public-market adapters require no private key.
- Trading execution is intentionally outside this repository's automation layer.

### Journal AI review

- `OPENAI_API_KEY`: required, server-only.
- `JOURNAL_REVIEW_MODEL`: optional; default `gpt-4.1-mini` (vision + JSON).

The implementation and tests are committed under `journal-review/`. Deploy with JWT verification enabled. Each request is scoped by the authenticated user and RLS. Settings status checks key presence, not provider billing or model availability.
