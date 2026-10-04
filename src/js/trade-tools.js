/**
 * trade-tools.js — Interactive calculator, prop dashboard, knowledge base,
 * alerts and local rule-based analyst. No paid API required.
 */
(() => {
  const $ = id => document.getElementById(id);
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
    if (!t.entryReason) reasons.push('Причина входа не зафиксирована — это снижает качество последующего анализа.');
    if (!t.exitReason && t.status !== 'open') reasons.push('Для закрытой сделки не указана причина выхода.');
    if (/fomo|жад|азарт|страх|раздраж|нетерп/.test(emotion)) reasons.push('Эмоциональный фактор мог влиять на решение; перед следующим входом нужен короткий pre-trade checklist.');
    if (Math.abs(pct) > 2) reasons.push('Движение PNL относительно депозита крупное — проверь, не был ли размер позиции завышен.');
    if (!reasons.length) reasons.push('По журналу критических нарушений не видно; продолжай собирать выборку, а не оценивать стратегию по одной сделке.');
    return [
      'FREE LOCAL REVIEW',
      '',
      'Результат: ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USD' + (deposit ? ' (' + pct.toFixed(2) + '% от указанного депозита)' : ''),
      'Сделка: ' + (t.side || '—') + ' ' + (t.ticker || '—') + (entry ? ' @ ' + entry : '') + (exit ? ' → ' + exit : ''),
      '',
      'Контроль процесса:',
      ...reasons.map(x => '• ' + x),
      '',
      'Следующий шаг: повторяй один сетап, заранее определяй invalidation и риск, затем сравни минимум 20–30 однотипных сделок.'
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
        ? '<strong style="color:var(--neg)">Проверь направление Stop/Target.</strong>'
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
      personalDailyStopPct:m.personalPct,
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
      state.textContent = 'Сохранено в Supabase · ' + saved.firm + ' ' + (saved.program || '');
    } catch (e) { state.textContent = 'Ошибка: ' + e.message; }
  });
  applyPreset();

  window.TradingRiskGuard = {
    async canAddTrade() {
      try {
        const saved = JSON.parse(localStorage.getItem('tk_prop_guard') || '{}');
        if (saved.blocked) return { ok:false, reason:'Personal/firm daily stop уже достигнут. Новые сделки на сегодня заблокированы системой риска.' };
      } catch (_) {}
      return { ok:true };
    }
  };

  // ===== Knowledge base =====
  async function renderKnowledge() {
    const box = $('kbResults');
    if (!box || !window.TradingCloud?.searchKnowledge) return;
    box.innerHTML = '<span class="cloud-state">Загрузка…</span>';
    try {
      const docs = await window.TradingCloud.searchKnowledge($('kbSearch')?.value || '');
      box.innerHTML = docs.length ? docs.map(d =>
        '<article class="kb-item"><b>'+escapeHtmlSafe(d.title)+'</b><span>'+escapeHtmlSafe(d.category || '')+'</span><p>'+escapeHtmlSafe(d.content).slice(0,600)+'</p></article>'
      ).join('') : '<span class="cloud-state">Пока нет записей.</span>';
    } catch (e) { box.innerHTML = '<span class="cloud-state">Войди в Supabase: '+escapeHtmlSafe(e.message)+'</span>'; }
  }
  function escapeHtmlSafe(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  $('kbSave')?.addEventListener('click', async () => {
    const st = $('kbState');
    try {
      const title = $('kbTitle').value.trim(), content = $('kbContent').value.trim();
      if (!title || !content) throw new Error('Нужны title и content');
      await window.TradingCloud.saveKnowledge({
        title,
        category: $('kbCategory').value.trim() || 'notes',
        content,
        source:'system-hub'
      });
      $('kbTitle').value=''; $('kbContent').value='';
      st.textContent='Сохранено в Knowledge Base';
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
      if (!symbol || !price) throw new Error('Укажи symbol и price');
      await window.TradingCloud.createAlert({
        symbol,
        ruleType:'price',
        rule:{ direction, price }
      });
      st.textContent='Alert сохранён. Backend monitor можно активировать после Telegram webhook.';
    } catch(e) { st.textContent='Ошибка: '+e.message; }
  });

  // ===== Free local review =====
  $('localReviewBtn')?.addEventListener('click', () => {
    const raw = localStorage.getItem('tk_journal_trades_v2');
    const trades = raw ? JSON.parse(raw) : [];
    const last = trades.filter(t => t.status !== 'open').sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
    $('localReviewOutput').textContent = last ? localReview(last) : 'Нет закрытых сделок для разбора.';
  });
})();