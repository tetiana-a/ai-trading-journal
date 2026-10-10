/**
 * trade-notes.js — Complete a trade that already exists in the journal.
 * A position synced from MT5 arrives with the broker's facts filled in; this window adds what only
 * the trader knows: emotion, strategy, setup, reasons and the lesson. Broker facts are not editable here.
 */
(() => {
  'use strict';
  if (!document.getElementById('openTradesBody')) return;

  const WORDS = {
    ru: { action: 'Дополнить', title: 'Дополнить сделку', save: 'Сохранить', risk: 'риск', none: '—' },
    uk: { action: 'Доповнити', title: 'Доповнити угоду', save: 'Зберегти', risk: 'ризик', none: '—' },
    en: { action: 'Add notes', title: 'Complete the trade', save: 'Save', risk: 'risk', none: '—' },
    cs: { action: 'Doplnit', title: 'Doplnit obchod', save: 'Uložit', risk: 'riziko', none: '—' }
  };
  const words = () => WORDS[typeof currentLang === 'string' ? currentLang : 'ru'] || WORDS.en;
  const labels = () => (typeof translations !== 'undefined' && translations[currentLang]) || {};
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
    + '<h3 class="modal-title" id="tradeNotesTitle"></h3>'
    + '<p class="trade-notes-facts" id="tradeNotesFacts"></p>'
    + '<div class="form-grid trade-notes-grid" id="tradeNotesGrid"></div>'
    + '<div class="form-actions"><button class="btn btn-primary" type="button" id="tradeNotesSave"></button></div>'
    + '</div>';
  document.body.append(overlay);
  const grid = overlay.querySelector('#tradeNotesGrid');
  let editingId = null, opener = null;

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

  function facts(tr) {
    const parts = [tr.side + ' ' + (tr.volume || '?') + ' @ ' + (tr.entry || '?')];
    if (tr.stopLoss) parts.push('SL ' + tr.stopLoss);
    if (tr.takeProfit) parts.push('TP ' + tr.takeProfit);
    if (tr.plannedRiskPct) parts.push(words().risk + ' ' + tr.plannedRiskPct + '%');
    if (tr.plannedRR) parts.push('R:R ' + tr.plannedRR);
    if (tr.session) parts.push(tr.session);
    if (tr.accountLabel) parts.push(tr.accountLabel);
    return parts.join(' · ');
  }

  function open(id) {
    const tr = (typeof trades !== 'undefined' ? trades : []).find(x => String(x.id) === String(id));
    if (!tr) return;
    editingId = tr.id;
    opener = document.activeElement;
    overlay.querySelector('#tradeNotesTitle').textContent = words().title + ': ' + (tr.ticker || '') + (tr.date ? ' · ' + tr.date : '');
    overlay.querySelector('#tradeNotesFacts').textContent = facts(tr);
    overlay.querySelector('#tradeNotesSave').textContent = words().save;
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
    overlay.classList.add('show');
    // Start where the trader usually has something to say first.
    (grid.querySelector('#tradeNotes_setup') || grid.querySelector('input,select,textarea'))?.focus();
  }

  function close() {
    overlay.classList.remove('show');
    editingId = null;
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
  }

  async function save() {
    const tr = (typeof trades !== 'undefined' ? trades : []).find(x => x.id === editingId);
    if (!tr || typeof saveTrades !== 'function') return;
    const updated = { ...tr };
    for (const [key] of FIELDS) {
      const raw = grid.querySelector('#tradeNotes_' + key)?.value ?? '';
      updated[key] = key === 'tags' ? raw.split(',').map(x => x.trim()).filter(Boolean) : raw.trim();
    }
    if (!await saveTrades([updated])) return;   // saveTrades reports the reason itself
    Object.assign(tr, updated);
    close();
    if (typeof renderAll === 'function') renderAll();
  }

  overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-notes-close]')) close(); });
  overlay.querySelector('#tradeNotesSave').addEventListener('click', save);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('show')) close(); });

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
  }
  document.addEventListener('journal:trades-updated', decorate);
  document.addEventListener('click', e => { const button = e.target.closest?.('[data-notes]'); if (button) open(button.dataset.notes); });

  window.TradeNotes = { open, close };
  decorate();
})();
