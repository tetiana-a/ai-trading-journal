/* Two visible atmospheres with exclusive transport; closing controls never pauses media. */
(() => {
 'use strict';
 const dock=document.getElementById('radioDock'),bridge=window.RadioDeckBridge;
 if(!dock||!bridge)return;
 const videoId='cgQMjU_X6sc';let mode='radio',player=null,epoch=0,apiPromise=null,playing=false,timeout=null,ready=false,intent=false,collapsed=false;
 const words={ru:['Радио','YouTube','Включить видео с музыкой','Открыть на YouTube','Видео на фоне. Закрытие панели не останавливает музыку. Пауза — в верхней панели.','Загрузка YouTube…','Нажмите ▶ для воспроизведения.','Видео недоступно здесь. Откройте YouTube или выберите радио.','YouTube не загрузился. Повторите или выберите радио.'],uk:['Радіо','YouTube','Увімкнути відео з музикою','Відкрити на YouTube','Відео на фоні. Закриття панелі не зупиняє музику. Пауза — у верхній панелі.','Завантаження YouTube…','Натисніть ▶ для відтворення.','Відео недоступне тут. Відкрийте YouTube або виберіть радіо.','YouTube не завантажився. Повторіть або виберіть радіо.'],en:['Radio','YouTube','Play music video','Open on YouTube','Background video. Closing controls keeps music playing. Pause is always in the top bar.','Loading YouTube…','Press ▶ to play.','Video unavailable here. Open YouTube or choose radio.','YouTube could not load. Retry or choose radio.'],cs:['Rádio','YouTube','Přehrát hudební video','Otevřít na YouTube','Video na pozadí. Zavření panelu hudbu nezastaví. Pauza je v horní liště.','Načítání YouTube…','Stiskněte ▶ pro přehrávání.','Video zde není dostupné. Otevřete YouTube nebo zvolte rádio.','YouTube se nenačetl. Zkuste znovu nebo zvolte rádio.']};
 const labels=()=>words[document.getElementById('langSelect')?.value||document.documentElement.lang]||words.en;
 const tabs=document.createElement('div');tabs.className='media-source-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Audio source');
 for(const name of ['radio','youtube']){const b=document.createElement('button');b.type='button';b.dataset.source=name;b.addEventListener('click',()=>select(name));tabs.append(b);}
 dock.querySelector('.radio-dock-top').after(tabs);
 const panel=document.createElement('section');panel.className='youtube-panel';panel.hidden=true;panel.innerHTML='<div class="youtube-stage"><div id="musicVideoMount"></div></div><button type="button" class="youtube-start"></button><p class="youtube-status" role="status" aria-live="polite"></p><div class="youtube-links"><a target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=cgQMjU_X6sc"></a></div><p class="youtube-note"></p>';
 tabs.after(panel);
 const status=panel.querySelector('.youtube-status'),start=panel.querySelector('.youtube-start'),stage=panel.querySelector('.youtube-stage');
 document.body.append(stage);stage.classList.add('youtube-background');
 const transport=document.createElement('button');transport.type='button';transport.className='atmosphere-pause';transport.id='atmospherePause';transport.hidden=true;document.getElementById('radioBtn').after(transport);
 const volumeLabel=document.createElement('label');volumeLabel.className='youtube-volume';volumeLabel.textContent='Volume';const volumeInput=document.createElement('input');volumeInput.type='range';volumeInput.min='0';volumeInput.max='100';volumeInput.step='1';volumeInput.value=String(Math.round(Number(document.getElementById('radioVolume')?.value||.52)*100));volumeLabel.append(volumeInput);panel.append(volumeLabel);
 volumeInput.addEventListener('input',()=>{if(ready)player?.setVolume(Number(volumeInput.value));});
 let statusKey=6;
 function say(key){statusKey=key;status.textContent=labels()[key]||key;}
 function sync(){
  const t=labels();document.body.classList.toggle('video-atmosphere',mode==='youtube');transport.hidden=mode!=='youtube';
  const pauseText={ru:'Пауза',uk:'Пауза',en:'Pause',cs:'Pauza'}[document.getElementById('langSelect')?.value||document.documentElement.lang]||'Pause';
  const controlText=playing?'Ⅱ '+pauseText:'▶ YouTube';transport.textContent=controlText;transport.setAttribute('aria-label',controlText);transport.setAttribute('aria-pressed',String(playing));transport.disabled=!ready&&!!player;
  dock.classList.toggle('youtube-mode',mode==='youtube');panel.hidden=mode!=='youtube';
  tabs.querySelectorAll('button').forEach((b,i)=>{b.textContent=t[i];b.setAttribute('aria-pressed',String(b.dataset.source===mode));});
  start.textContent=playing?controlText:t[2];panel.querySelector('a').textContent=t[3];panel.querySelector('.youtube-note').textContent=t[4];status.textContent=t[statusKey]||statusKey;
  if(mode==='youtube'){const nav=document.querySelector('#radioBtn .radio-nav-label'),state=document.querySelector('#radioBtn .radio-nav-state');if(nav)nav.textContent='YouTube';if(state)state.textContent=playing?'VIDEO':'AUDIO';const b=document.getElementById('radioBtn');if(b)b.title='YouTube · '+videoId;}
 }
 function destroy(){epoch++;clearTimeout(timeout);timeout=null;playing=false;ready=false;intent=false;const old=player;player=null;try{old?.destroy();}catch(_){}stage.replaceChildren();const mount=document.createElement('div');mount.id='musicVideoMount';stage.append(mount);stage.hidden=true;start.hidden=false;bridge.externalPlaying(false);}
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
  bridge.stop();destroy();intent=true;collapsed=false;const token=epoch;say(5);start.hidden=true;
  try{await api();if(token!==epoch||mode!=='youtube')return;
   stage.hidden=false;
   timeout=setTimeout(()=>{if(token!==epoch)return;destroy();say(8);},15000);
   player=new window.YT.Player('musicVideoMount',{host:'https://www.youtube-nocookie.com',width:'100%',height:window.innerHeight,videoId,playerVars:{playsinline:1,controls:0,autoplay:0,loop:1,playlist:videoId,origin:location.origin},events:{
    onReady:e=>{if(token!==epoch){e.target.destroy();return;}clearTimeout(timeout);timeout=null;e.target.getIframe().title='YouTube music video';e.target.getIframe().referrerPolicy='strict-origin-when-cross-origin';ready=true;start.hidden=false;e.target.getIframe().tabIndex=-1;e.target.setVolume(Number(volumeInput.value));say(6);sync();if(intent)e.target.playVideo();},
    onStateChange:e=>{if(token!==epoch)return;if(mode!=='youtube'){destroy();return;}if(e.data===1&&!intent){e.target.pauseVideo();return;}playing=e.data===1;bridge.externalPlaying(playing);say(playing?'YouTube · ▶':e.data===3?5:6);if(playing&&!collapsed){collapsed=true;document.getElementById('radioDockClose')?.click();}},
    onAutoplayBlocked:()=>{if(token===epoch){intent=false;start.hidden=false;say(6);sync();}},
    onError:()=>{if(token!==epoch)return;destroy();say(7);}
   }});
  }catch(_){if(token!==epoch)return;destroy();say(8);}
 }
 function select(next){if(next===mode)return;if(next==='radio'){useRadio();bridge.stop();return;}bridge.stop();mode='youtube';sync();play();}
 function toggle(){if(!player||!ready){play();return;}const pause=playing||intent;intent=!pause;if(pause){player.pauseVideo();playing=false;bridge.externalPlaying(false);say(6);}else player.playVideo();sync();}
 start.addEventListener('click',toggle);transport.addEventListener('click',toggle);
 window.addEventListener('pagehide',()=>{if(mode==='youtube')destroy();});
 document.getElementById('langSelect')?.addEventListener('change',sync);
 window.YouTubeDeck={sync,useRadio};stage.hidden=true;sync();
})();
