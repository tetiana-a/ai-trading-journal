/**
 * insights-panel.js — Two screens built from the journal: where the results come from
 * (breakdowns in R, the cost of mistakes, checklist discipline) and the one-page weekly review.
 * Reads the trade list; the only thing it stores is the rule chosen for the coming week.
 */
(() => {
  'use strict';
  const insights = window.TradeInsights, settings = window.JournalSettings;
  const body = document.getElementById('insightsBody'), weekBody = document.getElementById('weekReviewBody');
  if (!insights || !settings || (!body && !weekBody)) return;

  const WORDS = {
    ru: {
      title: 'Разрезы и ошибки', weekTitle: 'Недельный разбор',
      period: 'Период', all: 'Всё время', d90: '90 дней', d30: '30 дней', d7: '7 дней',
      totalR: 'Итог в R', avgR: 'Средний R на сделку', withR: 'Сделок с R', winRate: 'Win rate', planRate: 'По плану',
      avgMae: 'Средний MAE', avgMfe: 'Средний MFE', capture: 'Взято от хода', todo: 'Незаполненные',
      of: 'из', rated: 'оценено',
      rHelp: 'R считается, когда у сделки есть стоп на входе: результат делится на начальный риск. MAE и MFE приходят из MT5 Reporter 1.20.',
      cuts: 'Где мой плюс', cutsHelp: 'Закрытые сделки, сгруппированные по одному признаку. Время входа — по Праге.',
      weekday: 'День недели', hour: 'Час входа', session: 'Сессия', setup: 'Сетап', ticker: 'Инструмент', emotion: 'Эмоция', strategy: 'Стратегия',
      trades: 'Сделок', sumR: 'Итог R', meanR: 'Средний R', pnl: 'PNL', none: 'не указано', empty: 'Пока нет закрытых сделок за этот период.',
      cost: 'Цена ошибок', costHelp: 'Сделка с двумя ошибками учитывается в обеих строках, поэтому строки не складываются в общий итог.',
      mark: 'Отметка', unrated: 'Не оценено', noMarks: 'Отметьте исполнение в сделках — здесь появится, сколько стоит каждая ошибка.',
      checks: 'Чек-лист перед входом', full: 'Все пункты выполнены', partial: 'Есть пропуски', noCheck: 'Чек-лист не заполнен',
      skipped: 'Что пропускается', item: 'Пункт', noChecks: 'Чек-лист ещё не отмечался.',
      week: 'Неделя', prev: 'Предыдущая неделя', next: 'Следующая неделя', thisWeek: 'Эта неделя',
      ruleNow: 'Правило этой недели', ruleNext: 'Одно правило на следующую неделю', rulePlaceholder: 'Например: не открываю сделку, пока не отмечены все пункты чек-листа',
      bestSetup: 'Лучший сетап', worstSetup: 'Худший сетап', topMistake: 'Главная ошибка', bestDay: 'Лучший день', worstDay: 'Худший день',
      day: 'День', copy: 'Скопировать разбор', copied: 'Скопировано', ai: 'Недельный ИИ-отчёт', aiNote: 'ИИ-отчёт берёт последние 7 дней.',
      weekEmpty: 'За эту неделю сделок нет.', saved: 'Правило сохранено', dash: '—', timesShort: 'сд.'
    },
    uk: {
      title: 'Розрізи та помилки', weekTitle: 'Тижневий розбір',
      period: 'Період', all: 'Увесь час', d90: '90 днів', d30: '30 днів', d7: '7 днів',
      totalR: 'Підсумок у R', avgR: 'Середній R на угоду', withR: 'Угод із R', winRate: 'Win rate', planRate: 'За планом',
      avgMae: 'Середній MAE', avgMfe: 'Середній MFE', capture: 'Взято від руху', todo: 'Незаповнені',
      of: 'із', rated: 'оцінено',
      rHelp: 'R рахується, коли в угоди є стоп на вході: результат ділиться на початковий ризик. MAE і MFE надходять із MT5 Reporter 1.20.',
      cuts: 'Де мій плюс', cutsHelp: 'Закриті угоди, згруповані за однією ознакою. Час входу — за Прагою.',
      weekday: 'День тижня', hour: 'Година входу', session: 'Сесія', setup: 'Сетап', ticker: 'Інструмент', emotion: 'Емоція', strategy: 'Стратегія',
      trades: 'Угод', sumR: 'Підсумок R', meanR: 'Середній R', pnl: 'PNL', none: 'не вказано', empty: 'Поки немає закритих угод за цей період.',
      cost: 'Ціна помилок', costHelp: 'Угода з двома помилками враховується в обох рядках, тому рядки не складаються в загальний підсумок.',
      mark: 'Позначка', unrated: 'Не оцінено', noMarks: 'Позначте виконання в угодах — тут з\'явиться, скільки коштує кожна помилка.',
      checks: 'Чек-лист перед входом', full: 'Усі пункти виконано', partial: 'Є пропуски', noCheck: 'Чек-лист не заповнено',
      skipped: 'Що пропускається', item: 'Пункт', noChecks: 'Чек-лист ще не відмічався.',
      week: 'Тиждень', prev: 'Попередній тиждень', next: 'Наступний тиждень', thisWeek: 'Цей тиждень',
      ruleNow: 'Правило цього тижня', ruleNext: 'Одне правило на наступний тиждень', rulePlaceholder: 'Наприклад: не відкриваю угоду, поки не відмічено всі пункти чек-листа',
      bestSetup: 'Найкращий сетап', worstSetup: 'Найгірший сетап', topMistake: 'Головна помилка', bestDay: 'Найкращий день', worstDay: 'Найгірший день',
      day: 'День', copy: 'Скопіювати розбір', copied: 'Скопійовано', ai: 'Тижневий ШІ-звіт', aiNote: 'ШІ-звіт бере останні 7 днів.',
      weekEmpty: 'За цей тиждень угод немає.', saved: 'Правило збережено', dash: '—', timesShort: 'уг.'
    },
    en: {
      title: 'Breakdowns and mistakes', weekTitle: 'Weekly review',
      period: 'Period', all: 'All time', d90: '90 days', d30: '30 days', d7: '7 days',
      totalR: 'Total R', avgR: 'Average R per trade', withR: 'Trades with R', winRate: 'Win rate', planRate: 'By the plan',
      avgMae: 'Average MAE', avgMfe: 'Average MFE', capture: 'Captured of the move', todo: 'Unfinished',
      of: 'of', rated: 'rated',
      rHelp: 'R needs a stop at entry: the result is divided by the initial risk. MAE and MFE come from MT5 Reporter 1.20.',
      cuts: 'Where the edge is', cutsHelp: 'Closed trades grouped by one property. Entry time is Prague time.',
      weekday: 'Weekday', hour: 'Entry hour', session: 'Session', setup: 'Setup', ticker: 'Instrument', emotion: 'Emotion', strategy: 'Strategy',
      trades: 'Trades', sumR: 'Total R', meanR: 'Average R', pnl: 'PNL', none: 'not set', empty: 'No closed trades in this period yet.',
      cost: 'The cost of mistakes', costHelp: 'A trade with two mistakes counts in both rows, so the rows do not add up to the total.',
      mark: 'Mark', unrated: 'Not rated', noMarks: 'Rate the execution of your trades and the cost of each mistake will appear here.',
      checks: 'Pre-entry checklist', full: 'Every item ticked', partial: 'Something skipped', noCheck: 'Checklist not filled in',
      skipped: 'What gets skipped', item: 'Item', noChecks: 'The checklist has not been used yet.',
      week: 'Week', prev: 'Previous week', next: 'Next week', thisWeek: 'This week',
      ruleNow: 'This week\'s rule', ruleNext: 'One rule for next week', rulePlaceholder: 'For example: no entry until every checklist item is ticked',
      bestSetup: 'Best setup', worstSetup: 'Worst setup', topMistake: 'Main mistake', bestDay: 'Best day', worstDay: 'Worst day',
      day: 'Day', copy: 'Copy the review', copied: 'Copied', ai: 'Weekly AI report', aiNote: 'The AI report covers the last 7 days.',
      weekEmpty: 'No trades this week.', saved: 'Rule saved', dash: '—', timesShort: 'tr.'
    },
    cs: {
      title: 'Rozbory a chyby', weekTitle: 'Týdenní rozbor',
      period: 'Období', all: 'Celé období', d90: '90 dní', d30: '30 dní', d7: '7 dní',
      totalR: 'Celkem v R', avgR: 'Průměrné R na obchod', withR: 'Obchodů s R', winRate: 'Win rate', planRate: 'Podle plánu',
      avgMae: 'Průměrné MAE', avgMfe: 'Průměrné MFE', capture: 'Zachyceno z pohybu', todo: 'Nevyplněné',
      of: 'z', rated: 'hodnoceno',
      rHelp: 'R se počítá, když má obchod stop při vstupu: výsledek se dělí počátečním rizikem. MAE a MFE dodává MT5 Reporter 1.20.',
      cuts: 'Kde je moje výhoda', cutsHelp: 'Uzavřené obchody seskupené podle jedné vlastnosti. Čas vstupu je pražský.',
      weekday: 'Den v týdnu', hour: 'Hodina vstupu', session: 'Seance', setup: 'Setup', ticker: 'Instrument', emotion: 'Emoce', strategy: 'Strategie',
      trades: 'Obchodů', sumR: 'Celkem R', meanR: 'Průměrné R', pnl: 'PNL', none: 'neuvedeno', empty: 'V tomto období zatím nejsou uzavřené obchody.',
      cost: 'Cena chyb', costHelp: 'Obchod se dvěma chybami se počítá v obou řádcích, řádky proto nedávají celkový součet.',
      mark: 'Značka', unrated: 'Nehodnoceno', noMarks: 'Ohodnoťte provedení obchodů a zde se ukáže, kolik stojí každá chyba.',
      checks: 'Checklist před vstupem', full: 'Vše splněno', partial: 'Něco vynecháno', noCheck: 'Checklist nevyplněn',
      skipped: 'Co se vynechává', item: 'Položka', noChecks: 'Checklist zatím nebyl použit.',
      week: 'Týden', prev: 'Předchozí týden', next: 'Další týden', thisWeek: 'Tento týden',
      ruleNow: 'Pravidlo tohoto týdne', ruleNext: 'Jedno pravidlo na příští týden', rulePlaceholder: 'Například: nevstupuji, dokud nejsou odškrtnuty všechny položky checklistu',
      bestSetup: 'Nejlepší setup', worstSetup: 'Nejhorší setup', topMistake: 'Hlavní chyba', bestDay: 'Nejlepší den', worstDay: 'Nejhorší den',
      day: 'Den', copy: 'Zkopírovat rozbor', copied: 'Zkopírováno', ai: 'Týdenní AI report', aiNote: 'AI report bere posledních 7 dní.',
      weekEmpty: 'V tomto týdnu nejsou žádné obchody.', saved: 'Pravidlo uloženo', dash: '—', timesShort: 'obch.'
    }
  };
  const lang = () => (typeof currentLang === 'string' ? currentLang : 'ru');
  const words = () => WORDS[lang()] || WORDS.en;
  const locale = () => ({ ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' }[lang()] || 'en-GB');
  const journal = () => (typeof trades !== 'undefined' && Array.isArray(trades) ? trades : []);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

  /* ---- Formatting ---- */
  const minus = text => text.replace('-', '−');
  const fmtR = v => v === null || v === undefined ? words().dash : minus((v > 0 ? '+' : '') + v.toFixed(2)) + 'R';
  const fmtPctWhole = v => v === null || v === undefined ? words().dash : Math.round(v * 100) + '%';
  const fmtCash = (v, count = 1) => !count ? words().dash : minus((v > 0 ? '+' : '') + v.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const tone = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const dayName = (date, style = 'long') => new Intl.DateTimeFormat(locale(), { weekday: style, timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  const shortDate = date => new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  // 2024-01-01 was a Monday: the name of weekday N is the name of that week's Nth day.
  const weekdayName = n => { const name = dayName(insights.shiftDay('2024-01-01', n - 1)); return name.charAt(0).toUpperCase() + name.slice(1); };
  const hourName = h => String(h).padStart(2, '0') + ':00–' + String((h + 1) % 24).padStart(2, '0') + ':00';

  function keyName(key, dimension) {
    if (key === '') return words().none;
    if (dimension === 'weekday') return weekdayName(key);
    if (dimension === 'hour') return hourName(key);
    return String(key);
  }
  const markName = key => key === 'unrated' ? words().unrated : settings.markLabel(key);

  /** A bar from a zero line in the middle: right for a gain, left for a loss. */
  function bar(value, max, label) {
    const box = el('div', 'r-bar');
    if (value === null || !max) return box;
    const fill = el('i', value >= 0 ? 'pos' : 'neg');
    fill.style.width = Math.min(50, Math.abs(value) / max * 50) + '%';
    box.append(fill);
    box.title = label;
    return box;
  }

  /** A table of result rows: name, trades, win rate, total with a bar, average R, PNL. */
  function resultTable(heading, rows, nameOf) {
    const t = words();
    // The bar shows R; when no row has R yet, it shows money instead of an empty column.
    const useR = rows.some(r => r.rCount), metric = r => useR ? (r.rCount ? r.totalR : null) : (r.pnlCount ? r.pnl : null);
    const max = Math.max(0, ...rows.map(r => Math.abs(metric(r) || 0)));
    const wrap = el('div', 'tbl-wrap'), table = el('table', 'tk-table insight-table');
    const head = el('tr');
    for (const text of [heading, t.trades, t.winRate, t.sumR, '', t.meanR, t.pnl]) head.append(el('th', '', text));
    const thead = el('thead'); thead.append(head);
    const tbody = el('tbody');
    for (const r of rows) {
      const tr = el('tr');
      const total = el('td', 'pnl ' + tone(r.rCount ? r.totalR : 0), r.rCount ? fmtR(r.totalR) : t.dash);
      const visual = el('td', 'insight-bar-cell');
      visual.append(bar(metric(r), max, useR ? fmtR(r.totalR) : fmtCash(r.pnl, r.pnlCount)));
      tr.append(el('td', 'name', nameOf(r.key)), el('td', '', String(r.trades)), el('td', '', fmtPctWhole(r.winRate)), total, visual,
        el('td', tone(r.avgR || 0), fmtR(r.avgR)), el('td', 'pnl ' + tone(r.pnlCount ? r.pnl : 0), fmtCash(r.pnl, r.pnlCount)));
      tbody.append(tr);
    }
    table.append(thead, tbody);
    wrap.append(table);
    return wrap;
  }

  /* ---- Breakdowns and mistakes ---- */
  let days = 0, dimension = 'weekday';
  try { const saved = JSON.parse(localStorage.getItem('tk_insights_view') || '{}'); if ([0, 7, 30, 90].includes(saved.days)) days = saved.days; if (insights.DIMENSIONS.includes(saved.dimension)) dimension = saved.dimension; } catch (_) {}
  const remember = () => { try { localStorage.setItem('tk_insights_view', JSON.stringify({ days, dimension })); } catch (_) {} };

  function kpi(label, value, className, note) {
    const cell = el('div', 'kpi-cell');
    cell.append(el('div', 'kpi-lbl', label), el('div', 'kpi-val ' + (className || ''), value));
    if (note) cell.append(el('div', 'kpi-note', note));
    return cell;
  }

  function renderInsights() {
    if (!body) return;
    const t = words(), list = insights.recent(journal(), days), s = insights.summary(list);
    const title = document.getElementById('insightsTitle'); if (title) title.textContent = t.title;

    const period = document.getElementById('insightsPeriod');
    if (period) {
      const select = el('select', 'f-select insight-period');
      select.setAttribute('aria-label', t.period);
      for (const [value, label] of [[0, t.all], [90, t.d90], [30, t.d30], [7, t.d7]]) select.add(new Option(label, String(value)));
      select.value = String(days);
      select.addEventListener('change', () => { days = Number(select.value); remember(); renderInsights(); });
      period.replaceChildren(select);
    }

    const grid = el('div', 'kpi-grid insight-kpis');
    grid.append(
      kpi(t.totalR, s.rCount ? fmtR(s.totalR) : t.dash, tone(s.rCount ? s.totalR : 0)),
      kpi(t.avgR, fmtR(s.avgR), tone(s.avgR || 0)),
      kpi(t.withR, s.rCount + ' ' + t.of + ' ' + s.trades, ''),
      kpi(t.planRate, fmtPctWhole(s.planRate), '', s.rated + ' ' + t.of + ' ' + s.trades + ' ' + t.rated),
      kpi(t.avgMae, fmtR(s.avgMae), ''),
      kpi(t.avgMfe, fmtR(s.avgMfe), ''),
      kpi(t.capture, fmtPctWhole(s.capture), ''),
      kpi(t.todo, String(insights.incomplete(journal()).length), '')
    );
    const parts = [grid, el('p', 'insight-help', t.rHelp)];

    if (!s.trades) parts.push(el('p', 'empty-state insight-empty', t.empty));
    else {
      const tabs = el('div', 'insight-tabs');
      tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', t.cuts);
      for (const key of insights.DIMENSIONS) {
        const button = el('button', 'extras-chip', t[key]);
        button.type = 'button'; button.dataset.dimension = key; button.setAttribute('aria-pressed', String(key === dimension));
        tabs.append(button);
      }
      tabs.addEventListener('click', e => { const key = e.target.closest('[data-dimension]')?.dataset.dimension; if (key) { dimension = key; remember(); renderInsights(); } });
      parts.push(el('h3', 'sub-title', t.cuts), el('p', 'insight-help', t.cutsHelp), tabs,
        resultTable(t[dimension], insights.breakdown(list, dimension), key => keyName(key, dimension)));

      const cost = insights.markCost(list);
      parts.push(el('h3', 'sub-title', t.cost));
      if (cost.some(r => r.key !== 'unrated')) parts.push(el('p', 'insight-help', t.costHelp), resultTable(t.mark, cost, markName));
      else parts.push(el('p', 'insight-help', t.noMarks));

      const checks = insights.checklistStats(list);
      parts.push(el('h3', 'sub-title', t.checks));
      if (checks.full.trades + checks.partial.trades) {
        const names = { full: t.full, partial: t.partial, none: t.noCheck };
        parts.push(resultTable(t.checks, [checks.full, checks.partial, checks.none].filter(r => r.trades), key => names[key]));
        if (checks.items.length) parts.push(el('p', 'insight-help', t.skipped), resultTable(t.item, checks.items, key => settings.checkLabel(key)));
      } else parts.push(el('p', 'insight-help', t.noChecks));
    }
    body.replaceChildren(...parts);
  }

  /* ---- Weekly review ---- */
  const today = () => insights.entryMoment({ openedAt: new Date().toISOString() }).date;
  let monday = insights.weekStart(today());
  let ruleTimer = 0, flash = '';

  function fact(label, value, detail) {
    const row = el('div', 'week-fact');
    row.append(el('span', 'week-fact-label', label), el('strong', '', value));
    if (detail) row.append(el('span', 'week-fact-detail', detail));
    return row;
  }
  const rowDetail = r => r ? [r.rCount ? fmtR(r.totalR) : null, r.pnlCount ? fmtCash(r.pnl) : null, r.trades + ' ' + words().timesShort].filter(Boolean).join(' · ') : '';

  /** The review as plain text: for a note, a message to a mentor, or the AI chat. */
  function weekText(review) {
    const t = words(), s = review.summary, lines = [];
    lines.push(t.weekTitle + ' ' + shortDate(review.from) + ' – ' + shortDate(review.to));
    lines.push(t.trades + ': ' + s.trades + ' · ' + t.winRate + ': ' + fmtPctWhole(s.winRate) + ' · ' + t.totalR + ': ' + (s.rCount ? fmtR(s.totalR) : t.dash) + ' · ' + t.pnl + ': ' + fmtCash(s.pnl, s.pnlCount));
    lines.push(t.planRate + ': ' + fmtPctWhole(s.planRate) + ' (' + s.rated + ' ' + t.of + ' ' + s.trades + ' ' + t.rated + ')');
    if (review.bestSetup) lines.push(t.bestSetup + ': ' + review.bestSetup.key + ' (' + rowDetail(review.bestSetup) + ')');
    if (review.worstSetup) lines.push(t.worstSetup + ': ' + review.worstSetup.key + ' (' + rowDetail(review.worstSetup) + ')');
    if (review.topMistake) lines.push(t.topMistake + ': ' + markName(review.topMistake.key) + ' (' + rowDetail(review.topMistake) + ')');
    if (review.bestDay) lines.push(t.bestDay + ': ' + dayName(review.bestDay.date) + ' (' + rowDetail(review.bestDay) + ')');
    if (review.worstDay) lines.push(t.worstDay + ': ' + dayName(review.worstDay.date) + ' (' + rowDetail(review.worstDay) + ')');
    const now = settings.weekRule(review.from), next = settings.weekRule(insights.shiftDay(review.from, 7));
    if (now) lines.push(t.ruleNow + ': ' + now);
    if (next) lines.push(t.ruleNext + ': ' + next);
    return lines.join('\n');
  }

  function renderWeek() {
    if (!weekBody) return;
    const t = words(), review = insights.weekReview(journal(), monday), s = review.summary;
    const title = document.getElementById('weekReviewTitle'); if (title) title.textContent = t.weekTitle;
    const nextMonday = insights.shiftDay(review.from, 7), current = insights.weekStart(today());

    const nav = el('div', 'week-nav');
    const step = (label, symbol, by) => { const b = el('button', 'cal-nav-btn', symbol); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', () => { monday = insights.shiftDay(monday, by); flash = ''; renderWeek(); }); return b; };
    const label = el('div', 'week-label', shortDate(review.from) + ' – ' + shortDate(review.to) + '.' + review.to.slice(0, 4));
    nav.append(step(t.prev, '‹', -7), label, step(t.next, '›', 7));
    if (review.from !== current) { const back = el('button', 'playbook-link', t.thisWeek); back.type = 'button'; back.addEventListener('click', () => { monday = current; flash = ''; renderWeek(); }); nav.append(back); }
    const parts = [nav];

    const rule = settings.weekRule(review.from);
    if (rule) { const box = el('div', 'week-rule'); box.append(el('span', 'f-lbl', t.ruleNow), el('p', '', rule)); parts.push(box); }

    if (!s.trades && !s.open) parts.push(el('p', 'empty-state insight-empty', t.weekEmpty));
    else {
      const grid = el('div', 'kpi-grid insight-kpis week-kpis');
      grid.append(
        kpi(t.trades, String(s.trades), ''),
        kpi(t.winRate, fmtPctWhole(s.winRate), ''),
        kpi(t.totalR, s.rCount ? fmtR(s.totalR) : t.dash, tone(s.rCount ? s.totalR : 0), s.rCount + ' ' + t.of + ' ' + s.trades),
        kpi(t.pnl, fmtCash(s.pnl, s.pnlCount), tone(s.pnlCount ? s.pnl : 0)),
        kpi(t.planRate, fmtPctWhole(s.planRate), '', s.rated + ' ' + t.of + ' ' + s.trades + ' ' + t.rated),
        kpi(t.todo, String(review.incomplete), '')
      );
      const factsBox = el('div', 'week-facts');
      factsBox.append(
        fact(t.bestSetup, review.bestSetup ? String(review.bestSetup.key) : t.dash, rowDetail(review.bestSetup)),
        fact(t.worstSetup, review.worstSetup ? String(review.worstSetup.key) : t.dash, rowDetail(review.worstSetup)),
        fact(t.topMistake, review.topMistake ? markName(review.topMistake.key) : t.dash, rowDetail(review.topMistake)),
        fact(t.bestDay, review.bestDay ? dayName(review.bestDay.date) : t.dash, rowDetail(review.bestDay)),
        fact(t.worstDay, review.worstDay ? dayName(review.worstDay.date) : t.dash, rowDetail(review.worstDay))
      );
      parts.push(grid, factsBox, resultTable(t.day, review.days.filter(d => d.trades), date => dayName(date) + ', ' + shortDate(date)));
    }

    const ruleBox = el('div', 'f-field week-rule-edit');
    const caption = el('label', 'f-lbl', t.ruleNext + ' · ' + shortDate(nextMonday) + ' – ' + shortDate(insights.shiftDay(nextMonday, 6)));
    const input = el('textarea', 'f-textarea'); input.id = 'weekRuleInput'; input.rows = 2; input.maxLength = 400; input.placeholder = t.rulePlaceholder;
    input.value = settings.weekRule(nextMonday);
    caption.htmlFor = input.id;
    const status = el('span', 'playbook-note', flash); status.setAttribute('role', 'status');
    const saveRule = () => { clearTimeout(ruleTimer); if (input.value.trim() !== settings.weekRule(nextMonday)) { flash = t.saved; settings.setWeekRule(nextMonday, input.value); } };
    input.addEventListener('input', () => { clearTimeout(ruleTimer); ruleTimer = setTimeout(saveRule, 1200); });
    input.addEventListener('blur', saveRule);
    ruleBox.append(caption, input, status);

    const actions = el('div', 'form-actions week-actions');
    const copy = el('button', 'btn btn-ghost', t.copy); copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(weekText(insights.weekReview(journal(), monday))); copy.textContent = t.copied; setTimeout(() => { copy.textContent = words().copy; }, 1600); }
      catch (_) {
        // No clipboard permission: show the text selected, ready for Ctrl+C.
        const area = el('textarea', 'f-textarea week-copy'); area.readOnly = true; area.rows = 8; area.value = weekText(insights.weekReview(journal(), monday));
        actions.after(area); area.focus(); area.select();
      }
    });
    actions.append(copy);
    const aiButton = document.getElementById('reviewWeekly');
    if (aiButton) {
      const ai = el('button', 'btn btn-primary', t.ai); ai.type = 'button'; ai.title = t.aiNote;
      ai.addEventListener('click', () => aiButton.click());
      actions.append(ai, el('span', 'insight-help', t.aiNote));
    }
    parts.push(ruleBox, actions);

    // Typing a rule must not be interrupted by a re-render of the same week.
    const typing = document.activeElement?.id === 'weekRuleInput';
    if (typing && weekBody.dataset.week === review.from) { const live = weekBody.querySelector('.week-rule-edit .playbook-note'); if (live) live.textContent = flash; return; }
    weekBody.dataset.week = review.from;
    weekBody.replaceChildren(...parts);
  }

  const renderBoth = () => { renderInsights(); renderWeek(); };
  document.addEventListener('journal:trades-updated', renderBoth);
  document.addEventListener('journal:settings', renderBoth);
  document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(renderBoth, 0));

  window.InsightsPanel = { render: renderBoth, weekText: () => weekText(insights.weekReview(journal(), monday)), setWeek(day) { monday = insights.weekStart(day); renderWeek(); } };
  renderBoth();
})();
