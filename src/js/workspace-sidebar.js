/* Shared workspace navigation. Existing page controls and content stay in place. */
(() => {
 'use strict';
 const top=document.querySelector('body > nav'),bar=top?.querySelector('.nav-in');if(!bar)return;
 const page=location.pathname.split('/').pop()||'index.html',journal=page==='index.html';
 const mobile=matchMedia('(max-width: 900px)');
 const words={ru:['Рабочее пространство','Торговля','Аналитика','Инструменты','Обзор','Новая сделка','Сделки','Календарь','Статистика','ИИ-разбор','Скриншоты','По месяцам','Обучение','Проп-компании','Система','Меню','Закрыть меню','На этой странице'],uk:['Робочий простір','Торгівля','Аналітика','Інструменти','Огляд','Нова угода','Угоди','Календар','Статистика','ШІ-аналіз','Скриншоти','За місяцями','Навчання','Проп-компанії','Система','Меню','Закрити меню','На цій сторінці'],en:['Workspace','Trading','Analytics','Tools','Overview','New trade','Trades','Calendar','Statistics','AI review','Screenshots','Monthly','Learning','Prop firms','System','Menu','Close menu','On this page'],cs:['Pracovní prostor','Obchodování','Analýzy','Nástroje','Přehled','Nový obchod','Obchody','Kalendář','Statistiky','AI rozbor','Snímky','Po měsících','Vzdělávání','Prop firmy','Systém','Menu','Zavřít menu','Na této stránce']};
 let lang=typeof currentLang==='string'?currentLang:document.documentElement.lang;
 const side=document.createElement('aside');side.id='workspaceSidebar';side.className='workspace-sidebar';
 const shade=document.createElement('div');shade.className='sidebar-shade';shade.hidden=true;
 const toggle=document.createElement('button');toggle.type='button';toggle.className='sidebar-toggle';toggle.setAttribute('aria-controls',side.id);toggle.innerHTML='<span aria-hidden="true">☰</span>';
 bar.prepend(toggle);document.body.append(shade,side);document.body.classList.add('has-sidebar');
 const old=bar.querySelector('.nav-links');const localLinks=[...(old||bar).querySelectorAll('a[href^="#"]')].filter(a=>!journal).map(a=>({href:a.getAttribute('href'),label:a.textContent}));
 if(old)old.hidden=true;
 if(!old)bar.querySelectorAll(':scope > a:not(.nav-logo)').forEach(a=>a.hidden=true);
 const crumb=document.createElement('span');crumb.className='workspace-location';bar.insertBefore(crumb,toggle.nextSibling);
 let open=false,compact=false;
 function labels(){return words[lang]||words.en;}
 function setOpen(value){open=value;document.body.classList.toggle('sidebar-open',open);shade.hidden=!open;side.setAttribute('aria-modal',String(mobile.matches&&open));sync();if(open)side.querySelector('button').focus();else toggle.focus();}
 function sync(){const small=mobile.matches;side.inert=small&&!open;side.setAttribute('role',small?'dialog':'navigation');side.setAttribute('aria-label',labels()[0]);if(!small)side.removeAttribute('aria-modal');toggle.setAttribute('aria-expanded',String(small?open:!compact));toggle.setAttribute('aria-label',labels()[15]);}
 function active(){
  let selected;
  for(const a of side.querySelectorAll('a[data-route]')){const u=new URL(a.href,location.href);const match=u.pathname===location.pathname||(journal&&u.pathname.endsWith('/index.html'));const on=match&&(u.hash?u.hash===(location.hash||'#performanceDashboard'):true);a.classList.toggle('active',on);if(on){a.setAttribute('aria-current',u.hash?'location':'page');selected=a;}else a.removeAttribute('aria-current');}
  crumb.textContent=selected?.querySelector('.sidebar-label')?.textContent||labels()[0];
 }
 function render(){
  const t=labels(),en=lang==='en',learning={ru:'learning.html',en:'learning-en.html',uk:'learning-uk.html',cs:'learning-cs.html'}[lang]||'learning-en.html';
  const sections=[[1,[[4,'#performanceDashboard','◫'],[5,'#add','＋'],[6,'#trades','≡'],[7,'#calendar','▦']]],[2,[[8,'#stats','▥'],[9,'#reviewCenter','✧'],[10,'#library','▧'],[11,'#monthly','◷']]],[3,[[12,learning,'◇'],[13,en?'prop-firms-en.html':'prop-firms.html','▱'],[14,en?'system-en.html':'system.html','⌘'],[{ru:'Торговый план',uk:'Торговий план',en:'Trading plan',cs:'Obchodní plán'}[lang]||'Trading plan',(en?'system-en.html':'system.html')+'#strategyDesk','◎'],['MT5 Reporter','mt5-reporter.html','⇄']]]];
  side.replaceChildren();const brand=document.createElement('div');brand.className='sidebar-brand';const home=document.createElement('a');home.href='index.html';home.innerHTML='<b>TK</b><span class="sidebar-label">TRADING JOURNAL</span>';const close=document.createElement('button');close.type='button';close.className='sidebar-close';close.textContent='×';close.setAttribute('aria-label',t[16]);close.addEventListener('click',()=>setOpen(false));brand.append(home,close);side.append(brand);
  for(const [heading,items] of sections){const group=document.createElement('div');group.className='sidebar-group';const title=document.createElement('h2');title.textContent=t[heading];group.append(title);for(const [label,href,icon] of items){const a=document.createElement('a');a.href=href.startsWith('#')?(journal?href:'index.html'+href):href;a.dataset.route='';a.title=typeof label==='number'?t[label]:label;a.setAttribute('aria-label',a.title);const glyph=document.createElement('span');glyph.className='sidebar-icon';glyph.setAttribute('aria-hidden','true');glyph.textContent=icon;const text=document.createElement('span');text.className='sidebar-label';text.textContent=a.title;a.append(glyph,text);group.append(a);}side.append(group);}
  if(localLinks.length){const group=document.createElement('div');group.className='sidebar-group sidebar-local';const title=document.createElement('h2');title.textContent=t[17];group.append(title);for(const item of localLinks){const a=document.createElement('a');a.href=item.href;a.textContent=item.label;group.append(a);}side.append(group);}
  sync();active();
 }
 toggle.addEventListener('click',()=>{if(mobile.matches)setOpen(!open);else{compact=!compact;document.body.classList.toggle('sidebar-compact',compact);sync();window.dispatchEvent(new Event('resize'));}});
 shade.addEventListener('click',()=>setOpen(false));
 side.addEventListener('click',e=>{if(e.target.closest('a')&&mobile.matches)setOpen(false);});
 document.addEventListener('keydown',e=>{if(!open||!mobile.matches)return;if(e.key==='Escape'){e.preventDefault();setOpen(false);}if(e.key==='Tab'){const all=[...side.querySelectorAll('a,button')].filter(el=>!el.hidden),first=all[0],last=all.at(-1);if(e.shiftKey&&(document.activeElement===first||!side.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!side.contains(document.activeElement))){e.preventDefault();first.focus();}}});
 mobile.addEventListener('change',()=>{open=false;shade.hidden=true;document.body.classList.remove('sidebar-open');sync();});
 document.getElementById('langSelect')?.addEventListener('change',e=>{lang=e.target.value;render();});
 window.addEventListener('hashchange',active);render();
})();
