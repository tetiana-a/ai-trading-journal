/**
 * market-api.js — Market data with timeouts and error handling: quotes from MT5 Reporter,
 * Coinbase and Binance, plus CryptoCompare prices and news for the AI review.
 */

const API_TIMEOUT_MS = 8000;

/**
 * Strip suffixes to get a clean base symbol for CryptoCompare.
 * @param {string} ticker
 * @returns {string}
 */
function cleanTicker(ticker) {
  let t = ticker.toUpperCase();
  t = t.replace(/USDT|USD|BUSD|PERP|USDC|T/g, '');
  t = t.replace(/[^A-Z0-9]/g, '');
  return t;
}

/* ===== Quotes for any asset =====
 * Three sources, tried in this order:
 *   1. MT5 Reporter  — the broker's own bid/ask for the symbols on the trader's account (exact).
 *   2. Coinbase      — public exchange rates for currency pairs (indicative mid rate, not a broker quote).
 *   3. Binance       — spot prices for crypto; tokenised gold (PAXG) stands in for XAUUSD (approximate).
 * Index and commodity CFDs have no free public feed: they are priced only through MT5.
 */
const QUOTE_CACHE_MS = 15000;
const MT5_FRESH_MS = 180000;
const FIAT_CODES = new Set(['USD','EUR','GBP','JPY','CHF','AUD','CAD','NZD','CZK','PLN','SEK','NOK','DKK','HUF','TRY','ZAR','MXN','SGD','HKD','CNY','CNH','ILS','RON','BGN','THB','INR','BRL','KRW']);
const STABLE_QUOTES = ['USDT','USDC','FDUSD','BUSD'];
const quoteCache = { rates: null, ratesAt: 0, crypto: null, cryptoAt: 0 };

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[market-api] request failed:', url, e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Units of each currency per one US dollar, from Coinbase. Cached briefly. */
async function fetchFiatRates() {
  if (quoteCache.rates && Date.now() - quoteCache.ratesAt < QUOTE_CACHE_MS) return quoteCache.rates;
  const data = await fetchJson('https://api.coinbase.com/v2/exchange-rates?currency=USD');
  const raw = data?.data?.rates;
  if (!raw) return quoteCache.rates;   // keep showing the last known rates rather than nothing
  const rates = { USD: 1 };
  for (const code of FIAT_CODES) { const v = Number(raw[code]); if (v > 0) rates[code] = v; }
  if (!rates.CNH && rates.CNY) rates.CNH = rates.CNY;
  quoteCache.rates = rates; quoteCache.ratesAt = Date.now();
  return rates;
}

/** Every Binance spot price in one request: symbol -> price. Cached briefly. */
async function fetchCryptoPrices() {
  if (quoteCache.crypto && Date.now() - quoteCache.cryptoAt < QUOTE_CACHE_MS) return quoteCache.crypto;
  const list = await fetchJson('https://api.binance.com/api/v3/ticker/price');
  if (!Array.isArray(list)) return quoteCache.crypto;
  const prices = new Map();
  for (const row of list) { const v = Number(row.price); if (v > 0) prices.set(row.symbol, v); }
  quoteCache.crypto = prices; quoteCache.cryptoAt = Date.now();
  return prices;
}

/** "eurusd.r", "EUR/USD" and "EURUSDm" are all the pair EUR/USD. Returns [base, quote] or null. */
function forexPair(ticker) {
  const letters = String(ticker || '').toUpperCase().replace(/[^A-Z]/g, '');
  const base = letters.slice(0, 3), quote = letters.slice(3, 6);
  return letters.length >= 6 && letters.length <= 8 && FIAT_CODES.has(base) && FIAT_CODES.has(quote) && base !== quote ? [base, quote] : null;
}

/** The Binance symbol that prices a ticker: BTC, BTCUSD and BTC/USDT all mean BTCUSDT. */
function binanceSymbol(ticker) {
  const symbol = String(ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/PERP$/, '');
  if (!symbol) return '';
  if (STABLE_QUOTES.some(q => symbol.endsWith(q) && symbol.length > q.length)) return symbol;
  if (symbol.endsWith('USD') && symbol.length > 3) return symbol + 'T';
  return symbol + 'USDT';
}

function mt5Quote(ticker) {
  const book = typeof window !== 'undefined' ? window.MT5Quotes : null;
  if (!book || !book.symbols || Date.now() - book.at > MT5_FRESH_MS) return null;
  const wanted = String(ticker || '').trim().toUpperCase();
  const row = book.symbols.get(wanted);
  if (!row || !(row.bid > 0)) return null;
  return { price: row.ask > 0 ? (row.bid + row.ask) / 2 : row.bid, bid: row.bid, ask: row.ask, digits: row.digits, source: 'mt5', approximate: false };
}

/**
 * Current quote for any ticker the journal knows how to price.
 * @param {string} ticker
 * @returns {Promise<{price:number, source:'mt5'|'coinbase'|'binance', approximate:boolean, bid?:number, ask?:number, digits?:number}|null>}
 */
async function fetchAssetQuote(ticker) {
  const text = String(ticker || '').trim();
  if (!text) return null;
  const broker = mt5Quote(text);
  if (broker) return broker;

  const pair = forexPair(text);
  if (pair) {
    const rates = await fetchFiatRates();
    const base = rates?.[pair[0]], quote = rates?.[pair[1]];
    return base > 0 && quote > 0 ? { price: quote / base, source: 'coinbase', approximate: true } : null;
  }

  const upper = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const gold = /^XAUUSD/.test(upper);
  const symbol = gold ? 'PAXGUSDT' : binanceSymbol(text);
  if (!symbol) return null;
  const known = quoteCache.crypto && Date.now() - quoteCache.cryptoAt < QUOTE_CACHE_MS ? quoteCache.crypto.get(symbol) : null;
  if (known) return { price: known, source: 'binance', approximate: gold };
  const data = await fetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`);
  const price = Number(data?.price);
  return price > 0 ? { price, source: 'binance', approximate: gold } : null;
}

/** A price with as many decimals as the instrument is quoted in. */
function formatQuote(price, digits) {
  if (!Number.isFinite(price)) return '';
  const places = Number.isInteger(digits) ? digits : price >= 1000 ? 2 : price >= 20 ? 3 : price >= 1 ? 5 : price >= 0.01 ? 6 : 8;
  return price.toLocaleString('ru-RU', { minimumFractionDigits: Math.min(places, 2), maximumFractionDigits: places });
}

/**
 * Current price for a ticker, or null when no source can price it.
 * @param {string} ticker
 * @returns {Promise<number|null>}
 */
async function fetchLivePrice(ticker) {
  const quote = await fetchAssetQuote(ticker);
  return quote ? quote.price : null;
}

/**
 * Fetch current USD price from CryptoCompare.
 * @param {string} baseSymbol e.g. "BTC"
 * @returns {Promise<string>} formatted price or "N/A"
 */
async function fetchCryptoComparePrice(baseSymbol) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const res = await fetch(
      `https://min-api.cryptocompare.com/data/price?fsym=${baseSymbol}&tsyms=USD`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return 'N/A';
    const data = await res.json();
    if (data && data.USD) {
      return `$${data.USD.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return 'N/A';
  } catch (e) {
    console.warn('[market-api] CryptoCompare price fetch error:', e);
    return 'N/A';
  }
}

/**
 * Fetch latest news from CryptoCompare.
 * @param {string} baseSymbol
 * @returns {Promise<string>} news text block
 */
async function fetchNews(baseSymbol) {
  const defaultNews =
    '1. Market shows mixed dynamics amid macroeconomic expectations.\n' +
    '2. Institutional interest in ETFs remains steady.\n' +
    '3. Regulators continue monitoring DeFi.';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    // Try specific category first
    let res = await fetch(
      `https://min-api.cryptocompare.com/data/v2/news/?categories=${baseSymbol}&sortOrder=latest`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    let newsData = await res.json();

    // Fallback to general news
    if (!newsData?.Data?.length) {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), API_TIMEOUT_MS);
      res = await fetch(
        `https://min-api.cryptocompare.com/data/v2/news/?sortOrder=latest`,
        { signal: controller2.signal }
      );
      clearTimeout(timeoutId2);
      newsData = await res.json();
    }

    if (newsData?.Data?.length) {
      return newsData.Data.slice(0, 5)
        .map(n => `- ${n.title} (Source: ${n.source_info.name})`)
        .join('\n');
    }

    return defaultNews;
  } catch (e) {
    console.warn('[market-api] News fetch error:', e);
    return defaultNews;
  }
}
