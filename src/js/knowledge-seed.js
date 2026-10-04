/**
 * knowledge-seed.js — Imports the repository's original study notes into Supabase.
 * Safe to run repeatedly because source_key is unique per user.
 */
(() => {
  const btn = document.getElementById('kbSeed');
  const state = document.getElementById('kbState');
  if (!btn) return;

  const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const T = (ru,en) => isEn ? en : ru;

  const sources = [
    ['learning/README.md','Trading Learning Hub','curriculum'],
    ['learning/01-market-foundations.md','Market Foundations','foundations'],
    ['learning/02-technical-analysis.md','Technical Analysis','technical'],
    ['learning/03-risk-management.md','Risk Management','risk'],
    ['learning/04-fundamental-analysis.md','Fundamental Analysis','fundamentals'],
    ['learning/05-smart-money.md','Smart Money Concepts','smart-money'],
    ['learning/06-trading-workflow.md','Trading Workflow','workflow'],
    ['learning/07-reading-notes.md','Reading Notes & References','reading']
  ];

  btn.addEventListener('click', async () => {
    try {
      if (!window.TradingCloud?.saveKnowledge) throw new Error(T('Сначала войди в Supabase','Sign in to Supabase first'));
      if (state) state.textContent = T('Импортирую учебную базу…','Importing study knowledge…');
      let done = 0;
      for (const [path,title,category] of sources) {
        const response = await fetch(path, { cache:'no-store' });
        if (!response.ok) continue;
        const content = await response.text();
        await window.TradingCloud.saveKnowledge({
          title,
          category,
          content,
          source:'github-learning',
          sourceKey:path,
          metadata:{ path, importedFrom:'ai-trading-journal' }
        });
        done++;
      }
      if (state) state.textContent = T('Учебная база синхронизирована: ','Study knowledge synced: ') + done;
      document.getElementById('kbRefresh')?.click();
    } catch (e) {
      if (state) state.textContent = T('Ошибка: ','Error: ') + (e?.message || e);
    }
  });
})();