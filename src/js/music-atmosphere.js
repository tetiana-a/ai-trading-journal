/* Theme-aware prism flows driven by the player's real analyser. */
(() => {
 'use strict';
 const art=new Image();art.decoding='async';art.src='assets/images/atmospheric-prism.png';
 art.onload=()=>window.RadioDeckBridge?.redraw();
 // The source photo has a white frame with rounded corners baked in; trim it so no edge can ever show.
 const TRIM={x:.012,y:.022};
 // Midpoint of the light beam, as fractions of the full photo. It keeps the same relative spot on every screen.
 const FOCUS={x:.511,y:.417};
 // Size used for the flow geometry until the photo has loaded, so nothing jumps when it arrives.
 const NOMINAL={w:1221,h:690};
 /* Full-bleed placement, like CSS object-fit:cover with a focal point. The photo is drawn once,
    always fills the viewport, and overscans by a pixel so sub-pixel rounding cannot leave a seam. */
 function cover(w,h,nw,nh){
  const sx=nw*TRIM.x,sy=nh*TRIM.y,sw=nw-sx*2,sh=nh-sy*2;
  const scale=Math.max((w+2)/sw,(h+2)/sh),dw=sw*scale,dh=sh*scale;
  const dx=(w-dw)*(FOCUS.x*nw-sx)/sw,dy=(h-dh)*(FOCUS.y*nh-sy)/sh;
  return {sx,sy,sw,sh,dx,dy,dw,dh,scale,ox:dx-sx*scale,oy:dy-sy*scale,iw:nw*scale,ih:nh*scale};
 }
 let energy=0;
 function render(ctx,w,h,time,bass,mid,high,wave){
  const light=document.documentElement.dataset.theme==='light';
  let rms=0;if(wave){for(const sample of wave)rms+=((sample-128)/128)**2;rms=Math.sqrt(rms/wave.length);}
  const target=Math.min(1,bass*.65+rms*1.7+mid*.2);energy=time?energy+(target-energy)*(target>energy?.24:.075):0;
  const colors=light?['177,74,97','169,109,39','65,131,98','29,129,151','83,91,172']:['236,77,119','255,177,68','87,220,150','66,199,242','158,124,237'];
  ctx.save();ctx.clearRect(0,0,w,h);ctx.fillStyle=light?'#f4f3ef':'#020a10';ctx.fillRect(0,0,w,h);
  const ready=art.complete&&art.naturalWidth>0;
  const place=cover(w,h,ready?art.naturalWidth:NOMINAL.w,ready?art.naturalHeight:NOMINAL.h);
  if(ready){ctx.globalAlpha=light?.14:.65;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(art,place.sx,place.sy,place.sw,place.sh,place.dx,place.dy,place.dw,place.dh);ctx.globalAlpha=1;}
  // Everything below is positioned in photo space, so the flows stay locked to the picture at any size.
  const {ox,oy,iw,ih}=place,x=ox+iw*.426,y=oy+ih*.417,mirror=ox+iw*.596;
  const unit=Math.min(1.75,Math.max(.55,ih/1080)),span=x-ox,from=Math.max(0,-ox/span);
  const speed=time/1800,amplitude=ih*(.017+energy*.065),intensity=.12+energy*.42;
  ctx.globalCompositeOperation=light?'source-over':'screen';
  for(let band=0;band<colors.length;band++){
   const color=colors[band],g=ctx.createLinearGradient(ox,y,x,y);g.addColorStop(0,'rgba('+color+',0)');g.addColorStop(.6,'rgba('+color+','+intensity+')');g.addColorStop(1,'rgba('+color+','+(.25+energy*.55)+')');ctx.strokeStyle=g;
   for(let line=0;line<3;line++){
    // Only the on-screen part of each ribbon is traced, so narrow screens keep the same smoothness.
    ctx.beginPath();for(let point=0;point<=60;point++){const u=from+(1-from)*point/60,px=ox+span*u,taper=(1-u);const py=y+(band-2)*ih*.04*taper+Math.sin(u*8-speed*(1+energy)+band*.6+line*.15)*amplitude*taper+(line-1)*3*unit*taper;if(point===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.lineWidth=((light?1.5:2.5)+energy*(line===1?14:4))*unit;ctx.stroke();
   }
  }
  const beam=ctx.createLinearGradient(x,y,mirror,y);beam.addColorStop(0,light?'rgba(155,92,75,.5)':'rgba(255,199,142,.9)');beam.addColorStop(.5,light?'rgba(72,128,155,.5)':'rgba(184,226,255,.9)');beam.addColorStop(1,light?'rgba(143,88,105,.6)':'rgba(255,191,135,.95)');ctx.strokeStyle=beam;ctx.lineWidth=(1+energy*4)*unit;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(mirror,y);ctx.stroke();
  for(const cx of [x,mirror]){const radius=(12+energy*38)*unit,g=ctx.createRadialGradient(cx,y,0,cx,y,radius);g.addColorStop(0,light?'rgba(153,92,69,.25)':'rgba(255,221,177,.65)');g.addColorStop(1,'rgba(255,160,90,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,y,radius,0,Math.PI*2);ctx.fill();}
  if(time)for(let i=0;i<24;i++){const u=(i/24+time/15000*(.3+energy))%1;ctx.fillStyle='rgba('+colors[i%5]+','+(.06+high*.5)+')';ctx.beginPath();ctx.arc(ox+span*u,y+Math.sin(i*3+u*6)*ih*.16*(1-u),(.5+high*2)*unit,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 window.MusicAtmosphere={render,cover};
 new MutationObserver(()=>window.RadioDeckBridge?.redraw()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 /* Resizing a canvas wipes it. The deck only repaints while its animation loop runs, so repaint the
    still frame here after every resize or rotation; otherwise the background would stay empty. */
 const calm=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let queued=0;
 function repaint(){
  queued=0;const deck=window.RadioDeckBridge;if(!deck)return;
  deck.redraw();
  const state=deck.state,canvas=document.getElementById('bgCanvas');
  // While playing with reduced motion no loop is running, so paint the still frame directly.
  if(canvas&&state.local&&state.playing&&document.body.classList.contains('radio-on')&&calm?.matches)render(canvas.getContext('2d'),window.innerWidth,window.innerHeight,0,0,0,0,null);
 }
 function schedule(){if(queued||typeof requestAnimationFrame!=='function')return;queued=requestAnimationFrame(repaint);}
 window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);
})();
