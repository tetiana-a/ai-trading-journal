/* Shared theme persistence and progressive account disclosure. */
(() => {
 'use strict';
 const root=document.documentElement;
 function save(){try{localStorage.setItem('tk_theme',root.dataset.theme);}catch(_){} const b=document.getElementById('themeTog');if(b)b.setAttribute('aria-pressed',String(root.dataset.theme==='dark'));}
 new MutationObserver(save).observe(root,{attributes:true,attributeFilter:['data-theme']});
 if(!document.getElementById('themeTog')){
  const bar=document.querySelector('.nav-in');if(bar){let controls=bar.querySelector('.nav-controls');if(!controls){controls=document.createElement('div');controls.className='nav-controls';bar.append(controls);}const b=document.createElement('button');b.id='themeTog';b.className='theme-tog';b.type='button';b.setAttribute('aria-label','Светлая / тёмная тема');b.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';});controls.append(b);}
 }
 save();
 const account=document.querySelector('.cloud-account'),hero=document.querySelector('.hero');
 if(account&&hero){hero.after(account);const actions=account.querySelector('.cloud-account-actions');if(actions){const details=document.createElement('details');details.className='account-details';const summary=document.createElement('summary');const labels={ru:'Подключение аккаунта и перенос данных',uk:'Підключення акаунта й перенесення даних',en:'Account connection and data migration',cs:'Připojení účtu a přenos dat'};const label=()=>{const lang=document.getElementById('langSelect')?.value||root.lang;summary.textContent=labels[lang]||labels.en;};label();document.getElementById('langSelect')?.addEventListener('change',label);details.append(summary,actions);account.append(details);}}
})();
