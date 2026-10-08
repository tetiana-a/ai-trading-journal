/* Starts the music and its background on the visitor's first click, tap or key press.
   Browsers block sound until the page has been interacted with, so this is the earliest moment allowed. */
(() => {
 'use strict';
 const deck=window.RadioDeckBridge;if(!deck)return;
 const PAUSED='tk_audio_paused',LIVE='tk_audio_live',POSITION='tk_audio_position';
 const OWN_CONTROLS='#radioDock,#musicQuickPause';
 const IGNORED_KEYS=['Escape','Tab','Shift','Control','Alt','Meta','CapsLock'];
 const GESTURES=['pointerup','click','touchend','keydown'];
 const read=(store,key)=>{try{return window[store].getItem(key);}catch(_){return null;}};
 const write=(store,key,value)=>{try{window[store].setItem(key,String(value));}catch(_){}};
 const active=()=>{const s=deck.state;return s.playing||s.loading;};
 let armed=false,trying=false,attempts=0;

 // A first-time visitor gets the personal track with its photo background; a returning one gets their last choice.
 function start(){if(read('localStorage','tk_radio_station'))deck.toggle();else deck.select('personal');}

 // Carry the track position across pages of the site, so music continues instead of restarting.
 function restorePosition(){
  const saved=Number(read('sessionStorage',POSITION));if(!(saved>1))return;
  const until=Date.now()+10000;
  (function wait(){const s=deck.state;if(!s.local||!s.playing||Date.now()>until)return;if(s.duration>0){if(saved<s.duration-2)deck.seek(saved);return;}setTimeout(wait,30);})();
 }

 function attempt(counted){
  if(trying||active())return;
  trying=true;if(counted)attempts++;
  const began=Date.now();start();
  (function settle(){
   const s=deck.state;
   if(s.playing){trying=false;disarm();restorePosition();return;}
   if(!s.loading||Date.now()-began>20000){trying=false;if(attempts>=3)disarm();return;}
   setTimeout(settle,100);
  })();
 }

 function onGesture(event){
  if(active()){disarm();return;}
  if(event.type==='keydown'&&IGNORED_KEYS.includes(event.key))return;
  // The deck's own buttons already start and stop playback; do not fight them.
  if(event.target instanceof Element&&event.target.closest(OWN_CONTROLS))return;
  // A scroll swipe does not unlock sound; wait for a real tap instead of failing on it.
  if(navigator.userActivation&&!navigator.userActivation.isActive)return;
  attempt(true);
 }
 function arm(){if(armed)return;armed=true;attempts=0;for(const type of GESTURES)window.addEventListener(type,onGesture,{capture:true,passive:true});}
 function disarm(){if(!armed)return;armed=false;for(const type of GESTURES)window.removeEventListener(type,onGesture,{capture:true});}

 // Pausing by hand keeps the site quiet for the rest of this visit; pressing play lifts that again.
 // Capture phase: the buttons redraw their own contents while handling the click, which would detach the target.
 document.addEventListener('click',event=>{
  if(!(event.target instanceof Element)||!event.target.closest('#radioPlayBtn,#musicQuickPause,[data-music-source]'))return;
  setTimeout(()=>{const on=active();write('sessionStorage',PAUSED,on?'0':'1');if(on)disarm();},0);
 },true);

 let beat=0;
 function remember(){const s=deck.state;write('sessionStorage',LIVE,s.playing?'1':'0');if(s.playing&&s.local)write('sessionStorage',POSITION,Math.floor(s.position||0));}
 function watch(){clearInterval(beat);beat=setInterval(remember,1000);}
 window.addEventListener('pagehide',()=>clearInterval(beat));
 // Coming back with the browser's Back button restores a page whose music was stopped on leaving.
 window.addEventListener('pageshow',event=>{if(!event.persisted)return;watch();if(read('sessionStorage',PAUSED)!=='1')arm();});
 watch();

 if(read('sessionStorage',PAUSED)==='1')return;
 arm();
 // Moving between pages of the site: some browsers keep sound unlocked, so try to continue right away.
 if(read('sessionStorage',LIVE)==='1')attempt(false);
})();
