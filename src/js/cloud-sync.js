/** Optional Supabase cloud sync for personal trading data. */
(() => {
  const SUPABASE_URL = 'https://fzaawuwfpewqfkwmobpj.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JfBsIoGWedzt0OiQKiOA5w_IsqDi53f';
  if (!window.supabase) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  window.TradingCloud = {
    client,
    async session() { const { data } = await client.auth.getSession(); return data.session; },
    async signIn(email) {
      return client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    },
    async pullTrades() {
      const { data, error } = await client.from('trades').select('*').order('trade_date', { ascending: false });
      if (error) throw error; return data || [];
    },
    async pushTrades(localTrades) {
      const session = await this.session();
      if (!session) throw new Error('Сначала войди в Supabase');
      const rows = localTrades.map(t => ({
        user_id: session.user.id,
        external_id: String(t.id),
        ticker: t.ticker || null,
        side: t.side || null,
        status: t.status || null,
        trade_date: t.date || null,
        deposit: Number(t.deposit || 0),
        entry: Number(t.entry || 0),
        exit: t.exit === '' || t.exit == null ? null : Number(t.exit),
        volume: Number(t.volume || 0),
        emotion: t.emotion || null,
        entry_reason: t.entryReason || null,
        exit_reason: t.exitReason || null,
        notes: t.notes || null,
        source: 'github-pages-journal',
        updated_at: new Date().toISOString()
      }));
      const { error } = await client.from('trades').upsert(rows, { onConflict: 'user_id,external_id' });
      if (error) throw error; return rows.length;
    }
  };

  const email = document.getElementById('cloudEmail');
  const login = document.getElementById('cloudLogin');
  const sync = document.getElementById('cloudSync');
  const state = document.getElementById('cloudState');
  if (!state) return;
  async function refresh() {
    try {
      const s = await window.TradingCloud.session();
      state.textContent = s ? ('Cloud подключён: ' + s.user.email) : 'Cloud готов. Войди по email magic link.';
    } catch (e) { state.textContent = 'Supabase запускается / недоступен: ' + e.message; }
  }
  login?.addEventListener('click', async () => {
    if (!email.value.trim()) return;
    state.textContent = 'Отправляю magic link…';
    const { error } = await window.TradingCloud.signIn(email.value.trim());
    state.textContent = error ? ('Ошибка: ' + error.message) : 'Письмо отправлено. Открой ссылку входа.';
  });
  sync?.addEventListener('click', async () => {
    state.textContent = 'Синхронизация…';
    try {
      const raw = localStorage.getItem('tk_journal_trades_v2');
      const list = raw ? JSON.parse(raw) : [];
      const n = await window.TradingCloud.pushTrades(list);
      state.textContent = 'Синхронизировано сделок: ' + n;
    } catch (e) { state.textContent = 'Ошибка синхронизации: ' + e.message; }
  });
  refresh();
})();