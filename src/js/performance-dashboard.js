/* Closed-trade performance. No external services, account mutations or synthetic prices. */
(function (root) {
  'use strict';
  const num = v => v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  function outcome(t) {
    if (t.status !== 'closed') return null;
    if (num(t.realizedPnl) !== null) return Number(t.realizedPnl);
    if (/mt[45]|metatrader|ctrader|ftmo|the5ers|funded|itrade/i.test(t.broker || '') || !/USD[TC]$/i.test(t.ticker || '')) return null;
    if ([t.entry,t.exit,t.volume].some(v=>num(v)===null) || Number(t.volume)<=0 || !['Long','Short'].includes(t.side)) return null;
    return (t.side==='Short'?Number(t.entry)-Number(t.exit):Number(t.exit)-Number(t.entry))*Number(t.volume)-(num(t.fees)||0);
  }
  function day(t) {
    if (t.closedAt) {
      const date=new Date(t.closedAt);
      if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') && Number.isFinite(Date.parse(t.date)) ? t.date : null;
  }
  function group(t) {return JSON.stringify([t.broker || '',t.accountLabel || '',t.currency || (num(t.realizedPnl)!==null?'':(/USD[TC]$/i.exec(t.ticker || '')||[''])[0].toUpperCase())]);}
  function summarize(rows, days=0, now=new Date()) {
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const cutoff=new Date(today+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-Math.max(0,days-1));
    const start=days?cutoff.toISOString().slice(0,10):'';
    let unknown=0,missingDate=0,open=0,estimated=0;
    const daily=new Map();let wins=0,losses=0,count=0,gain=0,loss=0;
    for(const t of rows){
      if(t.status==='open'){open++;continue;}
      const date=day(t);if(!date){missingDate++;continue;}
      if(date>today || (start && date<start))continue;
      const value=outcome(t);if(value===null){unknown++;continue;}
      count++;if(num(t.realizedPnl)===null)estimated++;
      if(value>0){wins++;gain+=value;}if(value<0){losses++;loss-=value;}
      daily.set(date,(daily.get(date)||0)+value);
    }
    let cumulative=0,peak=0,drawdown=0;
    const points=[...daily].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,pnl])=>{cumulative+=pnl;peak=Math.max(peak,cumulative);const dd=cumulative-peak;drawdown=Math.max(drawdown,-dd);return {date,pnl,cumulative,dd};});
    return {points,total:cumulative,count,wins,losses,winRate:count?wins/count:null,pf:loss?gain/loss:null,drawdown,expectancy:count?cumulative/count:null,unknown,missingDate,open,estimated};
  }
  const text={
    ru:['Результаты торговли','Закрытые сделки · время Праги','Счёт','Без названия','Валюта счёта','Вся история','7 дней','30 дней','90 дней','Накопленный PNL','Просадка','Чистый PNL','Доля прибыльных','Profit Factor','Макс. просадка','Средняя сделка','Сделок в расчёте','Нет закрытых сделок с результатом за этот период','Добавить сделку','По закрытым сделкам на конец дня; без открытых позиций, пополнений и вывода.','Без результата','Без даты','Открытых (всего)','Оценочный PNL','Дата','PNL за день','Значение','Показать данные','Скрыть данные','Период','Режим графика','Выберите день','Нет убытков / нет данных'],
    uk:['Результати торгівлі','Закриті угоди · час Праги','Рахунок','Без назви','Валюта рахунку','Вся історія','7 днів','30 днів','90 днів','Накопичений PNL','Просадка','Чистий PNL','Частка прибуткових','Profit Factor','Макс. просадка','Середня угода','Угод у розрахунку','Немає закритих угод із результатом за цей період','Додати угоду','За закритими угодами на кінець дня; без відкритих позицій, поповнень і виведення.','Без результату','Без дати','Відкритих (усього)','Оцінний PNL','Дата','PNL за день','Значення','Показати дані','Сховати дані','Період','Режим графіка','Виберіть день','Немає збитків / немає даних'],
    en:['Trading performance','Closed trades · Prague time','Account','Unnamed','Account currency','All time','7 days','30 days','90 days','Cumulative PNL','Drawdown','Net PNL','Win rate','Profit Factor','Max. drawdown','Average trade','Trades included','No closed trades with a known result in this period','Add a trade','End-of-day closed-trade results; excludes open positions, deposits and withdrawals.','Unknown PNL','Missing date','Open (all time)','Estimated PNL','Date','Daily PNL','Value','Show data','Hide data','Period','Chart mode','Select a day','No losses / no data'],
    cs:['Výsledky obchodování','Uzavřené obchody · pražský čas','Účet','Bez názvu','Měna účtu','Celá historie','7 dní','30 dní','90 dní','Kumulativní PNL','Propad','Čistý PNL','Úspěšnost','Profit Factor','Max. propad','Průměrný obchod','Zahrnuté obchody','Za toto období nejsou uzavřené obchody se známým výsledkem','Přidat obchod','Výsledky uzavřených obchodů na konci dne; bez otevřených pozic, vkladů a výběrů.','Neznámý PNL','Chybějící datum','Otevřené (celkem)','Odhadovaný PNL','Datum','Denní PNL','Hodnota','Zobrazit data','Skrýt data','Období','Režim grafu','Vybrat den','Žádné ztráty / žádná data']
  };
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let period=0,mode='cumulative',account=null,lastRows=[],lastLang='ru';
  function render(rows,lang) {
    const host=root.document.getElementById('performanceDashboard');if(!host)return;
    lastRows=rows;lastLang=lang;const t=text[lang]||text.en;
    const format=n=>n===null?'—':new Intl.NumberFormat(({ru:'ru-RU',uk:'uk-UA',cs:'cs-CZ',en:'en-US'})[lang]||'en-US',{maximumFractionDigits:2}).format(n);
    const groups=[...new Set(rows.map(group))];if(!groups.includes(account))account=groups[0]||null;
    const metrics=summarize(rows.filter(t=>group(t)===account),period);
    const selected=account?JSON.parse(account):['','', ''];
    const currency=selected[2]||t[4];
    const cards=[[t[11],format(metrics.total),metrics.total<0?'negative':'positive'],[t[12],metrics.winRate===null?'—':format(metrics.winRate*100)+'%',''],[t[13],format(metrics.pf),''],[t[14],format(metrics.drawdown),''],[t[15],format(metrics.expectancy),''],[t[16],metrics.count,'']];
    host.innerHTML=`<div class="pd-header"><div><span class="pd-eyebrow">PERFORMANCE</span><h2>${t[0]}</h2><p>${t[1]}</p></div><label class="pd-account">${t[2]}<select id="pdAccount">${groups.map((key,i)=>{const g=JSON.parse(key);return `<option value="${i}" ${key===account?'selected':''}>${escape([g[0],g[1]||t[3],g[2]||t[4]].filter(Boolean).join(' · '))}</option>`;}).join('')}</select></label></div><div class="pd-kpis">${cards.map(([label,value,cls])=>`<div class="pd-kpi"><span>${label}</span><strong class="${cls}" ${label===t[13]?'title="'+t[32]+'"':''}>${value}</strong></div>`).join('')}</div><div class="pd-panel"><div class="pd-toolbar"><div class="pd-segments" role="group" aria-label="${t[30]}">${['cumulative','dd'].map((key,i)=>`<button type="button" data-mode="${key}" aria-pressed="${mode===key}">${t[9+i]}</button>`).join('')}</div><div class="pd-segments" role="group" aria-label="${t[29]}">${[0,7,30,90].map((days,i)=>`<button type="button" data-days="${days}" aria-pressed="${period===days}">${t[5+i]}</button>`).join('')}</div></div><div class="pd-unit">${escape(currency)}</div><div id="pdPlot" class="pd-plot"></div><div id="pdReadout" class="pd-readout" aria-live="polite"></div><input id="pdPoint" class="pd-point" type="range" min="0" max="${Math.max(0,metrics.points.length-1)}" value="${Math.max(0,metrics.points.length-1)}" aria-label="${t[31]}" ${metrics.points.length?'':'hidden'}><p class="pd-note">${t[19]}</p><div class="pd-quality">${[ [20,metrics.unknown],[21,metrics.missingDate],[22,metrics.open],[23,metrics.estimated]].map(([key,value])=>`<span>${t[key]}: <b>${value}</b></span>`).join('')}</div><details class="pd-data"><summary>${t[27]}</summary><div class="pd-table"><table><thead><tr><th>${t[24]}</th><th>${t[25]}</th><th>${t[9]}</th><th>${t[10]}</th></tr></thead><tbody>${metrics.points.map(p=>`<tr><td>${p.date}</td><td>${format(p.pnl)}</td><td>${format(p.cumulative)}</td><td>${format(p.dd)}</td></tr>`).join('')}</tbody></table></div></details></div>`;
    host.querySelector('#pdAccount').addEventListener('change',e=>{account=groups[Number(e.target.value)];render(lastRows,lastLang)});
    host.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{period=Number(b.dataset.days);render(lastRows,lastLang)}));
    host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render(lastRows,lastLang)}));
    const plot=host.querySelector('#pdPlot'),points=metrics.points;
    if(!points.length){plot.innerHTML=`<div class="pd-empty"><p>${t[17]}</p><a href="#add">${t[18]} →</a></div>`;return;}
    const width=1000,height=300,left=85,right=20,top=18,bottom=35;
    const values=points.map(p=>p[mode]);let min=0,max=0;for(const v of values){min=Math.min(min,v);max=Math.max(max,v);}const pad=(max-min||1)*.12;min-=pad;max+=pad;
    const timestamps=points.map(p=>Date.parse(p.date+'T12:00:00Z'));
    const first=timestamps[0],span=timestamps.at(-1)-first;
    const x=i=>span?left+(timestamps[i]-first)/span*(width-left-right):(left+width-right)/2;
    const y=v=>top+(max-v)/(max-min)*(height-top-bottom);
    const coords=points.map((p,i)=>`${x(i)},${y(p[mode])}`).join(' ');
    const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
    plot.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${mode==='dd'?t[10]:t[9]}"><title>${mode==='dd'?t[10]:t[9]}</title><defs><linearGradient id="pdFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".18"/><stop offset="100%" stop-color="currentColor" stop-opacity=".01"/></linearGradient></defs>${ticks.map(v=>`<line class="pd-grid" x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end">${format(v)}</text>`).join('')}<line class="pd-zero" x1="${left}" x2="${width-right}" y1="${y(0)}" y2="${y(0)}"/><g class="${mode==='dd'||metrics.total<0?'negative':'positive'}"><polygon fill="url(#pdFill)" points="${x(0)},${y(0)} ${coords} ${x(points.length-1)},${y(0)}"/><polyline class="pd-line" points="${coords}"/><circle id="pdDot" r="5" cx="${x(points.length-1)}" cy="${y(values.at(-1))}" fill="currentColor"/></g><line id="pdCross" class="pd-cross" x1="${x(points.length-1)}" x2="${x(points.length-1)}" y1="${top}" y2="${height-bottom}"/><text x="${left}" y="${height-6}">${points[0].date}</text>${points.length>1?`<text x="${width-right}" y="${height-6}" text-anchor="end">${points.at(-1).date}</text>`:''}</svg>`;
    const show=i=>{const p=points[i];host.querySelector('#pdReadout').textContent=`${p.date}  ·  ${t[25]}: ${format(p.pnl)}  ·  ${mode==='dd'?t[10]:t[9]}: ${format(p[mode])}`;const cross=host.querySelector('#pdCross'),dot=host.querySelector('#pdDot');cross.setAttribute('x1',x(i));cross.setAttribute('x2',x(i));dot.setAttribute('cx',x(i));dot.setAttribute('cy',y(p[mode]));host.querySelector('#pdPoint').value=i;};
    host.querySelector('#pdPoint').addEventListener('input',e=>show(Number(e.target.value)));
    plot.addEventListener('pointermove',e=>{const box=plot.querySelector("svg").getBoundingClientRect(),px=(e.clientX-box.left)/box.width*width;let nearest=0;points.forEach((_,i)=>{if(Math.abs(x(i)-px)<Math.abs(x(nearest)-px))nearest=i;});show(nearest);});show(points.length-1);
  }
  root.PerformanceDashboard={render,summarize,outcome,group};
  if(typeof module!=='undefined')module.exports={summarize,outcome,group};
})(typeof window!=='undefined'?window:globalThis);
