/** Supabase authentication and explicit migration of legacy browser trades. */
(() => {
  const SUPABASE_URL = 'https://fzaawuwfpewqfkwmobpj.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JfBsIoGWedzt0OiQKiOA5w_IsqDi53f';
  if (!window.supabase) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  window.TradingCloud = {
    client,
    async session() { const { data, error } = await client.auth.getSession(); if (error) throw error; return data.session; },
    async signIn(email) {
      return client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    }
  };

  const email = document.getElementById('cloudEmail');
  const login = document.getElementById('cloudLogin');
  const sync = document.getElementById('cloudSync');
  const logout = document.getElementById('cloudLogout');
  const state = document.getElementById('cloudState');
  if (!state) return;
  async function refresh() {
    try {
      const s = await window.TradingCloud.session();
      state.textContent = s ? ('Supabase подключён: ' + s.user.email) : 'Войди по email. Сделки и фото сохраняются напрямую в Supabase.';
      if (logout) logout.hidden = !s;
      if (sync) sync.disabled = !s;
    } catch (e) { state.textContent = 'Supabase недоступен: ' + e.message; }
  }
  login?.addEventListener('click', async () => {
    if (!email.reportValidity() || !email.value.trim()) return;
    login.disabled = true;
    state.textContent = 'Отправляю ссылку для входа…';
    try {
      const { error } = await window.TradingCloud.signIn(email.value.trim());
      if (error) throw error;
      state.textContent = 'Письмо отправлено. Открой ссылку входа в этом браузере.';
    } catch (e) { state.textContent = 'Ошибка входа: ' + e.message; }
    finally { login.disabled = false; }
  });
  logout?.addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) state.textContent = 'Ошибка выхода: ' + error.message;
  });
  sync?.addEventListener('click', async () => {
    sync.disabled = true;
    state.textContent = 'Переношу старые записи из этого браузера…';
    try {
      const raw = localStorage.getItem('tk_journal_trades_v2');
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) throw new Error('Неверный формат старых записей');
      const existing = new Set((await window.TradingCloud.pullTrades({ includeScreenshots: false })).map(t => String(t.external_id)));
      const pending = list.filter(t => !existing.has(String(t.id)));
      const n = await window.TradingCloud.pushTrades(pending);
      // Keep the legacy backup untouched; repeated migration skips existing IDs.
      if (typeof loadTrades === 'function') await loadTrades();
      state.textContent = 'Перенесено в Supabase: ' + n + '. Уже существующие сделки не изменены.';
    } catch (e) { state.textContent = 'Перенос не завершён: ' + e.message; }
    finally { sync.disabled = !(await window.TradingCloud.session()); }
  });
  // Supabase auth callbacks must stay synchronous; defer API work outside them.
  let previousUser;
  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user.id || null;
    if (user === previousUser) return;
    previousUser = user;
    setTimeout(() => {
      refresh();
      document.dispatchEvent(new Event('journal:cloud-session'));
    }, 0);
  });
  refresh();
})();
