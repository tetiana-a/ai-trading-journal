/**
 * trade-extras.js — The parts of a trade record that are picked, not typed:
 * setup templates, the pre-entry checklist and the execution marks ("by the plan" or the mistakes made).
 * Used by the new-trade form and by the "complete the trade" window.
 */
(() => {
  'use strict';
  const settings = window.JournalSettings;
  if (!settings) return;

  const WORDS = {
    ru: { check: 'Чек-лист перед входом', marks: 'Исполнение', marksHint: '«По плану» или ошибки, которые были',
      playbooks: 'Шаблоны сетапов', add: '＋ Шаблон из полей', name: 'Название шаблона', save: 'Сохранить', cancel: 'Отмена',
      manage: 'Изменить', done: 'Готово', remove: 'Удалить шаблон', lists: 'Свои списки', listsTitle: 'Ошибки и чек-лист',
      marksLabel: 'Ошибки — по одной на строку', checkLabel: 'Пункты чек-листа — по одному на строку',
      listsNote: 'Отметки в старых сделках сохраняются, даже если убрать пункт из списка.',
      needFields: 'Сначала заполните стратегию или сетап.', saved: 'Шаблон сохранён', empty: 'Шаблонов пока нет.' },
    uk: { check: 'Чек-лист перед входом', marks: 'Виконання', marksHint: '«За планом» або помилки, які були',
      playbooks: 'Шаблони сетапів', add: '＋ Шаблон із полів', name: 'Назва шаблону', save: 'Зберегти', cancel: 'Скасувати',
      manage: 'Змінити', done: 'Готово', remove: 'Видалити шаблон', lists: 'Свої списки', listsTitle: 'Помилки та чек-лист',
      marksLabel: 'Помилки — по одній на рядок', checkLabel: 'Пункти чек-листа — по одному на рядок',
      listsNote: 'Позначки у старих угодах зберігаються, навіть якщо прибрати пункт зі списку.',
      needFields: 'Спочатку заповніть стратегію або сетап.', saved: 'Шаблон збережено', empty: 'Шаблонів поки немає.' },
    en: { check: 'Pre-entry checklist', marks: 'Execution', marksHint: '"By the plan" or the mistakes that happened',
      playbooks: 'Setup templates', add: '＋ Template from fields', name: 'Template name', save: 'Save', cancel: 'Cancel',
      manage: 'Edit', done: 'Done', remove: 'Delete template', lists: 'My lists', listsTitle: 'Mistakes and checklist',
      marksLabel: 'Mistakes — one per line', checkLabel: 'Checklist items — one per line',
      listsNote: 'Marks on older trades are kept even if an item is removed from the list.',
      needFields: 'Fill in the strategy or the setup first.', saved: 'Template saved', empty: 'No templates yet.' },
    cs: { check: 'Checklist před vstupem', marks: 'Provedení', marksHint: '„Podle plánu“ nebo chyby, které nastaly',
      playbooks: 'Šablony setupů', add: '＋ Šablona z polí', name: 'Název šablony', save: 'Uložit', cancel: 'Zrušit',
      manage: 'Upravit', done: 'Hotovo', remove: 'Smazat šablonu', lists: 'Vlastní seznamy', listsTitle: 'Chyby a checklist',
      marksLabel: 'Chyby — jedna na řádek', checkLabel: 'Položky checklistu — jedna na řádek',
      listsNote: 'Značky u starších obchodů zůstávají, i když položku ze seznamu odeberete.',
      needFields: 'Nejprve vyplňte strategii nebo setup.', saved: 'Šablona uložena', empty: 'Zatím žádné šablony.' }
  };
  const words = () => WORDS[typeof currentLang === 'string' ? currentLang : 'ru'] || WORDS.en;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  let serial = 0;

  /** Checklist plus execution marks. Returns the element and a way to read and set its state. */
  function createExtras() {
    const id = ++serial;
    const box = el('div', 'trade-extras');
    let ticked = new Set(), marked = new Set();

    function render() {
      const t = words(), items = settings.checklist(), mistakes = settings.marks();
      const checkBlock = el('fieldset', 'extras-block');
      const checkTitle = el('legend', 'f-lbl', t.check + ' ');
      const score = el('span', 'extras-score', [...ticked].filter(x => items.some(i => i.id === x)).length + '/' + items.length);
      checkTitle.append(score);
      const checks = el('div', 'extras-checks');
      for (const item of items) {
        const label = el('label', 'extras-check');
        const input = el('input');
        input.type = 'checkbox'; input.checked = ticked.has(item.id); input.dataset.check = item.id;
        label.append(input, el('span', '', item.label));
        checks.append(label);
      }
      checkBlock.append(checkTitle, checks);
      checkBlock.hidden = !items.length;

      const markBlock = el('fieldset', 'extras-block');
      markBlock.append(el('legend', 'f-lbl', t.marks), el('p', 'extras-hint', t.marksHint));
      const chips = el('div', 'extras-chips');
      const known = new Set(['plan', ...mistakes.map(m => m.id)]);
      // A mark set earlier stays visible even after it was removed from the list.
      const extra = [...marked].filter(x => !known.has(x)).map(x => ({ id: x, label: settings.markLabel(x) }));
      for (const item of [{ id: 'plan', label: settings.markLabel('plan') }, ...mistakes, ...extra]) {
        const chip = el('button', 'extras-chip' + (item.id === 'plan' ? ' good' : ''), item.label);
        chip.type = 'button'; chip.dataset.mark = item.id; chip.setAttribute('aria-pressed', String(marked.has(item.id)));
        chips.append(chip);
      }
      markBlock.append(chips);
      box.replaceChildren(checkBlock, markBlock);
    }

    box.addEventListener('change', e => {
      const key = e.target.dataset?.check;
      if (!key) return;
      if (e.target.checked) ticked.add(key); else ticked.delete(key);
      const score = box.querySelector('.extras-score');
      if (score) score.textContent = box.querySelectorAll('[data-check]:checked').length + '/' + box.querySelectorAll('[data-check]').length;
    });
    box.addEventListener('click', e => {
      const chip = e.target.closest('[data-mark]');
      if (!chip) return;
      const key = chip.dataset.mark;
      if (marked.has(key)) marked.delete(key);
      else if (key === 'plan') marked = new Set(['plan']);   // "by the plan" and a mistake cannot both be true
      else { marked.delete('plan'); marked.add(key); }
      for (const node of box.querySelectorAll('[data-mark]')) node.setAttribute('aria-pressed', String(marked.has(node.dataset.mark)));
    });
    const refresh = () => { if (document.contains(box)) render(); };
    document.addEventListener('journal:settings', refresh);
    document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(refresh, 0));

    render();
    return {
      element: box, id,
      /** An untouched checklist is "not recorded", which is different from "everything skipped". */
      read() {
        const items = settings.checklist().map(i => i.id);
        const done = items.filter(x => ticked.has(x));
        return { marks: [...marked], checklist: done.length ? { done, missed: items.filter(x => !ticked.has(x)) } : null };
      },
      set(trade) {
        marked = new Set(Array.isArray(trade?.marks) ? trade.marks : []);
        ticked = new Set(Array.isArray(trade?.checklist?.done) ? trade.checklist.done : []);
        render();
      },
      reset() { marked = new Set(); ticked = new Set(); render(); }
    };
  }

  /**
   * A row of setup templates. `read()` returns the current values of the host's fields (to save
   * them as a template); `apply(values, template)` writes a template into those fields.
   */
  function createPlaybookBar({ read, apply }) {
    const bar = el('div', 'playbook-bar');
    let managing = false, naming = false, active = '', note = '';

    function render() {
      const t = words(), list = settings.playbooks();
      const title = el('span', 'f-lbl', t.playbooks);
      const chips = el('div', 'playbook-chips');
      for (const item of list) {
        const chip = el('button', 'extras-chip', item.name);
        chip.type = 'button'; chip.dataset.playbook = item.id; chip.setAttribute('aria-pressed', String(item.id === active));
        chips.append(chip);
        if (managing) {
          const remove = el('button', 'playbook-remove', '✕');
          remove.type = 'button'; remove.dataset.removePlaybook = item.id; remove.title = t.remove; remove.setAttribute('aria-label', t.remove + ': ' + item.name);
          chips.append(remove);
        }
      }
      if (!list.length) chips.append(el('span', 'extras-hint', t.empty));
      const tools = el('div', 'playbook-tools');
      if (naming) {
        const input = el('input', 'f-input playbook-name');
        input.placeholder = t.name; input.maxLength = 60; input.setAttribute('aria-label', t.name);
        const save = el('button', 'btn btn-primary', t.save); save.type = 'button'; save.dataset.playbookAction = 'save';
        const cancel = el('button', 'btn btn-ghost', t.cancel); cancel.type = 'button'; cancel.dataset.playbookAction = 'cancel';
        tools.append(input, save, cancel);
      } else {
        const add = el('button', 'playbook-link', t.add); add.type = 'button'; add.dataset.playbookAction = 'name';
        tools.append(add);
        if (list.length) { const manage = el('button', 'playbook-link', managing ? t.done : t.manage); manage.type = 'button'; manage.dataset.playbookAction = 'manage'; tools.append(manage); }
        const lists = el('button', 'playbook-link', t.lists); lists.type = 'button'; lists.dataset.playbookAction = 'lists';
        tools.append(lists);
      }
      const status = el('span', 'playbook-note', note); status.setAttribute('role', 'status');
      bar.replaceChildren(title, chips, tools, status);
      if (naming) bar.querySelector('.playbook-name').focus();
    }

    function saveTemplate() {
      const values = read() || {};
      const name = bar.querySelector('.playbook-name')?.value || '';
      if (!String(values.strategy || '').trim() && !String(values.setup || '').trim()) { note = words().needFields; naming = false; render(); return; }
      const saved = settings.savePlaybook(name || values.setup || values.strategy, values);
      if (saved) { active = saved.id; note = words().saved; }
      naming = false; render();
    }

    bar.addEventListener('click', e => {
      const remove = e.target.closest('[data-remove-playbook]');
      if (remove) { settings.removePlaybook(remove.dataset.removePlaybook); return; }
      const chip = e.target.closest('[data-playbook]');
      if (chip) {
        const item = settings.playbooks().find(p => p.id === chip.dataset.playbook);
        if (!item) return;
        active = item.id; note = '';
        apply(item, item);
        render();
        return;
      }
      const action = e.target.closest('[data-playbook-action]')?.dataset.playbookAction;
      if (action === 'name') { naming = true; note = ''; render(); }
      else if (action === 'cancel') { naming = false; render(); }
      else if (action === 'save') saveTemplate();
      else if (action === 'manage') { managing = !managing; render(); }
      else if (action === 'lists') openLists();
    });
    bar.addEventListener('keydown', e => {
      if (!e.target.classList?.contains('playbook-name')) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveTemplate(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); naming = false; render(); }
    });
    const refresh = () => { if (document.contains(bar)) render(); };
    document.addEventListener('journal:settings', refresh);
    document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(refresh, 0));

    render();
    return { element: bar, get active() { return active ? settings.playbooks().find(p => p.id === active)?.name || '' : ''; }, clear() { active = ''; note = ''; render(); } };
  }

  /** Write a value into an input or a select, adding the option when the select does not have it. */
  function setField(field, value) {
    if (!field) return;
    const text = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
    if (field.tagName === 'SELECT' && text && ![...field.options].some(o => o.value === text)) field.add(new Option(text, text));
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---- Editing the lists ---- */
  let listsModal = null, listsOpener = null;
  function openLists() {
    const t = words();
    if (!listsModal) {
      listsModal = el('div', 'modal-overlay');
      listsModal.id = 'journalListsModal';
      listsModal.addEventListener('click', e => { if (e.target === listsModal || e.target.closest('[data-lists-close]')) closeLists(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && listsModal.classList.contains('show')) { e.stopPropagation(); closeLists(); } }, true);
      document.body.append(listsModal);
    }
    const boxEl = el('div', 'modal-box large');
    boxEl.setAttribute('role', 'dialog'); boxEl.setAttribute('aria-modal', 'true'); boxEl.setAttribute('aria-labelledby', 'journalListsTitle');
    const close = el('button', 'modal-close', '✕'); close.type = 'button'; close.dataset.listsClose = ''; close.setAttribute('aria-label', t.cancel);
    const title = el('h3', 'modal-title', t.listsTitle); title.id = 'journalListsTitle';
    const area = (id, label, lines) => {
      const wrap = el('div', 'f-field');
      const caption = el('label', 'f-lbl', label); caption.htmlFor = id;
      const input = el('textarea', 'f-textarea lists-area'); input.id = id; input.rows = Math.max(6, lines.length + 1); input.value = lines.join('\n');
      wrap.append(caption, input);
      return wrap;
    };
    const save = el('button', 'btn btn-primary', t.save); save.type = 'button';
    save.addEventListener('click', () => {
      settings.listFromText('marks', boxEl.querySelector('#journalListMarks').value);
      settings.listFromText('checklist', boxEl.querySelector('#journalListChecks').value);
      closeLists();
    });
    const actions = el('div', 'form-actions'); actions.append(save);
    boxEl.append(close, title,
      area('journalListMarks', t.marksLabel, settings.marks().map(m => m.label)),
      area('journalListChecks', t.checkLabel, settings.checklist().map(m => m.label)),
      el('p', 'extras-hint', t.listsNote), actions);
    listsModal.replaceChildren(boxEl);
    listsOpener = document.activeElement;
    listsModal.classList.add('show');
    boxEl.querySelector('textarea').focus();
  }
  function closeLists() {
    listsModal?.classList.remove('show');
    if (listsOpener instanceof HTMLElement && document.contains(listsOpener)) listsOpener.focus();
  }

  window.TradeExtras = { createExtras, createPlaybookBar, setField, openLists };

  /* ---- The new-trade form ---- */
  const host = document.getElementById('tradeExtras'), barHost = document.getElementById('playbookBar');
  if (!host || !barHost) return;
  const $ = id => document.getElementById(id);
  const FORM = { strategy: 'fStrategy', setup: 'fSetup', timeframe: 'fTimeframe', session: 'fSession', entryReason: 'fEntryReason', tags: 'fTags', plannedRiskPct: 'fPlannedRisk', plannedRR: 'fPlannedRR' };
  const extras = createExtras();
  host.append(extras.element);
  const bar = createPlaybookBar({
    read: () => Object.fromEntries(Object.entries(FORM).map(([key, id]) => [key, $(id)?.value || ''])),
    apply: values => {
      for (const [key, id] of Object.entries(FORM)) if (values[key] != null && values[key] !== '' && !(Array.isArray(values[key]) && !values[key].length)) setField($(id), values[key]);
      const advanced = document.querySelector('#add details.advanced-trade');
      if (advanced) advanced.open = true;
    }
  });
  barHost.append(bar.element);
  window.TradeExtras.form = { read: () => ({ ...extras.read(), playbook: bar.active }), reset: () => { extras.reset(); bar.clear(); } };
  document.addEventListener('journal:trade-added', () => window.TradeExtras.form.reset());
})();
