/* One active source, official YouTube controls, no hidden video playback. */
(() => {
 'use strict';
 const dock=document.getElementById('radioDock'),bridge=window.RadioDeckBridge;
 if(!dock||!bridge)return;
 const videoId='cgQMjU_X6sc';let mode='radio',player=null,epoch=0,apiPromise=null,playing=false,timeout=null;
 const words={ru:['Радио','YouTube','Включить видео с музыкой','Открыть на YouTube','Видео остановится при закрытии окна. Фон — ambient-анимация.','Загрузка YouTube…','Нажмите ▶ в видео для воспроизведения.','Видео недоступно здесь. Откройте YouTube или выберите радио.','YouTube не загрузился. Повторите или выберите радио.'],uk:['Радіо','YouTube','Увімкнути відео з музикою','Відкрити на YouTube','Відео зупиниться після закриття вікна. Фон — ambient-анімація.','Завантаження YouTube…','Натисніть ▶ у відео для відтворення.','Відео недоступне тут. Відкрийте YouTube або виберіть радіо.','YouTube не завантажився. Повторіть або виберіть радіо.'],en:['Radio','YouTube','Play music video','Open on YouTube','Closing this panel stops video. Background uses ambient animation.','Loading YouTube…','Press ▶ in the video to play.','Video unavailable here. Open YouTube or choose radio.','YouTube could not load. Retry or choose radio.'],cs:['Rádio','YouTube','Přehrát hudební video','Otevřít na YouTube','Zavření panelu zastaví video. Pozadí používá ambientní animaci.','Načítání YouTube…','Stiskněte ▶ ve videu.','Video zde není dostupné. Otevřete YouTube nebo zvolte rádio.','YouTube se nenačetl. Zkuste znovu nebo zvolte rádio.']};
 const labels=()=>words[document.getElementById('langSelect')?.value||document.documentElement.lang]||words.en;
 const tabs=document.createElement('div');tabs.className='media-source-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Audio source');
 for(const name of ['radio','youtube']){const b=document.createElement('button');b.type='button';b.dataset.source=name;b.addEventListener('click',()=>select(name));tabs.append(b);}
 dock.querySelector('.radio-dock-top').after(tabs);
 const panel=document.createElement('section');panel.className='youtube-panel';panel.hidden=true;panel.innerHTML='<div class="youtube-stage"><div id="musicVideoMount"></div></div><button type="button" class="youtube-start"></button><p class="youtube-status" role="status" aria-live="polite"></p><div class="youtube-links"><a target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=cgQMjU_X6sc"></a></div><p class="youtube-note"></p>';
 tabs.after(panel);
 const status=panel.querySelector('.youtube-status'),start=panel.querySelector('.youtube-start'),stage=panel.querySelector('.youtube-stage');
 let statusKey=6;
 function say(key){statusKey=key;status.textContent=labels()[key]||key;}
 function sync(){
  const t=labels();dock.classList.toggle('youtube-mode',mode==='youtube');panel.hidden=mode!=='youtube';
  tabs.querySelectorAll('button').forEach((b,i)=>{b.textContent=t[i];b.setAttribute('aria-pressed',String(b.dataset.source===mode));});
  start.textContent=t[2];panel.querySelector('a').textContent=t[3];panel.querySelector('.youtube-note').textContent=t[4];status.textContent=t[statusKey]||statusKey;
  if(mode==='youtube'){const nav=document.querySelector('#radioBtn .radio-nav-label'),state=document.querySelector('#radioBtn .radio-nav-state');if(nav)nav.textContent='YouTube';if(state)state.textContent=playing?'VIDEO':'AUDIO';const b=document.getElementById('radioBtn');if(b)b.title='YouTube · '+videoId;}
 }
 function destroy(){epoch++;clearTimeout(timeout);timeout=null;playing=false;const old=player;player=null;try{old?.destroy();}catch(_){}stage.replaceChildren();const mount=document.createElement('div');mount.id='musicVideoMount';stage.append(mount);stage.hidden=true;start.hidden=false;bridge.externalPlaying(false);}
 function useRadio(){if(mode==='radio')return;mode='radio';destroy();sync();}
 function api(){
  if(window.YT?.Player)return Promise.resolve();if(apiPromise)return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{let settled=false;const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.id='musicYouTubeAPI';const previous=window.onYouTubeIframeAPIReady;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);if(error){script.remove();apiPromise=null;reject(error);}else resolve();};
   const timer=setTimeout(()=>finish(new Error('timeout')),15000);script.onerror=()=>finish(new Error('network'));
   window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{window.YT?.Player?finish():finish(new Error('API unavailable'));}};document.head.append(script);
  });return apiPromise;
 }
 async function play(){
  bridge.stop();destroy();const token=epoch;say(5);start.hidden=true;
  try{await api();if(token!==epoch||mode!=='youtube'||!dock.classList.contains('open'))return;
   stage.hidden=false;
   timeout=setTimeout(()=>{if(token!==epoch)return;destroy();say(8);},15000);
   player=new window.YT.Player('musicVideoMount',{host:'https://www.youtube-nocookie.com',width:'100%',height:220,videoId,playerVars:{playsinline:1,controls:1,autoplay:0,origin:location.origin},events:{
    onReady:e=>{if(token!==epoch){e.target.destroy();return;}clearTimeout(timeout);timeout=null;e.target.getIframe().title='YouTube music video';e.target.getIframe().referrerPolicy='strict-origin-when-cross-origin';say(6);e.target.playVideo();},
    onStateChange:e=>{if(token!==epoch)return;if(mode!=='youtube'||!dock.classList.contains('open')){destroy();return;}playing=e.data===1;bridge.externalPlaying(playing);say(playing?'YouTube · ▶':e.data===3?5:6);},
    onAutoplayBlocked:()=>{if(token===epoch)say(6);},
    onError:()=>{if(token!==epoch)return;destroy();say(7);}
   }});
  }catch(_){if(token!==epoch)return;destroy();say(8);}
 }
 function select(next){if(next===mode)return;if(next==='radio'){useRadio();bridge.stop();return;}bridge.stop();mode='youtube';sync();play();}
 start.addEventListener('click',play);
 // Cancel before radio's close handlers run, including while API loading is pending.
 const close=()=>{if(mode==='youtube'){destroy();say(6);}};
 document.getElementById('radioDockClose')?.addEventListener('click',close);
 document.getElementById('radioBtn')?.addEventListener('click',()=>{if(!dock.classList.contains('open'))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 window.addEventListener('pagehide',close);
 document.getElementById('langSelect')?.addEventListener('change',sync);
 window.YouTubeDeck={sync,useRadio};stage.hidden=true;sync();
})();
