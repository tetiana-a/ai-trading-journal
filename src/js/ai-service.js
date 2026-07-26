/**
 * ai-service.js — AI trade analysis via Groq (or compatible) API.
 * Reads API credentials from localStorage; constructs a detailed prompt
 * with trade data, live price, and news context.
 */

/**
 * Analyze a trade using AI.
 * @param {string} id - trade ID
 * @returns {Promise<void>}
 */
async function analyzeTrade(id) {
  const t = translations[currentLang];
  const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
  const apiUrl = localStorage.getItem(STORAGE_KEYS.API_URL) || 'https://api.groq.com/openai/v1/chat/completions';
  const model  = localStorage.getItem(STORAGE_KEYS.API_MODEL) || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    alert(t.alert_no_api);
    document.getElementById('apiSettingsBtn').click();
    return;
  }

  const tr = trades.find(x => x.id === id);
  if (!tr) return;

  const { pnl, pct } = calcPnl(tr);
  const aiContent = document.getElementById('aiContent');
  const aiModalTitle = document.getElementById('aiModalTitle');

  aiModalTitle.textContent = `${t.modal_ai_title}: ${tr.ticker} (${tr.date})`;
  aiContent.innerHTML = `<div class="ai-loading">${t.modal_ai_loading}</div>`;
  document.getElementById('aiModal').classList.add('show');

  const baseTicker = cleanTicker(tr.ticker);

  // 1. Fetch current price
  const currentPrice = await fetchCryptoComparePrice(baseTicker);
  aiContent.innerHTML = `<div class="ai-loading">${t.modal_ai_curr_price} ${baseTicker}: ${currentPrice}. ${t.modal_ai_gathering_news}</div>`;

  // 2. Fetch news
  const newsContext = await fetchNews(baseTicker);
  aiContent.innerHTML = `<div class="ai-loading">${t.modal_ai_analyzing}</div>`;

  // 3. Build prompt
  const prompt = `You are a professional crypto trader and mentor with years of experience. 
  Your task is to conduct a deep, strict, but constructive analysis of the trader's deal. 
  Consider risk management, psychology, technical analysis, current market price, and fundamental background (based on the provided news).
  YOU MUST WRITE YOUR RESPONSE IN ${t.lang_name} LANGUAGE.

  Deal data:
  - Ticker: ${tr.ticker}
  - Side: ${tr.side}
  - Status: ${tr.status}
  - Deposit: $${tr.deposit}
  - Entry Price: ${tr.entry}
  - Exit Price: ${tr.exit || 'still open'}
  - Volume: ${tr.volume}
  - PNL: $${pnl.toFixed(2)} (${(pct * 100).toFixed(2)}%)
  - Emotion during trade: ${tr.emotion}
  - Entry Reason: ${tr.entryReason || 'not specified'}
  - Exit Reason: ${tr.exitReason || 'not specified'}
  - Trader Notes: ${tr.notes || 'none'}

  CURRENT MARKET PRICE (right now): ${currentPrice}

  Latest market news:
  ${newsContext}

  Write the analysis in ${t.lang_name} language in the following format (use markdown with line breaks):

  1. DEAL BREAKDOWN AND CURRENT SITUATION:
  (Evaluate risk management, entry/exit points. BE SURE to compare the entry/exit price with the CURRENT MARKET PRICE (${currentPrice}). If the trade is closed, evaluate whether it was worth holding longer or if the entry was perfect. If open, evaluate the current floating PNL and risks. IT IS STRICTLY FORBIDDEN TO WRITE THAT THE PRICE IS NOT PROVIDED. If it equals "N/A", write "Could not fetch real-time quotes", but do not ignore this point).

  2. PSYCHOLOGY AND DISCIPLINE:
  (Analyze the stated emotion. How could it have affected decision-making? Was the trader impulsive or did they stick to the plan?)

  3. FUNDAMENTAL BACKGROUND (BASED ON NEWS):
  (BE SURE to analyze the provided news. How does it correlate with the trade? If the news does not directly concern the coin, assess the general market sentiment (risk-on/risk-off) and how global events affect this asset. IT IS STRICTLY FORBIDDEN TO WRITE THAT NEWS IS UNAVAILABLE — JUST ANALYZE WHAT IS PROVIDED).

  4. RECOMMENDATIONS FOR THE FUTURE:
  (Give 3 specific, actionable tips for the trader to improve results in future trades, considering the current price and news).

  Be objective, professional, and mentoring. Do not use generic phrases, be specific. Remember, output must be in ${t.lang_name} language.`;

  // 4. Call AI API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a professional crypto trader and mentor.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error?.message || 'Unknown API Error. Check model and key.';
      throw new Error(`API Error: ${res.status} - ${errMsg}`);
    }

    const data = await res.json();
    const analysisText = data.choices[0].message.content;
    aiContent.innerHTML = `<div style="color:var(--txt);line-height:1.6;">${escapeHtml(analysisText).replace(/\n/g, '<br>')}</div>`;
  } catch (err) {
    if (err.name === 'AbortError') {
      aiContent.innerHTML = `<div style="color:var(--neg);">Request timed out. Try again.</div>`;
    } else {
      console.error('[ai-service]', err);
      aiContent.innerHTML = `<div style="color:var(--neg);">Error fetching AI analysis.<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }
}
