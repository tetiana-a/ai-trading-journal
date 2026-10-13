/**
 * journal-settings.js — The trader's own lists: mistakes, the pre-entry checklist, setup templates
 * and the one rule chosen for each week. Kept on this device and, after sign-in, in the cloud,
 * so the phone and the computer show the same lists.
 */
(function (root) {
  'use strict';
  const KEY = 'tk_journal_settings_v1';

  // Built-in entries keep a fixed id, so statistics survive a change of interface language.
  const MARK_WORDS = {
    plan:            { ru: 'По плану', uk: 'За планом', en: 'By the plan', cs: 'Podle plánu' },
    fomo:            { ru: 'FOMO', uk: 'FOMO', en: 'FOMO', cs: 'FOMO' },
    no_confirmation: { ru: 'Вход без подтверждения', uk: 'Вхід без підтвердження', en: 'Entry without confirmation', cs: 'Vstup bez potvrzení' },
    moved_stop:      { ru: 'Перенос стопа', uk: 'Перенесення стопа', en: 'Moved the stop', cs: 'Posun stopu' },
    revenge:         { ru: 'Месть рынку', uk: 'Помста ринку', en: 'Revenge trade', cs: 'Odvetný obchod' },
    early_exit:      { ru: 'Ранний выход', uk: 'Ранній вихід', en: 'Early exit', cs: 'Předčasný výstup' },
    oversize:        { ru: 'Завышенный объём', uk: 'Завищений обсяг', en: 'Oversized position', cs: 'Příliš velká pozice' },
    against_trend:   { ru: 'Против тренда', uk: 'Проти тренду', en: 'Against the trend', cs: 'Proti trendu' },
    no_stop:         { ru: 'Без стопа', uk: 'Без стопа', en: 'No stop', cs: 'Bez stopu' },
    news:            { ru: 'Торговля на новостях', uk: 'Торгівля на новинах', en: 'Traded the news', cs: 'Obchod při zprávách' },
    held_loser:      { ru: 'Пересиживание убытка', uk: 'Пересиджування збитку', en: 'Held a loser', cs: 'Držení ztráty' }
  };
  const CHECK_WORDS = {
    trend:   { ru: 'Старший таймфрейм в мою сторону', uk: 'Старший таймфрейм у мій бік', en: 'Higher timeframe agrees', cs: 'Vyšší timeframe souhlasí' },
    level:   { ru: 'Вход от уровня или зоны, не посередине', uk: 'Вхід від рівня або зони, не посередині', en: 'Entry at a level or zone, not mid-range', cs: 'Vstup od úrovně nebo zóny, ne uprostřed' },
    confirm: { ru: 'Есть подтверждение по моему сетапу', uk: 'Є підтвердження за моїм сетапом', en: 'My setup is confirmed', cs: 'Můj setup je potvrzen' },
    risk:    { ru: 'Стоп за структурой, риск не больше 0,5 %', uk: 'Стоп за структурою, ризик не більше 0,5 %', en: 'Stop behind structure, risk 0.5 % or less', cs: 'Stop za strukturou, riziko nejvýše 0,5 %' },
    target:  { ru: 'Цель не меньше 2R', uk: 'Ціль не менше 2R', en: 'Target at least 2R', cs: 'Cíl alespoň 2R' },
    news:    { ru: 'Нет важных новостей за 15 минут до и после входа', uk: 'Немає важливих новин за 15 хвилин до і після входу', en: 'No major news 15 minutes before or after entry', cs: 'Žádné důležité zprávy 15 minut před vstupem ani po něm' }
  };
  const DEFAULT_MARKS = Object.keys(MARK_WORDS).filter(id => id !== 'plan');
  const DEFAULT_CHECKS = Object.keys(CHECK_WORDS);
  const PLAYBOOK_WORDS = {
    ru: [['Пробой + ретест · London', 'Пробой уровня и ретест с подтверждением'], ['Sweep + CHOCH · New York', 'Снятие ликвидности, смена структуры, вход на ретесте'], ['Откат по тренду', 'Откат к зоне по тренду старшего таймфрейма']],
    uk: [['Пробій + ретест · London', 'Пробій рівня і ретест із підтвердженням'], ['Sweep + CHOCH · New York', 'Зняття ліквідності, зміна структури, вхід на ретесті'], ['Відкат за трендом', 'Відкат до зони за трендом старшого таймфрейму']],
    en: [['Breakout + retest · London', 'Level break and a confirmed retest'], ['Sweep + CHOCH · New York', 'Liquidity sweep, change of character, entry on the retest'], ['Trend pullback', 'Pullback into a zone with the higher-timeframe trend']],
    cs: [['Průraz + retest · London', 'Průraz úrovně a potvrzený retest'], ['Sweep + CHOCH · New York', 'Výběr likvidity, změna struktury, vstup na retestu'], ['Korekce v trendu', 'Korekce do zóny ve směru trendu vyššího timeframe']]
  };
  const PLAYBOOK_BASE = [
    { id: 'pb_breakout', strategy: 'Breakout', setup: 'Breakout + retest', timeframe: 'M15', session: 'London', tags: ['breakout'], plannedRR: '2' },
    { id: 'pb_sweep', strategy: 'Liquidity Sweep', setup: 'Sweep + CHOCH + retest', timeframe: 'M5', session: 'New York', tags: ['sweep'], plannedRR: '2' },
    { id: 'pb_pullback', strategy: 'Trend pullback', setup: 'Pullback to zone', timeframe: 'M15', session: '', tags: ['pullback'], plannedRR: '2' }
  ];
  const PLAYBOOK_FIELDS = ['strategy', 'setup', 'timeframe', 'session', 'entryReason', 'tags', 'plannedRiskPct', 'plannedRR'];

  const lang = () => (typeof currentLang === 'string' ? currentLang : (root.document?.documentElement.lang || 'ru')).slice(0, 2);
  const word = entry => entry[lang()] || entry.en;
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  let state = load();
  let pushTimer = 0;

  function load() {
    try { const saved = JSON.parse(root.localStorage?.getItem(KEY) || 'null'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; }
    catch (_) { return {}; }
  }
  function persist() { try { root.localStorage?.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function announce() { root.document?.dispatchEvent(new root.Event('journal:settings')); }

  const resolve = (list, dictionary, fallback) => (Array.isArray(list) ? list : fallback.map(id => ({ id })))
    .filter(item => item && item.id && (item.label || dictionary[item.id]))
    .map(item => ({ id: item.id, label: item.label ? clean(item.label) : word(dictionary[item.id]) }));

  /** Mistakes offered as buttons, in the trader's order. "By the plan" is separate and always present. */
  const marks = () => resolve(state.marks, MARK_WORDS, DEFAULT_MARKS).filter(m => m.id !== 'plan');
  const checklist = () => resolve(state.checklist, CHECK_WORDS, DEFAULT_CHECKS);
  /** A name for any stored id, including one the trader has since removed from the list. */
  function markLabel(id) {
    const custom = (state.marks || []).find(m => m.id === id && m.label);
    return custom ? clean(custom.label) : MARK_WORDS[id] ? word(MARK_WORDS[id]) : (state.retired?.[id] || id);
  }
  function checkLabel(id) {
    const custom = (state.checklist || []).find(m => m.id === id && m.label);
    return custom ? clean(custom.label) : CHECK_WORDS[id] ? word(CHECK_WORDS[id]) : (state.retired?.[id] || id);
  }

  function playbooks() {
    if (Array.isArray(state.playbooks)) return state.playbooks.filter(p => p && p.id && p.name);
    const names = PLAYBOOK_WORDS[lang()] || PLAYBOOK_WORDS.en;
    return PLAYBOOK_BASE.map((base, i) => ({ ...base, name: names[i][0], entryReason: names[i][1] }));
  }

  /**
   * Replace a list from text, one entry per line. A line that matches a built-in entry in any
   * language keeps its built-in id; an unchanged custom line keeps its id too.
   */
  function listFromText(kind, text) {
    const dictionary = kind === 'marks' ? MARK_WORDS : CHECK_WORDS;
    const current = kind === 'marks' ? marks() : checklist();
    const seen = new Set(), next = [];
    for (const raw of String(text || '').split('\n')) {
      const label = clean(raw).slice(0, 120);
      if (!label) continue;
      const builtIn = Object.keys(dictionary).find(id => id !== 'plan' && Object.values(dictionary[id]).some(v => v.toLowerCase() === label.toLowerCase()));
      const known = current.find(item => item.label.toLowerCase() === label.toLowerCase());
      const id = builtIn || known?.id || (kind === 'marks' ? 'm_' : 'c_') + hash(label.toLowerCase());
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(builtIn ? { id } : { id, label });
    }
    // Remember the names of removed custom entries: old trades still refer to them.
    const retired = { ...(state.retired || {}) };
    for (const item of current) if (!seen.has(item.id) && !dictionary[item.id]) retired[item.id] = item.label;
    update({ [kind]: next, retired });
    return next;
  }

  function savePlaybook(name, values) {
    const title = clean(name).slice(0, 60);
    if (!title) return null;
    const list = playbooks().slice();
    const entry = { id: 'pb_' + hash(title.toLowerCase()), name: title };
    for (const key of PLAYBOOK_FIELDS) {
      const value = values?.[key];
      if (key === 'tags') entry.tags = (Array.isArray(value) ? value : String(value || '').split(',')).map(clean).filter(Boolean).slice(0, 12);
      else if (clean(value)) entry[key] = clean(value).slice(0, 300);
    }
    const at = list.findIndex(p => p.id === entry.id);
    if (at >= 0) list[at] = entry; else list.push(entry);
    update({ playbooks: list });
    return entry;
  }
  function removePlaybook(id) { update({ playbooks: playbooks().filter(p => p.id !== id) }); }

  const weekRule = monday => clean(state.weekRules?.[monday] || '');
  function setWeekRule(monday, text) {
    const rules = { ...(state.weekRules || {}) };
    const value = String(text || '').trim().slice(0, 400);
    if (value) rules[monday] = value; else delete rules[monday];
    update({ weekRules: rules });
  }

  function update(patch) {
    state = { ...state, ...patch, version: 1, updatedAt: new Date().toISOString() };
    persist();
    announce();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 800);
  }

  /* ---- Cloud copy: the newer side wins as a whole ---- */
  async function push() {
    const cloud = root.TradingCloud;
    if (!cloud?.saveSettings) return false;
    try { if (!await cloud.session()) return false; await cloud.saveSettings(state); return true; }
    catch (_) { return false; }   // the local copy stays; the next change tries again
  }
  async function pull() {
    const cloud = root.TradingCloud;
    if (!cloud?.loadSettings) return;
    try {
      if (!await cloud.session()) return;
      const remote = await cloud.loadSettings();
      if (remote && typeof remote === 'object' && String(remote.updatedAt || '') > String(state.updatedAt || '')) {
        state = remote; persist(); announce();
      } else if (state.updatedAt && String(state.updatedAt) > String(remote?.updatedAt || '')) await push();
    } catch (_) {}
  }
  root.document?.addEventListener('journal:cloud-session', pull);
  root.addEventListener?.('storage', e => { if (e.key === KEY) { state = load(); announce(); } });

  root.JournalSettings = {
    marks, checklist, markLabel, checkLabel, playbooks, listFromText, savePlaybook, removePlaybook, weekRule, setWeekRule,
    pull, PLAYBOOK_FIELDS, get raw() { return state; }
  };
})(typeof window === 'undefined' ? globalThis : window);
