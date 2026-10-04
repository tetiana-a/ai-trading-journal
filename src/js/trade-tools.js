/**
 * trade-tools.js — Interactive calculator, prop dashboard, knowledge base,
 * alerts and local rule-based analyst. No paid API required.
 */
(() => {
  const $ = id => document.getElementById(id);
  const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const T = (ru, en) => isEn ? en : ru;
  const num = id => Number($(id)?.value || 0);
  const fmt = (n, d=2) => Number.isFinite(n) ? n.toLocaleString('ru-RU',{maximumFractionDigits:d}) : '—';

  const PROP_PRESETS = {
    'ftmo-1step': { firm:'FTMO', program:'1-Step', daily:3, max:10, target:10, personal:1 },
    'the5ers-2step': { firm:'The5ers', program:'2-Step', daily:3, max:10, target:10, personal:1 },
    'itrade-1step': { firm:'iTrade', program:'1-Step', daily:3, max:5, target:10, personal:0.75 },
    'itrade-2step': { firm:'iTrade', program:'2-Step', daily:5, max:7, target:10, personal:1 },
    'custom': { firm:'Custom', program:'Custom', daily:3, max:10, target:10, personal:1 }
  };

  function pnlOfTrade(t) {
    const entry = Number(t.entry || 0), exit = Number(t.exit || 0), volume = Number(t.volume || 0);
    if (!entry || !exit || !volume) return 0;
    return (t.side === 'Short' ? entry - exit : exit - entry) * volume;
  }

  function localReview(t) {
    const pnl = pnlOfTrade(t);
    const entry = Number(t.entry || 0);
    const exit = Number(t.exit || 0);
    const deposit = Number(t.deposit || 0);
    const pct = deposit ? pnl / deposit * 100 : 0;
    const emotion = String(t.emotion || '').toLowerCase();
    const reasons = [];
    if (!t.entryReason) reasons.push(T('Причина входа не зафиксирована — это снижает качество последующего анализа.','Entry reason is missing, which weakens post-trade analysis.'));
    if (!t.exitReason && t.status !== 'open') reasons.push(T('Для закрытой сделки не указана причина выхода.','Exit reason is missing for a closed trade.'));
    if (/fomo|жад|азарт|страх|раздраж|нетерп/.test(emotion)) reasons.push(T('Эмоциональный фактор мог влиять на решение; перед следующим входом нужен короткий pre-trade checklist.','Emotion may have affected execution; use a short pre-trade checklist before the next entry.'));
    if (Math.abs(pct) > 2) reasons.push(T('Движение PNL относительно депозита крупное — проверь, не был ли размер позиции завышен.','PNL is large relative to the stated balance; verify that position size was not oversized.'));
    if (!reasons.length) reasons.push(T('По журналу критических нарушений не видно; продолжай собирать выборку, а не оценивать стратегию по одной сделке.','No critical process violation is visible from the journal entry; evaluate the strategy over a sample, not one trade.'));
    return [
      T('БЕСПЛАТНЫЙ ЛОКАЛЬНЫЙ АНАЛИЗ','FREE LOCAL REVIEW'),
      '',
      T('Результат: ','Result: ') + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USD' + (deposit ? ' (' + pct.toFixed(2) + '% от указанного депозита)' : ''),
      T('Сделка: ','Trade: ') + (t.side || '—') + ' ' + (t.ticker || '—') + (entry ? ' @ ' + entry : '') + (exit ? ' → ' + exit : ''),
      '',
      T('Контроль процесса:','Process control:'),
      ...reasons.map(x => '• ' + x),
      '',
      T('Следующий шаг: повторяй один сетап, заранее определяй invalidation и риск, затем сравни минимум 20–30 однотипных сделок.','Next step: repeat one setup, define invalidation and risk before entry, then compare at least 20–30 similar trades.')
    ].join('\n');
  }
  window.localTradeReview = localReview;

  // ===== Trade Calculator =====
  function calcTrade() {
    const balance = num('calcBalance');
    const riskPct = num('calcRiskPct');
    const entry = num('calcEntry');
    const stop = num('calcStop');
    const target = num('calcTarget');
    const side = $('calcSide')?.value || 'Long';
    const riskUsd = balance * riskPct / 100;
    const stopDistance = Math.abs(entry - stop);
    const targetDistance = Math.abs(target - entry);
    const qty = stopDistance > 0 ? riskUsd / stopDistance : 0;
    const notional = qty * entry;
    const rr = stopDistance > 0 ? targetDistance / stopDistance : 0;
    const expectedProfit = qty * targetDistance;
    const stopPct = entry ? stopDistance / entry * 100 : 0;
    const targetPct = entry ? targetDistance / entry * 100 : 0;
    const invalid = side === 'Long' ? stop >= entry || target <= entry : stop <= entry || target >= entry;
    if ($('calcResult')) {
      $('calcResult').innerHTML = invalid
        ? T('<strong style="color:var(--neg)">Проверь направление Stop/Target.</strong>','<strong style="color:var(--neg)">Check Stop/Target direction.</strong>')
        : [
            '<b>Risk:</b> $' + fmt(riskUsd),
            '<b>Position size:</b> ' + fmt(qty,8),
            '<b>Notional:</b> $' + fmt(notional),
            '<b>Stop distance:</b> ' + fmt(stopPct) + '%',
            '<b>Target distance:</b> ' + fmt(targetPct) + '%',
            '<b>R:R:</b> 1:' + fmt(rr),
            '<b>Profit at TP:</b> $' + fmt(expectedProfit)
          ].join('<br>');
    }
  }

  ['calcBalance','calcRiskPct','calcEntry','calcStop','calcTarget','calcSide'].forEach(id => $(id)?.addEventListener('input', calcTrade));
  $('calcRun')?.addEventListener('click', calcTrade);
  calcTrade();

  // ===== Prop dashboard =====
  function applyPreset() {
    const p = PROP_PRESETS[$('propPreset')?.value] || PROP_PRESETS.custom;
    if ($('propFirm')) $('propFirm').value = p.firm;
    if ($('propProgram')) $('propProgram').value = p.program;
    if ($('propDailyPct')) $('propDailyPct').value = p.daily;
    if ($('propMaxPct')) $('propMaxPct').value = p.max;
    if ($('propTargetPct')) $('propTargetPct').value = p.target;
    if ($('propPersonalPct')) $('propPersonalPct').value = p.personal;
    renderProp();
  }

  function propMetrics() {
    const size = num('propSize');
    const balance = num('propBalance') || size;
    const equity = num('propEquity') || balance;
    const dayStart = num('propDayStart') || balance;
    const dailyPct = num('propDailyPct');
    const maxPct = num('propMaxPct');
    const targetPct = num('propTargetPct');
    const personalPct = num('propPersonalPct');

    const dailyFloor = dayStart * (1 - dailyPct/100);
    const maxFloor = size * (1 - maxPct/100);
    const personalFloor = dayStart * (1 - personalPct/100);
    const targetBalance = size * (1 + targetPct/100);
    const usedDaily = Math.max(0, dayStart - equity);
    const dailyAllowance = dayStart * dailyPct/100;
    const personalAllowance = dayStart * personalPct/100;
    const lossFromInitial = Math.max(0, size - equity);
    const maxAllowance = size * maxPct/100;

    return {
      size,balance,equity,dayStart,dailyPct,maxPct,targetPct,personalPct,
      dailyRemaining: Math.max(0,equity-dailyFloor),
      maxRemaining: Math.max(0,equity-maxFloor),
      personalRemaining: Math.max(0,equity-personalFloor),
      targetRemaining: Math.max(0,targetBalance-equity),
      dailyUsedPct: dailyAllowance ? usedDaily/dailyAllowance*100 : 0,
      personalUsedPct: personalAllowance ? usedDaily/personalAllowance*100 : 0,
      maxUsedPct: maxAllowance ? lossFromInitial/maxAllowance*100 : 0,
      blocked: equity <= personalFloor,
      firmBreach: equity <= dailyFloor || equity <= maxFloor
    };
  }

  function bar(pct) {
    const v = Math.max(0, Math.min(100, pct));
    return '<div class="riskbar"><span style="width:'+v+'%"></span></div>';
  }

  function renderProp() {
    if (!$('propResult')) return;
    const m = propMetrics();
    const status = m.firmBreach ? 'FIRM LIMIT BREACH' : m.blocked ? 'PERSONAL STOP DAY' : m.personalUsedPct >= 50 ? 'CAUTION' : 'OK';
    const color = m.firmBreach || m.blocked ? 'var(--neg)' : m.personalUsedPct >= 50 ? 'var(--accent)' : 'var(--pos)';
    $('propResult').innerHTML =
      '<div class="risk-status" style="color:'+color+'">'+status+'</div>'+
      '<b>Personal daily risk left:</b> $'+fmt(m.personalRemaining)+bar(m.personalUsedPct)+
      '<b>Firm daily loss room:</b> $'+fmt(m.dailyRemaining)+bar(m.dailyUsedPct)+
      '<b>Max loss room:</b> $'+fmt(m.maxRemaining)+bar(m.maxUsedPct)+
      '<b>Profit target left:</b> $'+fmt(m.targetRemaining);
    localStorage.setItem('tk_prop_guard', JSON.stringify({
      accountSize:m.size,
      personalDailyStopPct:m.personalPct,
      firmDailyLossPct:m.dailyPct,
      maxLossPct:m.maxPct,
      dayStartBalance:m.dayStart,
      currentEquity:m.equity,
      blocked:m.blocked || m.firmBreach
    }));
  }

  $('propPreset')?.addEventListener('change', applyPreset);
  ['propSize','propBalance','propEquity','propDayStart','propDailyPct','propMaxPct','propTargetPct','propPersonalPct'].forEach(id => $(id)?.addEventListener('input', renderProp));
  $('propSave')?.addEventListener('click', async () => {
    const state = $('propSaveState');
    try {
      if (!window.TradingCloud?.savePropAccount) throw new Error('Cloud tools ещё не загружены');
      const p = PROP_PRESETS[$('propPreset')?.value] || PROP_PRESETS.custom;
      const saved = await window.TradingCloud.savePropAccount({
        firm: $('propFirm')?.value || p.firm,
        program: $('propProgram')?.value || p.program,
        accountSize: num('propSize'),
        currentBalance: num('propBalance'),
        currentEquity: num('propEquity'),
        maxDailyLossPct: num('propDailyPct'),
        maxLossPct: num('propMaxPct'),
        profitTargetPct: num('propTargetPct'),
        personalDailyStopPct: num('propPersonalPct'),
        metadata: { preset: $('propPreset')?.value || 'custom' }
      });
      state.textContent = T('Сохранено в Supabase · ','Saved to Supabase · ') + saved.firm + ' ' + (saved.program || '');
    } catch (e) { state.textContent = T('Ошибка: ','Error: ') + e.message; }
  });
  applyPreset();

  window.TradingRiskGuard = {
    async canAddTrade() {
      try {
        const saved = JSON.parse(localStorage.getItem('tk_prop_guard') || '{}');
        const raw = localStorage.getItem('tk_journal_trades_v2');
        const list = raw ? JSON.parse(raw) : [];
        const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const closedToday = list.filter(x => x.date === today && x.status !== 'open');
        const dayPnl = closedToday.reduce((s,x)=>s+pnlOfTrade(x),0);
        const personalLimit = Number(saved.dayStartBalance || saved.accountSize || 0) * Number(saved.personalDailyStopPct || 0) / 100;

        let lossStreak = 0;
        for (const t of [...list].reverse()) {
          if (t.status === 'open') continue;
          if (pnlOfTrade(t) < 0) lossStreak++;
          else break;
        }

        if (saved.blocked || (personalLimit > 0 && dayPnl <= -personalLimit)) {
          return { ok:false, reason:T('Personal/firm daily stop уже достигнут. Новые сделки на сегодня заблокированы системой риска.','Personal/firm daily stop has been reached. New trades are blocked for today by the risk guard.') };
        }
        if (lossStreak >= 2) {
          return { ok:false, reason:T('Два убытка подряд: включён STOP DAY. Новая сделка заблокирована до следующего торгового дня.','Two consecutive losses: STOP DAY is active. A new trade is blocked until the next trading day.') };
        }
      } catch (_) {}
      return { ok:true };
    }
  };

  // ===== Knowledge base =====
  async function renderKnowledge() {
    const box = $('kbResults');
    if (!box || !window.TradingCloud?.searchKnowledge) return;
    box.innerHTML = T('<span class="cloud-state">Загрузка…</span>','<span class="cloud-state">Loading…</span>');
    try {
      const docs = await window.TradingCloud.searchKnowledge($('kbSearch')?.value || '');
      box.innerHTML = docs.length ? docs.map(d =>
        '<article class="kb-item"><b>'+escapeHtmlSafe(d.title)+'</b><span>'+escapeHtmlSafe(d.category || '')+'</span><p>'+escapeHtmlSafe(d.content).slice(0,600)+'</p></article>'
      ).join('') : T('<span class="cloud-state">Пока нет записей.</span>','<span class="cloud-state">No records yet.</span>');
    } catch (e) { box.innerHTML = T('<span class="cloud-state">Войди в Supabase: ','<span class="cloud-state">Sign in to Supabase: ')+escapeHtmlSafe(e.message)+'</span>'; }
  }
  function escapeHtmlSafe(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  $('kbSave')?.addEventListener('click', async () => {
    const st = $('kbState');
    try {
      const title = $('kbTitle').value.trim(), content = $('kbContent').value.trim();
      if (!title || !content) throw new Error(T('Нужны title и content','Title and content are required'));
      await window.TradingCloud.saveKnowledge({
        title,
        category: $('kbCategory').value.trim() || 'notes',
        content,
        source:'system-hub'
      });
      $('kbTitle').value=''; $('kbContent').value='';
      st.textContent=T('Сохранено в Knowledge Base','Saved to Knowledge Base');
      renderKnowledge();
    } catch(e) { st.textContent='Ошибка: '+e.message; }
  });
  $('kbSearch')?.addEventListener('input', () => {
    clearTimeout(window.__kbTimer);
    window.__kbTimer = setTimeout(renderKnowledge, 250);
  });
  $('kbRefresh')?.addEventListener('click', renderKnowledge);

  // ===== Price alerts =====
  $('alertSave')?.addEventListener('click', async () => {
    const st = $('alertState');
    try {
      const symbol = $('alertSymbol').value.trim().toUpperCase();
      const price = Number($('alertPrice').value);
      const direction = $('alertDirection').value;
      if (!symbol || !price) throw new Error(T('Укажи symbol и price','Enter symbol and price'));
      await window.TradingCloud.createAlert({
        symbol,
        ruleType:'price',
        rule:{ direction, price }
      });
      st.textContent=T('Alert сохранён. Backend monitor можно активировать после Telegram webhook.','Alert saved. The backend monitor can be activated after the Telegram webhook is configured.');
    } catch(e) { st.textContent='Ошибка: '+e.message; }
  });

  // ===== cTrader read-only OAuth =====
  $('ctraderConnect')?.addEventListener('click', async () => {
    const st = $('ctraderState');
    try {
      if (!window.TradingCloud?.connectCTrader) throw new Error(T('Cloud tools не загружены','Cloud tools are not loaded'));
      if (st) st.textContent = T('Открываю cTrader OAuth…','Opening cTrader OAuth…');
      await window.TradingCloud.connectCTrader();
    } catch (e) {
      if (st) st.textContent = T(
        'cTrader пока не активирован: добавь CTRADER_CLIENT_ID / CTRADER_CLIENT_SECRET в Supabase Secrets после регистрации приложения.',
        'cTrader is not active yet: add CTRADER_CLIENT_ID / CTRADER_CLIENT_SECRET in Supabase Secrets after registering the app.'
      ) + ' ' + (e?.message || '');
    }
  });

  // ===== Telegram activation =====
  $('telegramActivate')?.addEventListener('click', async () => {
    const st = $('telegramState');
    try {
      if (!window.TradingCloud?.activateTelegram) throw new Error(T('Cloud tools не загружены','Cloud tools are not loaded'));
      if (st) st.textContent = T('Подключаю webhook и команды…','Registering webhook and commands…');
      const result = await window.TradingCloud.activateTelegram();
      if (st) st.textContent = T('Telegram подключён: @','Telegram connected: @') + (result.bot || 'bot');
    } catch (e) {
      if (st) st.textContent = T(
        'Не подключено: проверь Edge Function Secrets и повтори.',
        'Not connected: check Edge Function Secrets and try again.'
      ) + ' ' + (e?.message || '');
    }
  });

  // ===== Free local review =====
  $('localReviewBtn')?.addEventListener('click', () => {
    const raw = localStorage.getItem('tk_journal_trades_v2');
    const trades = raw ? JSON.parse(raw) : [];
    const last = trades.filter(t => t.status !== 'open').sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
    $('localReviewOutput').textContent = last ? localReview(last) : T('Нет закрытых сделок для разбора.','No closed trades to review.');
  });
})();