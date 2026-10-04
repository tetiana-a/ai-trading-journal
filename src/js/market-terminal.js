/**
 * market-terminal.js — Multi-provider read-only market terminal.
 * Candle data comes from official public APIs through a Supabase Edge Function normalizer.
 * No exchange API key is required and no orders can be placed from this module.
 */
(() => {
  const el = document.getElementById('marketChart');
  if (!el || !window.LightweightCharts) return;

  const providerInput = document.getElementById('chartProvider');
  const symbolInput = document.getElementById('chartSymbol');
  const intervalInput = document.getElementById('chartInterval');
  const status = document.getElementById('chartStatus');
  const loadBtn = document.getElementById('chartLoad');
  const endpoint = 'https://fzaawuwfpewqfkwmobpj.supabase.co/functions/v1/market-data';

  const chart = LightweightCharts.createChart(el, {
    width: el.clientWidth,
    height: el.clientHeight || 520,
    layout: { background: { color: 'transparent' }, textColor: '#a9a3b0' },
    grid: {
      vertLines: { color: 'rgba(255,255,255,.04)' },
      horzLines: { color: 'rgba(255,255,255,.04)' }
    },
    rightPriceScale: { borderColor: 'rgba(255,255,255,.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,.08)', timeVisible: true }
  });

  const series = chart.addCandlestickSeries({
    upColor:'#8cc49a',
    downColor:'#d98a8a',
    borderUpColor:'#8cc49a',
    borderDownColor:'#d98a8a',
    wickUpColor:'#8cc49a',
    wickDownColor:'#d98a8a'
  });

  let timer = null;
  let firstLoad = true;

  const providerNames = {
    binance:'Binance',
    bybit:'Bybit',
    okx:'OKX',
    kraken:'Kraken'
  };

  async function fetchCandles() {
    const provider = providerInput?.value || 'binance';
    const symbol = (symbolInput?.value || 'BTCUSDT').trim().toUpperCase();
    const interval = intervalInput?.value || '15m';

    if (status) status.textContent = `${providerNames[provider]} · ${symbol} · ${interval} · loading…`;

    const url = new URL(endpoint);
    url.searchParams.set('provider', provider);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);

    const r = await fetch(url.toString(), { cache:'no-store' });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status));
    return { provider, symbol, interval, candles:d.candles || [] };
  }

  async function load({fit=true} = {}) {
    try {
      const result = await fetchCandles();
      if (!result.candles.length) throw new Error('No candles returned');
      series.setData(result.candles);
      if (fit || firstLoad) chart.timeScale().fitContent();
      firstLoad = false;
      const last = result.candles[result.candles.length - 1];
      if (status) {
        status.textContent = `${providerNames[result.provider]} · ${result.symbol} · ${result.interval} · ${Number(last.close).toLocaleString('en-US',{maximumFractionDigits:8})} · live polling`;
      }
    } catch (e) {
      console.error('[market-terminal]', e);
      if (status) status.textContent = 'Market data error: ' + e.message;
    }
  }

  function restartPolling() {
    if (timer) clearInterval(timer);
    load({fit:true});
    timer = setInterval(() => load({fit:false}), 8000);
  }

  loadBtn?.addEventListener('click', restartPolling);
  providerInput?.addEventListener('change', restartPolling);
  intervalInput?.addEventListener('change', restartPolling);
  symbolInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') restartPolling();
  });

  window.addEventListener('resize', () => chart.applyOptions({ width: el.clientWidth }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) { clearInterval(timer); timer = null; }
    else if (!document.hidden && !timer) restartPolling();
  });

  restartPolling();
})();