/**
 * market-api.js — Binance & CryptoCompare API integration with timeout & error handling.
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

/**
 * Fetch live price from Binance.
 * @param {string} ticker
 * @returns {Promise<number|null>}
 */
async function fetchLivePrice(ticker) {
  try {
    let symbol = ticker.toUpperCase();
    if (!symbol.endsWith('USDT') && !symbol.endsWith('BUSD') && !symbol.endsWith('USDC')) {
      symbol += 'USDT';
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.price);
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[market-api] Binance price fetch timed out for', ticker);
    } else {
      console.warn('[market-api] Binance price fetch error:', e);
    }
    return null;
  }
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
