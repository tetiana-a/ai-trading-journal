/**
 * cloud-tools.js — Extends TradingCloud with screenshots, prop accounts, knowledge base,
 * alerts and AI-review persistence. Requires cloud-sync.js to load first.
 */
(() => {
  if (!window.TradingCloud?.client) return;
  const cloud = window.TradingCloud;
  const client = cloud.client;

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(',');
    const meta = parts[0] || '';
    const payload = parts[1] || '';
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function signedUrls(paths) {
    const result = [];
    for (const path of paths || []) {
      const { data, error } = await client.storage.from('trade-screenshots').createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) result.push(data.signedUrl);
    }
    return result;
  }

  cloud.uploadTradeScreenshots = async function uploadTradeScreenshots(trade, session) {
    if (!session || !trade?.screenshots?.length) return trade?.screenshotPaths || [];
    const paths = Array.isArray(trade.screenshotPaths) ? [...trade.screenshotPaths] : [];
    for (let i = 0; i < trade.screenshots.length; i++) {
      const src = trade.screenshots[i];
      if (!String(src).startsWith('data:image/')) continue;
      const path = session.user.id + '/' + trade.id + '/' + i + '.jpg';
      const blob = dataUrlToBlob(src);
      const { error } = await client.storage.from('trade-screenshots')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (!error && !paths.includes(path)) paths.push(path);
    }
    return paths;
  };

  cloud.pullTrades = async function pullTrades() {
    const { data, error } = await client.from('trades').select('*').order('trade_date', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) row.signed_screenshots = await signedUrls(row.screenshot_paths || []);
    return rows;
  };

  cloud.pushTrades = async function pushTrades(localTrades) {
    const session = await cloud.session();
    if (!session) throw new Error('Сначала войди в Supabase');
    const rows = [];
    for (const t of localTrades || []) {
      const screenshotPaths = await cloud.uploadTradeScreenshots(t, session);
      t.screenshotPaths = screenshotPaths;
      rows.push({
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
        screenshot_paths: screenshotPaths,
        broker: t.broker || null,
        account_label: t.accountLabel || null,
        strategy: t.strategy || null,
        setup: t.setup || null,
        timeframe: t.timeframe || null,
        session: t.session || null,
        stop_loss: t.stopLoss === '' || t.stopLoss == null ? null : Number(t.stopLoss),
        take_profit: t.takeProfit === '' || t.takeProfit == null ? null : Number(t.takeProfit),
        planned_risk_pct: t.plannedRiskPct === '' || t.plannedRiskPct == null ? null : Number(t.plannedRiskPct),
        planned_rr: t.plannedRR === '' || t.plannedRR == null ? null : Number(t.plannedRR),
        fees: t.fees === '' || t.fees == null ? null : Number(t.fees),
        realized_pnl: t.realizedPnl === '' || t.realizedPnl == null ? null : Number(t.realizedPnl),
        import_ref: t.importRef || null,
        opened_at: t.openedAt || null,
        closed_at: t.closedAt || null,
        tags: Array.isArray(t.tags) ? t.tags : [],
        source: t.source || 'github-pages-journal',
        updated_at: new Date().toISOString()
      });
    }
    if (!rows.length) return 0;
    const { error } = await client.from('trades').upsert(rows, { onConflict: 'user_id,external_id' });
    if (error) throw error;
    return rows.length;
  };

  cloud.deleteTrade = async function deleteTrade(externalId) {
    const session = await cloud.session();
    if (!session) return;
    const { error } = await client.from('trades')
      .delete().eq('user_id', session.user.id).eq('external_id', String(externalId));
    if (error) throw error;
  };

  cloud.savePropAccount = async function savePropAccount(payload) {
    const session = await cloud.session();
    if (!session) throw new Error('Сначала войди в Supabase');
    const row = {
      user_id: session.user.id,
      firm: payload.firm,
      program: payload.program || null,
      account_size: Number(payload.accountSize || 0),
      current_balance: Number(payload.currentBalance || payload.accountSize || 0),
      current_equity: Number(payload.currentEquity || payload.currentBalance || payload.accountSize || 0),
      max_daily_loss_pct: Number(payload.maxDailyLossPct || 0),
      max_loss_pct: Number(payload.maxLossPct || 0),
      profit_target_pct: Number(payload.profitTargetPct || 0),
      personal_daily_stop_pct: Number(payload.personalDailyStopPct || 1),
      status: payload.status || 'active',
      metadata: payload.metadata || {},
      updated_at: new Date().toISOString()
    };
    await client.from('prop_accounts').update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id).eq('status', 'active');
    const { data, error } = await client.from('prop_accounts').insert(row).select().single();
    if (error) throw error;
    return data;
  };

  cloud.getActivePropAccount = async function getActivePropAccount() {
    const { data, error } = await client.from('prop_accounts')
      .select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  };

  cloud.saveKnowledge = async function saveKnowledge(doc) {
    const session = await cloud.session();
    if (!session) throw new Error('Сначала войди в Supabase');
    const row = {
      user_id: session.user.id,
      title: doc.title,
      category: doc.category || 'notes',
      source: doc.source || 'manual',
      source_key: doc.sourceKey || null,
      content: doc.content,
      metadata: doc.metadata || {},
      updated_at: new Date().toISOString()
    };
    const query = doc.sourceKey
      ? client.from('knowledge_documents').upsert(row, { onConflict: 'user_id,source_key' }).select().single()
      : client.from('knowledge_documents').insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  cloud.searchKnowledge = async function searchKnowledge(query) {
    let q = client.from('knowledge_documents').select('*').order('updated_at', { ascending: false }).limit(50);
    const cleaned = String(query || '').trim().replace(/[,%()]/g, ' ');
    if (cleaned) q = q.or('title.ilike.%' + cleaned + '%,content.ilike.%' + cleaned + '%,category.ilike.%' + cleaned + '%');
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };

  cloud.saveAIReview = async function saveAIReview(payload) {
    const session = await cloud.session();
    if (!session) return null;
    let cloudTradeId = null;
    if (payload.tradeId) {
      const { data } = await client.from('trades').select('id')
        .eq('external_id', String(payload.tradeId)).limit(1).maybeSingle();
      cloudTradeId = data?.id || null;
    }
    const { data, error } = await client.from('ai_reviews').insert({
      user_id: session.user.id,
      trade_id: cloudTradeId,
      provider: payload.provider || 'local-rules',
      model: payload.model || null,
      review: payload.review,
      metadata: payload.metadata || {}
    }).select().single();
    if (error) throw error;
    return data;
  };

  cloud.createAlert = async function createAlert(payload) {
    const session = await cloud.session();
    if (!session) throw new Error('Сначала войди в Supabase');
    const { data, error } = await client.from('alerts').insert({
      user_id: session.user.id,
      symbol: String(payload.symbol || '').toUpperCase(),
      rule_type: payload.ruleType,
      rule: payload.rule || {},
      enabled: true
    }).select().single();
    if (error) throw error;
    return data;
  };

  cloud.listAlerts = async function listAlerts() {
    const { data, error } = await client.from('alerts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  cloud.saveBrokerConnection = async function saveBrokerConnection(payload) {
    const session = await cloud.session();
    if (!session) throw new Error('Sign in to Supabase first');
    const row = {
      user_id: session.user.id,
      provider: payload.provider,
      account_label: payload.accountLabel || null,
      connection_type: payload.connectionType || 'read_only',
      status: payload.status || 'configured',
      last_sync_at: payload.lastSyncAt || null,
      metadata: payload.metadata || {},
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from('broker_connections').insert(row).select().single();
    if (error) throw error;
    return data;
  };

  cloud.listBrokerConnections = async function listBrokerConnections() {
    const { data, error } = await client.from('broker_connections')
      .select('*').order('updated_at',{ascending:false});
    if (error) throw error;
    return data || [];
  };

  cloud.getStrategyMetrics = async function getStrategyMetrics() {
    const { data, error } = await client.from('trade_strategy_metrics')
      .select('*').order('trades',{ascending:false});
    if (error) throw error;
    return data || [];
  };

  cloud.connectCTrader = async function connectCTrader() {
    const session = await cloud.session();
    if (!session) throw new Error('Sign in to Supabase first');
    const { data, error } = await client.functions.invoke('ctrader-connect', { body: {} });
    if (error) throw error;
    if (!data?.url) throw new Error(data?.error || 'cTrader connection is not configured');
    location.href = data.url;
  };

  cloud.activateTelegram = async function activateTelegram() {
    const session = await cloud.session();
    if (!session) throw new Error('Sign in to Supabase first');
    const { data, error } = await client.functions.invoke('telegram-register', { body: {} });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Telegram activation failed');
    return data;
  };
})();