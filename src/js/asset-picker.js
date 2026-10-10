/**
 * asset-picker.js — A searchable list of every instrument for the ticker field, with current prices.
 * Sources of the list: the symbols on the trader's MT5 account (when synced), the tickers already
 * used in the journal, a built-in set of currency pairs, metals, indices and commodities, and every
 * USDT pair on Binance. Prices come from market-api.js; where no free feed exists the row says so.
 */
(() => {
  'use strict';
  const input = document.getElementById('fTicker');
  const field = input?.closest('.f-field');
  if (!input || !field || typeof fetchAssetQuote !== 'function') return;

  const WORDS = {
    ru: { all: 'Все', mine: 'Мои', mt5: 'Счёт MT5', forex: 'Форекс', crypto: 'Крипто', metals: 'Металлы', indices: 'Индексы', commodities: 'Сырьё',
      none: 'Ничего не найдено. Тикер можно ввести вручную.', more: 'Показано {n} из {total}. Начните вводить название.',
      sources: 'Цены: MT5 — брокер · форекс — Coinbase, ориентир · крипто — Binance · индексы и сырьё — только через MT5.', label: 'Список активов', approx: 'ориентир' },
    uk: { all: 'Усі', mine: 'Мої', mt5: 'Рахунок MT5', forex: 'Форекс', crypto: 'Крипто', metals: 'Метали', indices: 'Індекси', commodities: 'Сировина',
      none: 'Нічого не знайдено. Тікер можна ввести вручну.', more: 'Показано {n} із {total}. Почніть вводити назву.',
      sources: 'Ціни: MT5 — брокер · форекс — Coinbase, орієнтир · крипто — Binance · індекси та сировина — лише через MT5.', label: 'Список активів', approx: 'орієнтир' },
    en: { all: 'All', mine: 'Mine', mt5: 'MT5 account', forex: 'Forex', crypto: 'Crypto', metals: 'Metals', indices: 'Indices', commodities: 'Commodities',
      none: 'Nothing found. You can still type the ticker by hand.', more: 'Showing {n} of {total}. Start typing a name.',
      sources: 'Prices: MT5 — broker · forex — Coinbase, indicative · crypto — Binance · indices and commodities — through MT5 only.', label: 'Asset list', approx: 'indicative' },
    cs: { all: 'Vše', mine: 'Moje', mt5: 'Účet MT5', forex: 'Forex', crypto: 'Krypto', metals: 'Kovy', indices: 'Indexy', commodities: 'Komodity',
      none: 'Nic nenalezeno. Ticker lze zadat ručně.', more: 'Zobrazeno {n} z {total}. Začněte psát název.',
      sources: 'Ceny: MT5 — broker · forex — Coinbase, orientačně · krypto — Binance · indexy a komodity — pouze přes MT5.', label: 'Seznam aktiv', approx: 'orientačně' }
  };
  const words = () => WORDS[typeof currentLang === 'string' ? currentLang : 'ru'] || WORDS.en;
  const GROUPS = ['all', 'mine', 'mt5', 'forex', 'crypto', 'metals', 'indices', 'commodities'];
  const LIMIT = 80, REFRESH_MS = 15000;

  /* ---- Built-in instruments ---- */
  const pairs = text => text.split(' ').map(symbol => ({ symbol, name: symbol.slice(0, 3) + ' / ' + symbol.slice(3), group: 'forex' }));
  const FOREX = pairs('EURUSD GBPUSD USDJPY USDCHF AUDUSD USDCAD NZDUSD EURGBP EURJPY EURCHF EURAUD EURCAD EURNZD GBPJPY GBPCHF GBPAUD GBPCAD GBPNZD AUDJPY AUDCHF AUDCAD AUDNZD CADJPY CADCHF CHFJPY NZDJPY NZDCHF NZDCAD USDCZK EURCZK USDPLN EURPLN USDSEK EURSEK USDNOK EURNOK USDDKK USDHUF EURHUF USDMXN USDZAR USDTRY EURTRY USDSGD USDHKD USDCNH');
  const named = (group, list) => list.map(([symbol, name]) => ({ symbol, name, group }));
  const METALS = named('metals', [['XAUUSD', 'Gold'], ['XAGUSD', 'Silver'], ['XPTUSD', 'Platinum'], ['XPDUSD', 'Palladium']]);
  const INDICES = named('indices', [['US30', 'Dow Jones 30'], ['US100', 'Nasdaq 100'], ['US500', 'S&P 500'], ['US2000', 'Russell 2000'], ['GER40', 'DAX 40'], ['UK100', 'FTSE 100'], ['FRA40', 'CAC 40'], ['EU50', 'Euro Stoxx 50'], ['SPN35', 'IBEX 35'], ['JP225', 'Nikkei 225'], ['HK50', 'Hang Seng 50'], ['AUS200', 'ASX 200']]);
  const COMMODITIES = named('commodities', [['USOIL', 'WTI crude oil'], ['UKOIL', 'Brent crude oil'], ['NATGAS', 'Natural gas']]);
  // Shown until Binance answers, and first in the list afterwards.
  const TOP_CRYPTO = 'BTC ETH SOL BNB XRP DOGE ADA TRX AVAX LINK TON DOT LTC BCH NEAR UNI ATOM XLM ETC APT ARB OP SUI INJ FIL AAVE'.split(' ');
  let crypto = TOP_CRYPTO.map(base => ({ symbol: base + 'USDT', name: base + ' / USDT', group: 'crypto' }));
  let cryptoPrices = null, rates = null;

  /* ---- The trader's own instruments ---- */
  function mt5Assets() {
    const book = window.MT5Quotes;
    if (book?.symbols?.size) return [...book.symbols.values()].map(q => ({ symbol: q.symbol, name: q.description || q.group || '', group: 'mt5', kind: classify(q.symbol, q.group) }));
    try { return (JSON.parse(localStorage.getItem('tk_mt5_symbols') || '[]') || []).map(q => ({ symbol: q.symbol, name: q.description || q.group || '', group: 'mt5', kind: classify(q.symbol, q.group) })); }
    catch (_) { return []; }
  }
  function classify(symbol, group) {
    const g = String(group || '').toLowerCase();
    if (/forex|fx|currenc/.test(g) || forexPair(symbol)) return 'forex';
    if (/metal/.test(g) || /^X(AU|AG|PT|PD)/.test(symbol)) return 'metals';
    if (/ind/.test(g)) return 'indices';
    if (/crypto/.test(g)) return 'crypto';
    if (/commod|energ|oil/.test(g)) return 'commodities';
    return '';
  }
  function myAssets() {
    const list = typeof trades !== 'undefined' && Array.isArray(trades) ? trades : [];
    const seen = new Set(), out = [];
    for (const t of [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))) {
      const symbol = String(t.ticker || '').toUpperCase();
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      out.push({ symbol, name: t.broker || '', group: 'mine' });
    }
    return out;
  }

  /** Everything for the chosen tab. In "All" each symbol appears once: the account's own names first. */
  function assets(group) {
    const mt5 = mt5Assets(), mine = myAssets();
    if (group === 'mine') return mine;
    if (group === 'mt5') return mt5;
    const builtIn = [...FOREX, ...METALS, ...INDICES, ...COMMODITIES, ...crypto];
    if (group !== 'all') return [...mt5.filter(a => a.kind === group), ...builtIn.filter(a => a.group === group)].filter(unique());
    return [...mt5, ...mine, ...builtIn].filter(unique());
  }
  const unique = () => { const seen = new Set(); return a => !seen.has(a.symbol) && seen.add(a.symbol); };

  function priceOf(asset) {
    const broker = mt5Quote(asset.symbol);
    if (broker) return { text: formatQuote(broker.price, broker.digits), exact: true };
    const pair = forexPair(asset.symbol);
    if (pair) { const base = rates?.[pair[0]], quote = rates?.[pair[1]]; return base > 0 && quote > 0 ? { text: formatQuote(quote / base), exact: false } : null; }
    if (asset.group === 'indices' || asset.group === 'commodities' || asset.kind === 'indices' || asset.kind === 'commodities') return null;
    const gold = /^XAUUSD/.test(asset.symbol);
    if ((asset.group === 'metals' || asset.kind === 'metals') && !gold) return null;
    const price = cryptoPrices?.get(gold ? 'PAXGUSDT' : binanceSymbol(asset.symbol));
    return price ? { text: formatQuote(price), exact: !gold } : null;
  }

  /* ---- The panel ---- */
  const panel = document.createElement('div');
  panel.className = 'asset-picker';
  panel.hidden = true;
  const tabs = document.createElement('div'); tabs.className = 'asset-tabs';
  const list = document.createElement('div'); list.className = 'asset-list'; list.id = 'assetList'; list.setAttribute('role', 'listbox');
  const foot = document.createElement('p'); foot.className = 'asset-foot';
  panel.append(tabs, list, foot);
  field.classList.add('has-asset-picker');
  field.append(panel);
  input.removeAttribute('list');   // this panel replaces the browser's own suggestion list
  input.autocomplete = 'off';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let group = 'all', query = '', shown = [], active = -1, timer = 0, choosing = false;

  function matches(asset) {
    if (!query) return true;
    const q = query.toUpperCase().replace(/[\s\/]/g, '');
    return asset.symbol.toUpperCase().includes(q) || String(asset.name).toUpperCase().replace(/[\s\/]/g, '').includes(q);
  }

  function render() {
    const t = words();
    list.setAttribute('aria-label', t.label);
    tabs.replaceChildren(...GROUPS.filter(g => g === 'all' || assets(g).length).map(g => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'asset-tab'; button.dataset.group = g; button.textContent = t[g];
      button.setAttribute('aria-pressed', String(g === group));
      return button;
    }));
    const found = assets(group).filter(matches);
    // Symbols that start with what was typed come before those that merely contain it.
    if (query) { const q = query.toUpperCase(); found.sort((a, b) => Number(b.symbol.startsWith(q)) - Number(a.symbol.startsWith(q))); }
    shown = found.slice(0, LIMIT);
    if (active >= shown.length) active = shown.length - 1;
    list.replaceChildren(...shown.map((asset, index) => {
      const row = document.createElement('div');
      row.className = 'asset-row'; row.id = 'assetOption' + index; row.dataset.index = String(index);
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === active));
      const symbol = document.createElement('span'); symbol.className = 'asset-symbol'; symbol.textContent = asset.symbol;
      const name = document.createElement('span'); name.className = 'asset-name'; name.textContent = asset.name;
      const price = document.createElement('span'); price.className = 'asset-price';
      const quote = priceOf(asset);
      price.textContent = quote ? quote.text : '—';
      if (quote && !quote.exact) { price.classList.add('approx'); price.title = t.approx; }
      row.append(symbol, name, price);
      return row;
    }));
    if (!shown.length) { const empty = document.createElement('p'); empty.className = 'asset-empty'; empty.textContent = t.none; list.append(empty); }
    foot.textContent = (found.length > shown.length ? t.more.replace('{n}', shown.length).replace('{total}', found.length) + ' ' : '') + t.sources;
    if (active >= 0) input.setAttribute('aria-activedescendant', 'assetOption' + active); else input.removeAttribute('aria-activedescendant');
  }

  async function loadPrices() {
    const [nextRates, nextCrypto] = await Promise.all([fetchFiatRates(), fetchCryptoPrices()]);
    if (nextRates) rates = nextRates;
    if (nextCrypto) {
      cryptoPrices = nextCrypto;
      // Every USDT pair Binance lists, without leveraged tokens; the familiar names stay on top.
      const order = new Map(TOP_CRYPTO.map((base, i) => [base + 'USDT', i]));
      crypto = [...nextCrypto.keys()].filter(s => /USDT$/.test(s) && !/(UP|DOWN|BULL|BEAR)USDT$/.test(s))
        .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b))
        .map(symbol => ({ symbol, name: symbol.slice(0, -4) + ' / USDT', group: 'crypto' }));
    }
    if (!panel.hidden) render();
  }

  /** Scroll just enough for the whole list to be on screen, never pushing the field under the top bar. */
  function reveal() {
    if (panel.hidden) return;
    const view = window.visualViewport?.height || window.innerHeight;
    const over = panel.getBoundingClientRect().bottom + 12 - view;
    if (over <= 0) return;
    const bar = document.querySelector('body > nav')?.getBoundingClientRect().bottom || 0;
    const room = input.getBoundingClientRect().top - Math.max(0, bar) - 34;   // 34 keeps the field's label visible
    if (room <= 0) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: Math.min(over, room), behavior: calm ? 'auto' : 'smooth' });
  }

  function open() {
    if (!panel.hidden) return;
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    render();
    reveal();
    loadPrices();
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) loadPrices(); }, REFRESH_MS);
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true; active = -1; query = '';
    clearInterval(timer);
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function choose(index) {
    const asset = shown[index];
    if (!asset) return;
    choosing = true;
    input.value = asset.symbol;
    input.dispatchEvent(new Event('input', { bubbles: true }));   // the price hint and the draft listen for this
    choosing = false;
    close();
    input.focus();
  }

  // Opens on a click, on typing or on the arrow keys. Not on focus alone: the form moves focus here
  // by itself after every saved trade, and the list must not jump open then.
  input.addEventListener('click', () => { if (panel.hidden) { query = ''; open(); } });
  input.addEventListener('input', () => {
    if (choosing) return;
    query = input.value.trim(); active = -1;
    if (panel.hidden) open(); else render();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (panel.hidden) { open(); return; }
      if (!shown.length) return;
      active = e.key === 'ArrowDown' ? (active + 1) % shown.length : (active <= 0 ? shown.length - 1 : active - 1);
      render();
      list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && !panel.hidden && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') close();
  });
  // Keep the text cursor in the field while the mouse works inside the panel.
  panel.addEventListener('pointerdown', e => e.preventDefault());
  panel.addEventListener('click', e => {
    const tab = e.target.closest('.asset-tab');
    if (tab) { group = tab.dataset.group; active = -1; render(); return; }
    const row = e.target.closest('.asset-row');
    if (row) choose(Number(row.dataset.index));
  });
  document.addEventListener('pointerdown', e => { if (!field.contains(e.target)) close(); });
  input.addEventListener('blur', () => setTimeout(() => { if (!field.contains(document.activeElement)) close(); }, 0));
  document.addEventListener('journal:mt5-quotes', () => { if (!panel.hidden) render(); });
  document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(() => { if (!panel.hidden) render(); }, 0));
  window.addEventListener('pagehide', () => clearInterval(timer));
  // A phone keyboard slides in after the tap and covers the list; move the page once it has.
  window.visualViewport?.addEventListener('resize', reveal);

  window.AssetPicker = { open, close, assets, priceOf, get shown() { return shown; }, loadPrices };
})();
