/** Server-backed trade reviews; provider credentials never enter the browser. */
(() => {
  const $=id=>document.getElementById(id);
  let busy=false, activeReport=null, epoch=0, offset=0;
  const pending=new Map(), labels={trade:'Разбор сделки',history:'Анализ всей истории',weekly:'Недельный отчёт'};
  const num=n=>n==null?'—':Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
  function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  async function invoke(body){
    if(!window.TradingCloud||!await window.TradingCloud.session())throw new Error('Войди в журнал по email.');
    const {data,error}=await window.TradingCloud.client.functions.invoke('journal-review',{body});
    if(error){let message;try{message=(await error.context.json()).error;}catch{}throw new Error(message||'Сервер анализа недоступен. Проверь подключение и повтори.');}
    if(!data||data.error)throw new Error(data?.error||'Пустой ответ сервера.');return data;
  }
  function list(box,title,items){if(!items?.length)return;box.append(el('h4',title));const ul=el('ul');items.forEach(t=>ul.append(el('li',t)));box.append(ul);}
  function show(report){
    activeReport=report;$('aiModal').classList.add('show');$('reviewDownload').hidden=false;
    const m=report.metadata||{},n=m.narrative,c=m.coverage,box=$('aiContent');box.replaceChildren();$('aiModalTitle').textContent=labels[m.scope]||'Сохранённый разбор';
    box.append(el('p','Сохранён в Supabase · '+new Date(report.created_at).toLocaleString('ru-RU')+' · '+(report.model||report.provider),'review-note'));
    if(m.period)box.append(el('p',m.period.start+' — '+m.period.end+' · '+m.period.timezone,'review-coverage'));
    if(c)box.append(el('p',`Расчёты: ${c.tradesComputed} сделок. ИИ прочитал: ${c.tradeDetailsReviewed} записей (до ${c.detailTextLimit} символов на текстовое поле), фото: ${c.photosReviewed}/${c.photosAvailable}, документов: ${c.knowledgeReviewed}${c.knowledgeHasMore?' (есть ещё)':''}. Недоступных фото: ${c.photosUnavailable}.`,'review-coverage'));
    for(const a of m.metrics?.accounts||[]){
      const card=el('section',null,'review-account');card.append(el('h4',a.broker+' · '+a.account),el('p',a.currency+' · Валюту импортированного PNL сверь с брокером.','review-note'));
      const grid=el('div',null,'review-metrics');
      for(const [label,value] of [['Сделок',a.trades],['PNL известных результатов',num(a.netPnl)],['Win rate',a.winRate==null?'—':num(a.winRate*100)+'%'],['Profit factor',num(a.profitFactor)],['Средний результат',num(a.expectancy)],['Просадка закрытых сделок',num(a.closedPnlDrawdown)]]){const cell=el('div');cell.append(el('span',label),el('strong',String(value)));grid.append(cell);}
      card.append(grid,el('p',`Открытых: ${a.open} · Неизвестный PNL: ${a.unknownPnl} · Оценок PNL: ${a.estimatedPnl} · Комиссии не указаны: ${a.feesUnknown}. Просадка не включает открытые позиции и не подтверждает соблюдение лимитов FTMO.`,'review-note'));box.append(card);
    }
    if(n){box.append(el('h4','Главный вывод'),el('p',n.summary,'review-summary'));list(box,'Что получается',n.strengths);
      for(const f of n.findings||[]){const article=el('article',null,'review-finding');article.append(el('h4',f.title),el('p',f.detail));
        for(const id of f.trade_ids||[]){const button=el('button','Сделка '+id,'review-evidence');button.type='button';button.addEventListener('click',()=>{const t=typeof trades==='undefined'?null:trades.find(t=>String(t.id)===id);article.append(el('pre',t?JSON.stringify({ticker:t.ticker,date:t.date,side:t.side,entry:t.entry,exit:t.exit,notes:t.notes},null,2):'Сделка отсутствует в текущем журнале.','review-source'));button.disabled=true;});article.append(button);}box.append(article);
      }list(box,'План действий',n.actions);list(box,'Ограничения анализа',n.limitations);
    }else box.append(el('pre',report.review||'','review-source'));
  }
  async function run(scope,id){
    if(busy)return;if(scope==='trade'&&!id){$('reviewState').textContent='Сначала выбери сделку.';return;}
    busy=true;const token=epoch,key=scope+':'+(id||'')+':'+$('reviewPhotos').checked;
    if(!pending.has(key))pending.set(key,crypto.randomUUID());
    document.querySelectorAll('#reviewCenter button,[data-ai]').forEach(b=>b.disabled=true);
    activeReport=null;$('reviewDownload').hidden=true;$('aiModalTitle').textContent=labels[scope];$('aiModal').classList.add('show');$('aiContent').replaceChildren(el('p','Загружаю сделки и фото, считаю показатели и готовлю разбор…','ai-loading'));
    try{const data=await invoke({scope,tradeId:id,requestId:pending.get(key),includePhotos:$('reviewPhotos').checked,language:typeof currentLang==='undefined'?'ru':currentLang});if(token!==epoch)return;pending.delete(key);show(data.report);await archive();}
    catch(e){if(token===epoch){$('aiContent').replaceChildren(el('p',e.message,'review-error'));$('reviewState').textContent='Разбор не завершён. Можно повторить той же кнопкой.';}}
    finally{busy=false;document.querySelectorAll('#reviewCenter button,[data-ai]').forEach(b=>b.disabled=false);}
  }
  async function archive(more=false){
    const token=epoch;if(!more){offset=0;$('reviewArchive').replaceChildren();$('reviewMore').hidden=true;}
    try{if(!window.TradingCloud||!await window.TradingCloud.session())throw new Error('Войди в журнал по email.');
      const {data,error}=await window.TradingCloud.client.from('ai_reviews').select('id,trade_id,provider,model,review,metadata,created_at').order('created_at',{ascending:false}).range(offset,offset+19);
      if(error)throw error;if(token!==epoch)return;
      for(const report of data||[]){const card=el('button',null,'review-archive-card');card.type='button';card.append(el('strong',labels[report.metadata?.scope]||'Разбор сделки'),el('span',new Date(report.created_at).toLocaleString('ru-RU')),el('small',(report.metadata?.narrative?.summary||report.review||'').slice(0,140)));card.addEventListener('click',()=>show(report));$('reviewArchive').append(card);}
      offset+=(data||[]).length;$('reviewMore').hidden=(data||[]).length<20;$('reviewState').textContent=offset?'Сохранённые отчёты доступны на любом устройстве после входа.':'Сохранённых разборов пока нет.';
    }catch(e){if(token===epoch)$('reviewState').textContent=e.message;}
  }
  function options(){const select=$('reviewTrade'),value=select.value;select.replaceChildren(new Option('Выбери сделку',''));if(typeof trades!=='undefined')for(const t of [...trades].reverse())select.add(new Option(`${t.date||'—'} · ${t.ticker} · ${t.side}`,t.id));select.value=value;}
  async function connection(){const token=epoch;$('reviewConnection').textContent='Проверяю сервер…';try{const r=await invoke({action:'status'});if(token===epoch)$('reviewConnection').textContent=r.configured?'Ключ настроен · '+r.model+'. Доступ к модели проверится при создании отчёта.':'Нужен OPENAI_API_KEY в Secrets Supabase.';}catch(e){if(token===epoch)$('reviewConnection').textContent=e.message;}}
  window.analyzeTrade=id=>run('trade',String(id));
  $('reviewSingle').addEventListener('click',()=>run('trade',$('reviewTrade').value));$('reviewHistory').addEventListener('click',()=>run('history'));$('reviewWeekly').addEventListener('click',()=>run('weekly'));
  $('reviewRefresh').addEventListener('click',()=>archive());$('reviewMore').addEventListener('click',()=>archive(true));
  $('apiSettingsBtn').addEventListener('click',()=>{$('apiSettingsModal').classList.add('show');connection();});$('reviewCheck').addEventListener('click',connection);
  $('reviewDownload').addEventListener('click',()=>{if(!activeReport)return;const url=URL.createObjectURL(new Blob([JSON.stringify(activeReport,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='trade-review-'+activeReport.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.addEventListener('journal:trades-updated',options);
  document.addEventListener('journal:cloud-session',()=>{epoch++;pending.clear();activeReport=null;$('aiContent').replaceChildren();$('aiModal').classList.remove('show');archive();});
  archive();
})();
