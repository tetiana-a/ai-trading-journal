/** Binance public candles + TradingView Lightweight Charts. */
(() => {
  const el = document.getElementById('marketChart');
  if (!el || !window.LightweightCharts) return;
  const chart = LightweightCharts.createChart(el, {
    width: el.clientWidth,
    height: el.clientHeight || 520,
    layout: { background: { color: 'transparent' }, textColor: '#a9a3b0' },
    grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } },
    rightPriceScale: { borderColor: 'rgba(255,255,255,.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,.08)', timeVisible: true }
  });
  const series = chart.addCandlestickSeries({
    upColor:'#8cc49a',downColor:'#d98a8a',borderUpColor:'#8cc49a',borderDownColor:'#d98a8a',wickUpColor:'#8cc49a',wickDownColor:'#d98a8a'
  });
  let ws = null;
  const symbolInput = document.getElementById('chartSymbol');
  const intervalInput = document.getElementById('chartInterval');
  const status = document.getElementById('chartStatus');

  async function load() {
    const symbol = symbolInput.value.trim().toUpperCase() || 'BTCUSDT';
    const interval = intervalInput.value;
    status.textContent = 'Загрузка ' + symbol + ' ' + interval + '…';
    if (ws) { try { ws.close(); } catch (_) {} }
    try {
      const r = await fetch('https://api.binance.com/api/v3/klines?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(interval) + '&limit=500');
      if (!r.ok) throw new Error('Binance ' + r.status);
      const rows = await r.json();
      series.setData(rows.map(k => ({ time: Math.floor(k[0]/1000), open:+k[1], high:+k[2], low:+k[3], close:+k[4] })));
      chart.timeScale().fitContent();
      status.textContent = symbol + ' · ' + interval + ' · live';
      ws = new WebSocket('wss://stream.binance.com:9443/ws/' + symbol.toLowerCase() + '@kline_' + interval);
      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        const k = msg.k;
        series.update({ time: Math.floor(k.t/1000), open:+k.o, high:+k.h, low:+k.l, close:+k.c });
      };
      ws.onerror = () => { status.textContent = symbol + ' · REST OK, WebSocket недоступен'; };
    } catch (e) {
      console.error(e);
      status.textContent = 'Ошибка загрузки Binance: ' + e.message;
    }
  }
  document.getElementById('chartLoad').addEventListener('click', load);
  window.addEventListener('resize', () => chart.applyOptions({ width: el.clientWidth }));
  load();
})();