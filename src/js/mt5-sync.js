/**
 * mt5-sync.js — One-click sync with MT5 Reporter.
 * The reporter writes CSV files into the terminal's MQL5/Files folder. After the trader grants read
 * access to that folder once, the journal reads the files itself: open positions appear as open trades,
 * closed ones are completed, and the account figures feed the prop limits.
 * Read-only: the journal never writes to the folder and nothing is sent to MT5.
 */
(() => {
  'use strict';
  const panel = document.getElementById('mt5Sync');
  const importer = window.BrokerCSVImporter;
  if (!panel) return;

  const WORDS = {
    ru: {
      connect: 'Подключить папку MT5', resume: 'Возобновить доступ', now: 'Синхронизировать', off: 'Отключить', help: 'Как установить советник',
      unsupported: 'Синхронизация папки работает в Chrome и Edge на компьютере. Здесь используйте «Импорт Broker CSV».',
      idle: 'Не подключено. Выберите папку MQL5 → Files вашего терминала, и сделки будут подтягиваться сами.',
      needAccess: 'Браузер просит подтвердить доступ к папке. Нажмите «Возобновить доступ».',
      empty: 'В папке нет файлов MT5 Reporter. Проверьте, что выбрана MQL5 → Files и советник запущен.',
      signIn: 'Счёт прочитан. Войдите по email, чтобы сохранять сделки.',
      loading: 'Журнал ещё загружается…', failed: 'Не удалось прочитать папку: ', saveFailed: 'Сделки не сохранены: ',
      synced: 'синхронизировано', shots: 'скриншотов', added: 'новых', updated: 'обновлено', open: 'открыто', stale: 'советник не обновлял файлы',
      balance: 'Баланс', equity: 'Эквити', today: 'Закрыто сегодня', risk: 'Риск до стопов', noStop: 'БЕЗ СТОПА',
      dailyRoom: 'До дневного лимита', maxRoom: 'До общего лимита', trades: 'Сделок сегодня', todo: 'Дополнить:'
    },
    uk: {
      connect: 'Підключити папку MT5', resume: 'Відновити доступ', now: 'Синхронізувати', off: 'Відключити', help: 'Як встановити радник',
      unsupported: 'Синхронізація папки працює в Chrome та Edge на комп\'ютері. Тут користуйтеся «Імпорт Broker CSV».',
      idle: 'Не підключено. Виберіть папку MQL5 → Files вашого термінала, і угоди підтягуватимуться самі.',
      needAccess: 'Браузер просить підтвердити доступ до папки. Натисніть «Відновити доступ».',
      empty: 'У папці немає файлів MT5 Reporter. Перевірте, що вибрано MQL5 → Files і радник запущено.',
      signIn: 'Рахунок прочитано. Увійдіть по email, щоб зберігати угоди.',
      loading: 'Журнал ще завантажується…', failed: 'Не вдалося прочитати папку: ', saveFailed: 'Угоди не збережено: ',
      synced: 'синхронізовано', shots: 'скриншотів', added: 'нових', updated: 'оновлено', open: 'відкрито', stale: 'радник не оновлював файли',
      balance: 'Баланс', equity: 'Еквіті', today: 'Закрито сьогодні', risk: 'Ризик до стопів', noStop: 'БЕЗ СТОПА',
      dailyRoom: 'До денного ліміту', maxRoom: 'До загального ліміту', trades: 'Угод сьогодні', todo: 'Доповнити:'
    },
    en: {
      connect: 'Connect MT5 folder', resume: 'Resume access', now: 'Sync now', off: 'Disconnect', help: 'How to install the reporter',
      unsupported: 'Folder sync works in Chrome and Edge on a computer. Here, use "Import Broker CSV".',
      idle: 'Not connected. Choose your terminal\'s MQL5 → Files folder and trades will arrive on their own.',
      needAccess: 'The browser needs you to confirm access to the folder. Press "Resume access".',
      empty: 'No MT5 Reporter files in this folder. Check that MQL5 → Files is selected and the reporter is running.',
      signIn: 'Account read. Sign in by email to save trades.',
      loading: 'The journal is still loading…', failed: 'Could not read the folder: ', saveFailed: 'Trades were not saved: ',
      synced: 'synced', shots: 'screenshots', added: 'new', updated: 'updated', open: 'open', stale: 'the reporter has not updated the files',
      balance: 'Balance', equity: 'Equity', today: 'Closed today', risk: 'Risk to stops', noStop: 'WITHOUT STOP',
      dailyRoom: 'Daily limit room', maxRoom: 'Max loss room', trades: 'Trades today', todo: 'Add notes:'
    },
    cs: {
      connect: 'Připojit složku MT5', resume: 'Obnovit přístup', now: 'Synchronizovat', off: 'Odpojit', help: 'Jak nainstalovat reportér',
      unsupported: 'Synchronizace složky funguje v Chrome a Edge na počítači. Zde použijte „Import Broker CSV“.',
      idle: 'Nepřipojeno. Vyberte složku MQL5 → Files svého terminálu a obchody se budou načítat samy.',
      needAccess: 'Prohlížeč potřebuje potvrdit přístup ke složce. Stiskněte „Obnovit přístup“.',
      empty: 'Ve složce nejsou soubory MT5 Reporter. Zkontrolujte, že je vybrána MQL5 → Files a reportér běží.',
      signIn: 'Účet načten. Přihlaste se e-mailem, aby se obchody ukládaly.',
      loading: 'Deník se ještě načítá…', failed: 'Složku se nepodařilo přečíst: ', saveFailed: 'Obchody nebyly uloženy: ',
      synced: 'synchronizováno', shots: 'snímků', added: 'nových', updated: 'aktualizováno', open: 'otevřeno', stale: 'reportér soubory neaktualizoval',
      balance: 'Zůstatek', equity: 'Equity', today: 'Uzavřeno dnes', risk: 'Riziko ke stopům', noStop: 'BEZ STOPU',
      dailyRoom: 'Do denního limitu', maxRoom: 'Do celkového limitu', trades: 'Obchodů dnes', todo: 'Doplnit:'
    }
  };
  const lang = () => (typeof currentLang === 'string' ? currentLang : (document.documentElement.lang || 'ru').slice(0, 2));
  const words = () => WORDS[lang()] || WORDS.en;
  const money = v => Number(v).toLocaleString(lang() === 'en' ? 'en-US' : 'ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const FILE = /^MT5_(Journal|Account|Quotes)_\d+\.csv$/i;   // the reporter's temporary "tmp_" files never match
  // Chart pictures the reporter takes when a position opens and closes: MT5_Shot_<login>_<position>_open.png
  const SHOT = /^MT5_Shot_(\d+)_(\d+)_(open|close)\.png$/i;
  const INTERVAL = 15000, STALE_AFTER = 120000, MAX_SHOTS = 6;
  const supported = typeof window.showDirectoryPicker === 'function';

  const $ = id => document.getElementById(id);
  const state = $('mt5SyncState'), accountLine = $('mt5Account'), todo = $('mt5Todo');
  const buttons = { connect: $('mt5Connect'), resume: $('mt5Resume'), now: $('mt5Now'), off: $('mt5Disconnect') };
  let folder = null, timer = 0, busy = false, seen = {}, last = { kind: supported ? 'idle' : 'unsupported' };

  /* The folder handle lives in IndexedDB: it is the only browser storage that can hold one. */
  function store(mode, work) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('tk_mt5', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('handles');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction('handles', mode), result = work(tx.objectStore('handles'));
        tx.oncomplete = () => { request.result.close(); resolve(result.result); };
        tx.onerror = () => { request.result.close(); reject(tx.error); };
      };
    });
  }
  const remember = handle => store('readwrite', s => s.put(handle, 'files'));
  const recall = () => store('readonly', s => s.get('files'));
  const forget = () => store('readwrite', s => s.delete('files'));

  async function allowed(ask) {
    if (!folder) return false;
    if (typeof folder.queryPermission !== 'function') return true;
    if (await folder.queryPermission({ mode: 'read' }) === 'granted') return true;
    return ask ? await folder.requestPermission({ mode: 'read' }) === 'granted' : false;
  }

  async function readFolder() {
    const files = [];
    for await (const [name, entry] of folder.entries()) {
      if (entry.kind !== 'file') continue;
      const shot = SHOT.exec(name);
      if (!shot && !FILE.test(name)) continue;
      const file = await entry.getFile();
      if (shot) files.push({ name, file, shot: { login: shot[1], position: shot[2], kind: shot[3].toLowerCase() } });
      else files.push({ name, file, account: /^MT5_Account_/i.test(name), quotes: /^MT5_Quotes_/i.test(name) });
    }
    return files;
  }

  /** Turn the terminal's PNG into the same kind of compact JPEG the journal stores for pasted screenshots. */
  async function encodeShot(file) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / bitmap.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch (_) { return ''; }
  }

  /** Attach each new chart picture to its trade, once. Returns how many were attached. */
  async function attachShots(shots) {
    let attached = 0;
    for (const item of shots) {
      if (seen[item.name] === item.file.lastModified) continue;
      const suffix = ':' + item.shot.login + ':' + item.shot.position;
      const trade = trades.find(t => String(t.importRef || '').startsWith('mt5:') && String(t.importRef).endsWith(suffix));
      if (!trade) continue;   // the position has not reached the journal yet; look again on the next pass
      const done = () => { seen[item.name] = item.file.lastModified; };
      if ((trade.shots || []).includes(item.shot.kind) || (trade.screenshots || []).length >= MAX_SHOTS) { done(); continue; }
      const image = await api.encodeShot(item.file);
      if (!image) { done(); continue; }
      const updated = { ...trade, screenshots: [...(trade.screenshots || []), image], shots: [...(trade.shots || []), item.shot.kind] };
      if (await importer.saveQuietly([updated])) break;   // busy or offline: the file stays unread and is tried again
      Object.assign(trade, updated);
      done(); attached++;
    }
    return attached;
  }

  /** One pass: read what changed, apply it, and describe the outcome in `last`. */
  async function sync(force) {
    if (busy || !folder || !importer) return;
    busy = true;
    try {
      if (!await allowed(false)) { last = { kind: 'needAccess' }; return; }
      const everything = await readFolder();
      const files = everything.filter(f => !f.shot), shots = everything.filter(f => f.shot);
      if (!files.length) { last = { kind: 'empty' }; return; }

      // The newest account file describes the account that is trading now.
      const accounts = files.filter(f => f.account).sort((a, b) => b.file.lastModified - a.file.lastModified);
      let account = importer.savedAccount();
      if (accounts.length && (force || seen[accounts[0].name] !== accounts[0].file.lastModified)) {
        account = importer.parseAccount(await accounts[0].file.text());
        importer.rememberAccount(account);
        seen[accounts[0].name] = accounts[0].file.lastModified;
      }

      // Bid and ask for every symbol in the terminal's Market Watch: the asset list and the price hint use them.
      const quotes = files.filter(f => f.quotes).sort((a, b) => b.file.lastModified - a.file.lastModified)[0];
      if (quotes && typeof importer.parseQuotes === 'function' && (force || seen[quotes.name] !== quotes.file.lastModified)) {
        const symbols = importer.parseQuotes(await quotes.file.text());
        window.MT5Quotes = { symbols, at: quotes.file.lastModified };
        seen[quotes.name] = quotes.file.lastModified;
        try { localStorage.setItem('tk_mt5_symbols', JSON.stringify([...symbols.values()].map(q => ({ symbol: q.symbol, group: q.group, description: q.description })))); } catch (_) {}
        document.dispatchEvent(new Event('journal:mt5-quotes'));
      }

      const outcome = { kind: 'synced', added: 0, updated: 0, open: null, at: Date.now() };
      const journalPage = typeof trades !== 'undefined' && typeof saveTrades === 'function';
      if (journalPage) {
        const session = await window.TradingCloud?.session?.().catch(() => null);
        if (!session) { last = { kind: 'signIn' }; return; }
        if (typeof tradesLoaded === 'undefined' || !tradesLoaded) { last = { kind: 'loading' }; return; }
        let open = 0;
        for (const item of files.filter(f => !f.account && !f.quotes)) {
          const changed = force || seen[item.name] !== item.file.lastModified;
          if (!changed && last.kind === 'synced') { open += last.openBy?.[item.name] || 0; (outcome.openBy ||= {})[item.name] = last.openBy?.[item.name] || 0; continue; }
          const parsed = importer.parse(await item.file.text(), item.name);
          const done = await importer.applyBrokerTrades(parsed, { quiet: true });
          if (!done.ok) {
            // Leave the file marked as unread, so the next pass tries again.
            if (done.error === 'busy' || done.error === 'not-loaded') { last = { kind: 'loading' }; return; }
            last = { kind: 'saveFailed', detail: done.error || '' };
            return;
          }
          seen[item.name] = item.file.lastModified;
          outcome.added += done.added; outcome.updated += done.updated; open += done.open || 0;
          (outcome.openBy ||= {})[item.name] = done.open || 0;
        }
        outcome.open = open;
        if (shots.length) {
          outcome.shots = await attachShots(shots);
          if (outcome.shots && typeof renderAll === 'function') renderAll();
        }
      }
      outcome.staleFor = accounts.length ? Date.now() - accounts[0].file.lastModified : 0;
      last = outcome;
    } catch (error) {
      last = { kind: 'failed', detail: error?.message || String(error) };
    } finally {
      busy = false;
      render();
    }
  }

  function limits(account) {
    try {
      const saved = JSON.parse(localStorage.getItem('tk_prop_guard') || '{}');
      const guard = window.TradingPropGuard;
      if (!guard || !(saved.firmDailyLossPct > 0) || !(saved.maxLossPct > 0)) return null;
      return guard.metricsOf({
        size: account.initialBalance || Number(saved.accountSize || 0), balance: account.balance, equity: account.equity,
        dayStart: account.dayStartBalance || account.balance, dailyPct: Number(saved.firmDailyLossPct), maxPct: Number(saved.maxLossPct),
        targetPct: 0, personalPct: Number(saved.personalDailyStopPct || 0)
      });
    } catch (_) { return null; }
  }

  function renderAccount() {
    const account = importer?.savedAccount?.();
    if (!accountLine) return;
    accountLine.hidden = !account;
    if (!account) return;
    const t = words(), parts = [];
    const base = account.initialBalance || account.dayStartBalance || account.balance;
    const share = base ? account.dayClosedResult / base * 100 : 0;
    const pct = base ? ' (' + (share > 0 ? '+' : '') + money(share) + '%)' : '';
    const item = (label, value, tone) => { const span = document.createElement('span'); span.className = 'mt5-figure' + (tone ? ' ' + tone : ''); const b = document.createElement('b'); b.textContent = value; span.append(label + ' ', b); parts.push(span); };
    item(account.server + ' · ' + account.login + ' ·', account.currency);
    item(t.balance, money(account.balance));
    item(t.equity, money(account.equity));
    item(t.today, money(account.dayClosedResult) + pct, account.dayClosedResult < 0 ? 'neg' : account.dayClosedResult > 0 ? 'pos' : '');
    item(t.trades, String(account.dayTrades));
    if (account.openPositions > 0) item(t.risk, money(account.openRisk));
    if (account.openWithoutStop > 0) item(t.noStop + ':', String(account.openWithoutStop), 'neg');
    const m = limits(account);
    if (m) { item(t.dailyRoom, money(m.dailyRemaining), m.firmBreach ? 'neg' : ''); item(t.maxRoom, money(m.maxRemaining), m.firmBreach ? 'neg' : ''); }
    accountLine.replaceChildren(...parts);
  }

  // Trades that came from MT5 and still have no setup or reason written down.
  function renderTodo() {
    if (!todo) return;
    const list = (typeof trades !== 'undefined' ? trades : [])
      .filter(t => String(t.importRef || '').startsWith('mt5:') && (window.TradeInsights ? window.TradeInsights.isIncomplete(t) : !t.setup && !t.entryReason))
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || String(b.date).localeCompare(String(a.date)))
      .slice(0, 6);
    todo.hidden = !list.length || !window.TradeNotes;
    if (todo.hidden) return;
    const label = document.createElement('span'); label.textContent = words().todo;
    todo.replaceChildren(label, ...list.map(t => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'mt5-chip'; button.dataset.notes = t.id;
      button.textContent = t.ticker + ' ' + t.side + (t.status === 'open' ? ' · ' + words().open : ' · ' + (t.date || ''));
      return button;
    }));
  }

  function render() {
    const t = words();
    panel.hidden = false;
    for (const key of Object.keys(buttons)) if (buttons[key]) buttons[key].textContent = t[key];
    const help = $('mt5Help'); if (help) help.textContent = t.help;
    const connected = !!folder;
    if (buttons.connect) buttons.connect.hidden = !supported || connected;
    if (buttons.resume) buttons.resume.hidden = !(connected && last.kind === 'needAccess');
    if (buttons.now) buttons.now.hidden = !connected || last.kind === 'needAccess';
    if (buttons.off) buttons.off.hidden = !connected;
    let text;
    if (last.kind === 'synced') {
      text = t.synced + ' ' + new Date(last.at).toLocaleTimeString(lang() === 'en' ? 'en-GB' : 'ru-RU');
      if (last.open != null) text += ' · ' + t.open + ': ' + last.open;
      if (last.added) text += ' · ' + t.added + ': ' + last.added;
      if (last.updated) text += ' · ' + t.updated + ': ' + last.updated;
      if (last.shots) text += ' · ' + t.shots + ': ' + last.shots;
      if (last.staleFor > STALE_AFTER) text += ' · ' + t.stale + ' ' + Math.round(last.staleFor / 60000) + ' min';
    } else text = (t[last.kind] || t.idle) + (last.detail || '');
    if (state) { state.textContent = text; state.dataset.kind = last.kind === 'synced' ? (last.staleFor > STALE_AFTER ? 'warn' : 'live') : (last.kind === 'failed' || last.kind === 'saveFailed' ? 'error' : ''); }
    renderAccount();
    renderTodo();
  }

  function schedule() {
    clearInterval(timer);
    if (!folder) return;
    timer = setInterval(() => { if (!document.hidden) sync(false); }, INTERVAL);
  }

  /** Start using a folder handle. Exposed so the sync can be exercised without the system folder dialog. */
  async function use(handle) {
    folder = handle; seen = {};
    await remember(handle).catch(() => {});
    schedule();
    await sync(true);
  }

  async function connect() {
    try { await use(await window.showDirectoryPicker({ id: 'mt5-files', mode: 'read' })); }
    catch (error) { if (error?.name !== 'AbortError') { last = { kind: 'failed', detail: error?.message || String(error) }; render(); } }
  }

  async function disconnect() {
    folder = null; seen = {}; clearInterval(timer);
    await forget().catch(() => {});
    last = { kind: 'idle' };
    render();
  }

  buttons.connect?.addEventListener('click', connect);
  buttons.resume?.addEventListener('click', async () => { if (await allowed(true)) { schedule(); await sync(true); } else render(); });
  buttons.now?.addEventListener('click', () => sync(true));
  buttons.off?.addEventListener('click', disconnect);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(false); });
  document.addEventListener('journal:trades-updated', () => { renderTodo(); if (folder && last.kind === 'loading') sync(true); });
  document.addEventListener('journal:cloud-session', () => { if (folder) setTimeout(() => sync(true), 0); });
  document.addEventListener('journal:mt5-account', renderAccount);
  window.addEventListener('storage', e => { if (e.key === 'tk_mt5_account' || e.key === 'tk_prop_guard') renderAccount(); });
  document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(render, 0));
  window.addEventListener('pagehide', () => clearInterval(timer));

  const api = { use, sync, disconnect, encodeShot, get status() { return last; } };
  window.MT5Sync = api;

  render();
  if (supported || typeof indexedDB !== 'undefined') recall().then(async handle => {
    if (!handle) return;
    folder = handle;
    schedule();
    // After a browser restart the permission may need one click; until then just say so.
    if (await allowed(false)) await sync(true); else { last = { kind: 'needAccess' }; render(); }
  }).catch(() => {});
})();
