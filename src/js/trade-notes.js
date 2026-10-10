/**
 * trade-notes.js — Complete a trade that already exists in the journal.
 * A position synced from MT5 arrives with the broker's facts filled in; this window adds what only
 * the trader knows: setup, emotion, checklist, execution marks, reasons and the lesson.
 * Broker facts are not editable here. Unfinished trades can be worked through one after another.
 */
(() => {
  'use strict';
  if (!document.getElementById('openTradesBody')) return;

  const WORDS = {
    ru: { action: 'Дополнить', title: 'Дополнить сделку', save: 'Сохранить', next: 'Сохранить и дальше', skip: 'Пропустить', risk: 'риск', none: '—',
      todo: 'Незаполненные', start: 'Заполнить по очереди', of: 'из', hint: 'Enter — сохранить', todoHint: 'нет сетапа или не оценено исполнение' },
    uk: { action: 'Доповнити', title: 'Доповнити угоду', save: 'Зберегти', next: 'Зберегти й далі', skip: 'Пропустити', risk: 'ризик', none: '—',
      todo: 'Незаповнені', start: 'Заповнити по черзі', of: 'із', hint: 'Enter — зберегти', todoHint: 'немає сетапу або не оцінено виконання' },
    en: { action: 'Add notes', title: 'Complete the trade', save: 'Save', next: 'Save and next', skip: 'Skip', risk: 'risk', none: '—',
      todo: 'Unfinished', start: 'Fill in one by one', of: 'of', hint: 'Enter saves', todoHint: 'no setup, or execution not rated' },
    cs: { action: 'Doplnit', title: 'Doplnit obchod', save: 'Uložit', next: 'Uložit a další', skip: 'Přeskočit', risk: 'riziko', none: '—',
      todo: 'Nevyplněné', start: 'Vyplnit postupně', of: 'z', hint: 'Enter uloží', todoHint: 'chybí setup nebo hodnocení provedení' }
  };
  const words = () => WORDS[typeof currentLang === 'string' ? currentLang : 'ru'] || WORDS.en;
  const labels = () => (typeof translations !== 'undefined' && translations[currentLang]) || {};
  const journal = () => (typeof trades !== 'undefined' && Array.isArray(trades) ? trades : []);
  const FIELDS = [
    ['emotion', 'lbl_emotion', 'select', 'fEmotion'],
    ['strategy', 'lbl_strategy', 'input'],
    ['setup', 'lbl_setup', 'input'],
    ['timeframe', 'lbl_timeframe', 'select', 'fTimeframe'],
    ['entryReason', 'lbl_entry_reason', 'input'],
    ['exitReason', 'lbl_exit_reason', 'input'],
    ['notes', 'lbl_notes', 'textarea'],
    ['tags', 'lbl_tags', 'input']
  ];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'tradeNotesModal';
  overlay.innerHTML = '<div class="modal-box large" role="dialog" aria-modal="true" aria-labelledby="tradeNotesTitle">'
    + '<button class="modal-close" type="button" data-notes-close aria-label="Close">✕</button>'
    + '<p class="trade-notes-queue" id="tradeNotesQueue" hidden></p>'
    + '<h3 class="modal-title" id="tradeNotesTitle"></h3>'
    + '<p class="trade-notes-facts" id="tradeNotesFacts"></p>'
    + '<div id="tradeNotesPlaybooks"></div>'
    + '<div class="form-grid trade-notes-grid" id="tradeNotesGrid"></div>'
    + '<div id="tradeNotesExtras"></div>'
    + '<div class="form-actions"><span class="trade-notes-hint" id="tradeNotesHint"></span>'
    + '<button class="btn btn-ghost" type="button" id="tradeNotesSkip" hidden></button>'
    + '<button class="btn btn-primary" type="button" id="tradeNotesSave"></button></div>'
    + '</div>';
  document.body.append(overlay);
  const $ = id => overlay.querySelector('#' + id);
  const grid = $('tradeNotesGrid');
  let editingId = null, opener = null, saving = false;
  let queue = null;   // ids still to visit, when working through unfinished trades

  // Templates, checklist and marks are shared with the new-trade form.
  const extras = window.TradeExtras?.createExtras();
  if (extras) $('tradeNotesExtras').append(extras.element);
  const bar = window.TradeExtras?.createPlaybookBar({
    read: () => Object.fromEntries(['strategy', 'setup', 'timeframe', 'entryReason', 'tags'].map(key => [key, grid.querySelector('#tradeNotes_' + key)?.value || ''])),
    apply: values => {
      for (const key of ['strategy', 'setup', 'timeframe', 'entryReason', 'tags']) {
        const value = values[key];
        if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
        window.TradeExtras.setField(grid.querySelector('#tradeNotes_' + key), value);
      }
    }
  });
  if (bar) $('tradeNotesPlaybooks').append(bar.element);

  function control(key, kind, sourceId, value) {
    let el;
    if (kind === 'select') {
      el = document.createElement('select');
      el.className = 'f-select';
      // Offer the same choices as the main form, plus whatever is already stored on the trade.
      const options = [...(document.getElementById(sourceId)?.options || [])].map(o => o.value || o.textContent);
      if (!options.includes('')) options.unshift('');
      if (value && !options.includes(value)) options.push(value);
      for (const text of options) { const o = document.createElement('option'); o.value = text; o.textContent = text || words().none; el.append(o); }
    } else {
      el = document.createElement(kind);
      el.className = kind === 'textarea' ? 'f-textarea' : 'f-input';
    }
    el.id = 'tradeNotes_' + key;
    el.value = value;
    return el;
  }

  const signed = (value, digits = 2) => (value > 0 ? '+' : '') + value.toFixed(digits).replace('-', '−');
  function facts(tr) {
    const parts = [tr.side + ' ' + (tr.volume || '?') + ' @ ' + (tr.entry || '?')];
    if (tr.stopLoss) parts.push('SL ' + tr.stopLoss);
    if (tr.takeProfit) parts.push('TP ' + tr.takeProfit);
    if (tr.plannedRiskPct) parts.push(words().risk + ' ' + tr.plannedRiskPct + '%');
    if (tr.plannedRR) parts.push('R:R ' + tr.plannedRR);
    const insights = window.TradeInsights;
    if (insights) {
      const r = insights.rOf(tr), move = insights.excursionOf(tr);
      if (r !== null) parts.push(signed(r) + 'R');
      if (move) parts.push('MAE ' + signed(move.mae) + 'R', 'MFE ' + signed(move.mfe) + 'R');
    }
    if (tr.session) parts.push(tr.session);
    if (tr.accountLabel) parts.push(tr.accountLabel);
    return parts.join(' · ');
  }

  function show(tr) {
    const t = words();
    editingId = tr.id;
    $('tradeNotesTitle').textContent = t.title + ': ' + (tr.ticker || '') + (tr.date ? ' · ' + tr.date : '');
    $('tradeNotesFacts').textContent = facts(tr);
    $('tradeNotesSave').textContent = queue ? t.next : t.save;
    $('tradeNotesSkip').textContent = t.skip;
    $('tradeNotesSkip').hidden = !queue;
    $('tradeNotesHint').textContent = t.hint;
    const progress = $('tradeNotesQueue');
    progress.hidden = !queue;
    if (queue) progress.textContent = t.todo + ': ' + (queue.total - queue.ids.length + 1) + ' ' + t.of + ' ' + queue.total;
    grid.replaceChildren();
    for (const [key, labelKey, kind, sourceId] of FIELDS) {
      const wrap = document.createElement('div');
      wrap.className = 'f-field' + (kind === 'textarea' || key === 'entryReason' || key === 'exitReason' ? ' span2' : '');
      const label = document.createElement('label');
      label.className = 'f-lbl';
      label.textContent = labels()[labelKey] || key;
      const value = key === 'tags' ? (Array.isArray(tr.tags) ? tr.tags.join(', ') : '') : (tr[key] || '');
      const el = control(key, kind, sourceId, value);
      label.htmlFor = el.id;
      wrap.append(label, el);
      grid.append(wrap);
    }
    extras?.set(tr);
    bar?.clear();
    overlay.classList.add('show');
    overlay.querySelector('.modal-box').scrollTop = 0;
    // Start where the trader usually has something to say first.
    (grid.querySelector('#tradeNotes_setup') || grid.querySelector('input,select,textarea'))?.focus();
  }

  function open(id) {
    const tr = journal().find(x => String(x.id) === String(id));
    if (!tr) return;
    if (!overlay.classList.contains('show')) opener = document.activeElement;
    queue = null;
    show(tr);
  }

  /** Work through every unfinished trade, open positions first. */
  function openQueue() {
    const ids = (window.TradeInsights?.incomplete(journal()) || []).map(t => t.id);
    if (!ids.length) return;
    if (!overlay.classList.contains('show')) opener = document.activeElement;
    queue = { ids, total: ids.length };
    show(journal().find(t => t.id === ids[0]));
  }

  function advance() {
    if (!queue) { close(); return; }
    queue.ids.shift();
    const next = queue.ids.map(id => journal().find(t => t.id === id)).find(Boolean);
    if (!next) { close(); return; }
    queue.ids = queue.ids.slice(queue.ids.indexOf(next.id));
    show(next);
  }

  function close() {
    overlay.classList.remove('show');
    editingId = null; queue = null;
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
  }

  async function save() {
    const tr = journal().find(x => x.id === editingId);
    if (!tr || typeof saveTrades !== 'function' || saving) return;
    const updated = { ...tr };
    for (const [key] of FIELDS) {
      const raw = grid.querySelector('#tradeNotes_' + key)?.value ?? '';
      updated[key] = key === 'tags' ? raw.split(',').map(x => x.trim()).filter(Boolean) : raw.trim();
    }
    if (extras) Object.assign(updated, extras.read());
    if (bar?.active) updated.playbook = bar.active;
    saving = true;
    let saved;
    try { saved = await saveTrades([updated]); } finally { saving = false; }
    if (!saved) return;   // saveTrades reports the reason itself
    Object.assign(tr, updated);
    const wasQueue = !!queue;
    if (wasQueue) advance(); else close();
    // Rendering rebuilds the tables; in a queue the window stays open over them.
    if (typeof renderAll === 'function') renderAll();
  }

  overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-notes-close]')) close(); });
  $('tradeNotesSave').addEventListener('click', save);
  $('tradeNotesSkip').addEventListener('click', advance);
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    const tag = e.target.tagName;
    if (e.ctrlKey || e.metaKey || (tag === 'INPUT' && e.target.type !== 'checkbox' && grid.contains(e.target))) { e.preventDefault(); save(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('show')) close(); });

  /* ---- "Unfinished" counter above the tables ---- */
  const todoBar = document.createElement('div');
  todoBar.className = 'todo-bar';
  todoBar.id = 'todoBar';
  todoBar.hidden = true;
  const todoText = document.createElement('span');
  const todoButton = document.createElement('button');
  todoButton.type = 'button'; todoButton.className = 'btn btn-primary'; todoButton.id = 'todoStart';
  todoButton.addEventListener('click', openQueue);
  todoBar.append(todoText, todoButton);
  document.querySelector('#trades .sec-head')?.after(todoBar);

  function renderTodo() {
    const count = window.TradeInsights ? window.TradeInsights.incomplete(journal()).length : 0;
    todoBar.hidden = !count;
    const t = words();
    const strong = document.createElement('b'); strong.textContent = String(count);
    todoText.replaceChildren(t.todo + ': ', strong, ' · ' + t.todoHint);
    todoButton.textContent = t.start;
  }

  // The tables are rebuilt on every render, so the button is added again after each one.
  function decorate() {
    for (const actions of document.querySelectorAll('#openTradesBody .row-actions, #closedTradesBody .row-actions')) {
      const id = actions.querySelector('[data-del]')?.dataset.del;
      if (!id || actions.querySelector('[data-notes]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'row-btn';
      button.dataset.notes = id;
      // An icon keeps the row narrow; the name is there for the tooltip and for screen readers.
      button.textContent = '✎';
      button.title = words().action;
      button.setAttribute('aria-label', words().action);
      actions.insertBefore(button, actions.querySelector('[data-del]'));
    }
    renderTodo();
  }
  document.addEventListener('journal:trades-updated', decorate);
  document.addEventListener('click', e => { const button = e.target.closest?.('[data-notes]'); if (button) open(button.dataset.notes); });
  document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(renderTodo, 0));

  window.TradeNotes = { open, openQueue, close };
  decorate();
})();
