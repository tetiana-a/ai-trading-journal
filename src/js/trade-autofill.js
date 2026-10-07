/** Local drafts and history suggestions. Filling a form never submits a trade. */
(() => {
  'use strict';
  const form = document.querySelector('#add .form-card');
  if (!form) return;
  const DRAFT = 'tk_trade_draft_v1', CONTEXT = 'tk_trade_context_v1';
  const mapping = {
    fTicker:'ticker', fDate:'date', fSide:'side', fStatus:'status', fDeposit:'deposit',
    fEntry:'entry', fExit:'exit', fVolume:'volume', fEmotion:'emotion', fBroker:'broker',
    fAccount:'accountLabel', fStrategy:'strategy', fSetup:'setup', fTimeframe:'timeframe',
    fSession:'session', fStopLoss:'stopLoss', fTakeProfit:'takeProfit',
    fPlannedRisk:'plannedRiskPct', fPlannedRR:'plannedRR', fFees:'fees', fTags:'tags',
    fEntryReason:'entryReason', fExitReason:'exitReason', fNotes:'notes'
  };
  const contextIds = ['fBroker','fAccount','fStrategy','fSetup','fTimeframe','fSession'];
  const fields = Object.keys(mapping).map(id => document.getElementById(id)).filter(Boolean);
  const $ = id => document.getElementById(id);
  const copy = {
    ru:{title:'Быстрое заполнение',choose:'Выберите сделку из истории',fill:'Заполнить форму',clear:'Очистить поля',notes:'Заметка из истории',help:'Подсказки из истории · черновик сохраняется на этом устройстве. Цены, дату и объём проверьте перед добавлением. Скриншоты не копируются.',saved:'Черновик сохранён',restored:'Черновик восстановлен — проверьте дату и цены.',filled:'Поля скопированы. Проверьте их и нажмите «Добавить сделку».',cleared:'Поля очищены',unavailable:'Сохранение черновика недоступно в этом браузере.',ready:'Подсказки появятся после первой сделки.'},
    en:{title:'Quick fill',choose:'Choose a trade from history',fill:'Fill form',clear:'Clear fields',notes:'Note from history',help:'History suggestions · draft saved on this device. Review prices, date and size before adding. Screenshots are not copied.',saved:'Draft saved',restored:'Draft restored — review the date and prices.',filled:'Fields copied. Review them and press Add Trade.',cleared:'Fields cleared',unavailable:'Draft storage is unavailable in this browser.',ready:'Suggestions appear after your first trade.'},
    uk:{title:'Швидке заповнення',choose:'Виберіть угоду з історії',fill:'Заповнити форму',clear:'Очистити поля',notes:'Нотатка з історії',help:'Підказки з історії · чернетка на цьому пристрої. Перевірте ціни, дату й обсяг перед додаванням. Скриншоти не копіюються.',saved:'Чернетку збережено',restored:'Чернетку відновлено — перевірте дату й ціни.',filled:'Поля скопійовано. Перевірте та додайте угоду.',cleared:'Поля очищено',unavailable:'Збереження чернетки недоступне.',ready:'Підказки з’являться після першої угоди.'},
    cs:{title:'Rychlé vyplnění',choose:'Vyberte obchod z historie',fill:'Vyplnit formulář',clear:'Vymazat pole',notes:'Poznámka z historie',help:'Návrhy z historie · koncept v tomto zařízení. Před přidáním ověřte ceny, datum a objem. Snímky se nekopírují.',saved:'Koncept uložen',restored:'Koncept obnoven — ověřte datum a ceny.',filled:'Pole zkopírována. Zkontrolujte je a přidejte obchod.',cleared:'Pole vymazána',unavailable:'Uložení konceptu není dostupné.',ready:'Návrhy se objeví po prvním obchodu.'}
  };
  const words = () => copy[typeof currentLang === 'undefined' ? 'ru' : currentLang] || copy.en;
  const history = () => typeof trades === 'undefined' || !Array.isArray(trades) ? [] : [...trades].reverse().sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
  const text = value => Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
  function read(key) { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; } catch (_) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  let statusKey = 'ready', timer = null, notes = [];
  const toolbar = document.createElement('div'); toolbar.className = 'trade-autofill';
  toolbar.innerHTML = '<strong id="autofillTitle"></strong><div class="autofill-actions"><select id="autofillTrade" class="f-select"></select><button type="button" id="autofillApply" class="btn btn-ghost"></button><button type="button" id="autofillClear" class="btn btn-ghost"></button></div><p id="autofillHelp"></p><p id="autofillState" role="status" aria-live="polite"></p>';
  form.prepend(toolbar);
  const notePicker = document.createElement('select'); notePicker.id = 'autofillNotes'; notePicker.className = 'f-select autofill-notes';
  $('fNotes').after(notePicker);

  fields.forEach(field => {
    field.name ||= mapping[field.id]; field.autocomplete = 'on';
    const label = field.closest('.f-field')?.querySelector('label');
    if (label && !label.htmlFor) label.htmlFor = field.id;
    if (field.tagName === 'INPUT' && field.type !== 'date') {
      const list = document.createElement('datalist'); list.id = field.id + 'Suggestions';
      field.setAttribute('list', list.id); form.appendChild(list);
    }
  });
  // The close-trade dialog shares the same exit suggestions, without copying an old close price.
  ['closeExitPrice','closeExitReason'].forEach((id,index) => {
    const field = $(id); if (!field) return;
    field.name = index ? 'exitReason' : 'exit'; field.autocomplete = 'on';
    field.setAttribute('list', index ? 'fExitReasonSuggestions' : 'fExitSuggestions');
    const label = field.closest('.f-field')?.querySelector('label'); if (label) label.htmlFor = id;
  });
  function status(key) { statusKey = key; $('autofillState').textContent = words()[key]; }
  function emotionKey(value) {
    if (typeof translations === 'undefined') return '';
    for (const dictionary of Object.values(translations)) {
      const key = Object.keys(dictionary).find(k => k.startsWith('emo_') && dictionary[k] === value);
      if (key) return key;
    }
    return '';
  }
  function setField(field,value,key = '') {
    value = text(value);
    if (field.id === 'fEmotion') {
      const translated = [...field.options].find(option => option.dataset.i18n === (key || emotionKey(value)));
      if (translated) value = translated.value;
    }
    if (field.tagName === 'SELECT' && value && ![...field.options].some(option => option.value === value)) {
      const option = document.createElement('option'); option.value = value; option.textContent = value;
      field.appendChild(option);
    }
    field.value = value;
  }
  function snapshot() { return {version:1,fields:Object.fromEntries(fields.map(f => [f.id,f.value])),emotionKey:$('fEmotion').selectedOptions[0]?.dataset.i18n || '',updatedAt:new Date().toISOString()}; }
  function saveDraft() { clearTimeout(timer); timer = null; status(write(DRAFT,snapshot()) ? 'saved' : 'unavailable'); }
  function changed() { clearTimeout(timer); timer = setTimeout(saveDraft,200); }
  fields.forEach(field => { field.addEventListener('input',changed); field.addEventListener('change',changed); });
  function refreshHistory() {
    const rows = history(); const select = $('autofillTrade'), previous = select.value;
    select.replaceChildren(new Option(words().choose,''));
    rows.slice(0,200).forEach(trade => {
      if (trade.id == null) return;
      select.add(new Option([trade.date,trade.ticker,trade.side,trade.accountLabel || trade.broker].filter(Boolean).join(' · '),String(trade.id)));
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
    $('autofillApply').disabled = !select.value;
    fields.forEach(field => {
      const list = $(field.id + 'Suggestions'); if (!list) return;
      let values = [...new Set(rows.map(row => text(row[mapping[field.id]])).filter(Boolean))];
      if (field.type === 'number') values = values.filter(value => Number.isFinite(Number(value)));
      list.replaceChildren(...values.slice(0,50).map(value => new Option(value,value)));
    });
    notes = [...new Set(rows.map(row => text(row.notes)).filter(Boolean))].slice(0,50);
    notePicker.replaceChildren(new Option(words().notes,''),...notes.map((note,index) => new Option(note.slice(0,100),String(index))));
    notePicker.hidden = notes.length === 0;
  }
  function labels() {
    const t = words(); $('autofillTitle').textContent = t.title; $('autofillApply').textContent = t.fill;
    $('autofillClear').textContent = t.clear; $('autofillHelp').textContent = t.help;
    $('autofillTrade').setAttribute('aria-label',t.choose); notePicker.setAttribute('aria-label',t.notes);
    status(statusKey); refreshHistory();
  }
  $('autofillTrade').addEventListener('change',() => { $('autofillApply').disabled = !$('autofillTrade').value; });
  $('autofillApply').addEventListener('click',() => {
    const trade = history().find(row => String(row.id) === $('autofillTrade').value); if (!trade) return;
    fields.forEach(field => setField(field,trade[mapping[field.id]]));
    const advanced = form.querySelector('details.advanced-trade'); if (advanced) advanced.open = true;
    if (typeof clearValidationErrors === 'function') clearValidationErrors();
    $('fTicker').dispatchEvent(new Event('input',{bubbles:true}));
    saveDraft(); if (statusKey !== 'unavailable') status('filled');
    $('fTicker').focus();
  });
  $('autofillClear').addEventListener('click',() => {
    fields.forEach(field => { field.value = field.tagName === 'SELECT' ? field.options[0]?.value || '' : ''; });
    $('fDate').value = today();
    if (typeof clearValidationErrors === 'function') clearValidationErrors();
    $('fTicker').dispatchEvent(new Event('input',{bubbles:true}));
    saveDraft(); if (statusKey !== 'unavailable') status('cleared');
  });
  notePicker.addEventListener('change',() => {
    if (notePicker.value === '') return;
    $('fNotes').value = notes[Number(notePicker.value)] || ''; saveDraft(); $('fNotes').focus();
  });
  document.addEventListener('journal:trades-updated',refreshHistory);
  document.addEventListener('journal:trade-added',event => {
    clearTimeout(timer); timer = null;
    const context = Object.fromEntries(contextIds.map(id => [id,text(event.detail?.[mapping[id]])]));
    const persisted = write(CONTEXT,context);
    try { localStorage.removeItem(DRAFT); } catch (_) {}
    contextIds.forEach(id => setField($(id),context[id])); $('fDate').value = today();
    status(persisted ? 'ready' : 'unavailable'); refreshHistory();
  });
  $('langSelect')?.addEventListener('change',labels);
  // Flush pending edits before leaving, but never recreate a cleared post-save draft.
  window.addEventListener('pagehide',() => { if (timer !== null) saveDraft(); });
  document.addEventListener('visibilitychange',() => { if (document.hidden && timer !== null) saveDraft(); });
  labels();
  const draft = read(DRAFT);
  if (draft?.version === 1 && draft.fields && typeof draft.fields === 'object') {
    fields.forEach(field => { if (Object.hasOwn(draft.fields,field.id)) setField(field,draft.fields[field.id],draft.emotionKey); });
    if (contextIds.some(id => $(id).value) && form.querySelector('details.advanced-trade')) form.querySelector('details.advanced-trade').open = true;
    status('restored');
  } else {
    const context = read(CONTEXT);
    if (context) contextIds.forEach(id => { if (!$(id).value && Object.hasOwn(context,id)) setField($(id),context[id]); });
    if (!$('fDate').value) $('fDate').value = today();
  }
})();
