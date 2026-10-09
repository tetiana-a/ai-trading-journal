/* Theme-aware prism light driven by the player's real analyser: a fan of fine spectral threads,
   a beam between the two figures, and small accents that answer the music. */
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
 // The dispersed spectrum from top to bottom, matched to the rainbow in the photo.
 const SPECTRUM=[[255,92,128],[255,138,92],[255,190,84],[238,228,124],[132,230,152],[84,214,222],[92,160,255],[142,122,255],[198,122,250],[255,122,204]];
 // Stable pseudo-random value per index: every thread keeps its own character from frame to frame.
 const rand=n=>{const v=Math.sin(n*12.9898)*43758.5453;return v-Math.floor(v);};
 // Colour at position t of the spectrum; `pearl` lifts it toward white, the light theme deepens it.
 function tint(t,light,pearl){
  const f=Math.min(.9999,Math.max(0,t))*(SPECTRUM.length-1),i=Math.floor(f),k=f-i;
  return SPECTRUM[i].map((v,n)=>{let c=v+(SPECTRUM[i+1][n]-v)*k;if(pearl)c+=(255-c)*pearl;return Math.round(light?c*.58:c);}).join(',');
 }
 const ink=(rgb,alpha)=>'rgba('+rgb+','+Math.max(0,Math.min(1,alpha)).toFixed(3)+')';
 let energy=0,flow=0,drift=0,last=0,bassLevel=0,lastBeat=0;
 const rings=[];
 function render(ctx,w,h,time,bass,mid,high,wave){
  const light=document.documentElement.dataset.theme==='light';
  let rms=0;if(wave){for(const sample of wave)rms+=((sample-128)/128)**2;rms=Math.sqrt(rms/wave.length);}
  const target=Math.min(1,bass*.65+rms*1.7+mid*.2);energy=time?energy+(target-energy)*(target>energy?.24:.075):0;
  // Motion advances by elapsed time, so louder passages quicken the flow without making it jump.
  const dt=time&&last?Math.min(80,Math.max(0,time-last)):0;last=time;
  if(time){
   flow+=dt/1000*(.5+energy*1.35);drift+=dt/1000*(.04+energy*.1);
   bassLevel+=(bass-bassLevel)*.08;
   if(bass-bassLevel>.09&&bass>.3&&time-lastBeat>340){lastBeat=time;rings.push(time);if(rings.length>3)rings.shift();}
  }else{bassLevel=0;rings.length=0;}
  ctx.save();ctx.clearRect(0,0,w,h);ctx.fillStyle=light?'#f4f3ef':'#020a10';ctx.fillRect(0,0,w,h);
  const ready=art.complete&&art.naturalWidth>0;
  const place=cover(w,h,ready?art.naturalWidth:NOMINAL.w,ready?art.naturalHeight:NOMINAL.h);
  if(ready){ctx.globalAlpha=light?.14:.65;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(art,place.sx,place.sy,place.sw,place.sh,place.dx,place.dy,place.dw,place.dh);ctx.globalAlpha=1;}
  // Everything below is positioned in photo space, so the light stays locked to the picture at any size.
  // (x, y) is the eye the light enters; (mirror, my) the eye of the mask. The beam in the photo climbs slightly.
  const {ox,oy,iw,ih}=place,x=ox+iw*.426,y=oy+ih*.4178,mirror=ox+iw*.596,my=oy+ih*.4066;
  const unit=Math.min(1.75,Math.max(.55,ih/1080)),span=x-ox,from=Math.max(0,-ox/span);
  const dim=light?.6:1,TAU=Math.PI*2;
  ctx.globalCompositeOperation=light?'source-over':'screen';ctx.lineCap='round';ctx.lineJoin='round';

  /* Threads of dispersed light. Each fans out from the eye toward the left edge along its own gentle
     wave; neighbours share most of their phase, so together they move like strands of silk. */
  const count=Math.round(Math.min(72,Math.max(40,ih/15)));
  const thread=i=>{
   const t=i/(count-1),c=t*2-1,r=rand(i+1),r2=rand(i+57);
   const reach=(c<0?.185:.265)*Math.sign(c)*Math.pow(Math.abs(c),1.12);
   return {t,r,r2,end:ih*reach*(1+energy*.16)*(1+.05*Math.sin(drift*5+t*4)),amp:ih*(.0065+energy*.024)*(.55+r*.9),freq:6.4+Math.sin(t*5.2)*1.3+r2*.6,phase:t*3.4+r*.8};
  };
  const yAt=(f,u)=>{const v=1-u;return y+f.end*Math.pow(v,1.35)+(Math.sin(u*f.freq-flow+f.phase)*f.amp+Math.sin(u*f.freq*2.3+flow*.55+f.phase*1.7)*f.amp*.38)*Math.pow(v,.8);};
  // Only the on-screen part of each thread is traced, so narrow screens keep the same smoothness.
  const trace=(f,steps)=>{ctx.beginPath();for(let p=0;p<=steps;p++){const u=from+(1-from)*p/steps,px=ox+span*u,py=yAt(f,u);if(p)ctx.lineTo(px,py);else ctx.moveTo(px,py);}};
  const fade=(rgb,alpha,stops)=>{const g=ctx.createLinearGradient(ox,y,x,y);for(const [at,k] of stops)g.addColorStop(at,ink(rgb,alpha*k));return g;};

  // A soft aura of broad, faint bands under the threads gives the fan its glow.
  for(let band=0;band<8;band++){
   const f=thread(Math.round((band+.5)/8*(count-1)));
   ctx.strokeStyle=fade(tint(f.t,light,0),(.035+energy*.07)*dim,[[0,0],[.25,.8],[.6,1],[.92,.3],[1,0]]);
   ctx.lineWidth=ih*(.03+energy*.022);trace(f,26);ctx.stroke();
  }
  // The threads themselves: hairlines, with an occasional brighter strand and pearl-white highlights.
  // They dim toward the eye, where they all meet, so the meeting point never burns out to a white rope.
  for(let i=0;i<count;i++){
   const f=thread(i),bright=i%7===3,pearl=i%4===1;
   const alpha=Math.min(.92,(.2+f.r*.2+energy*.5+(bright?.14:0))*(pearl?.8:1))*dim;
   ctx.strokeStyle=fade(tint(f.t,light,pearl?.72:bright?.18:0),alpha,[[0,0],[.1,.3],[.48,1],[.86,.6],[1,.14]]);
   ctx.lineWidth=(bright?1.3:pearl?.55:.6+f.r2*.45)*unit*(1+energy*.75);
   trace(f,44);ctx.stroke();
  }
  // Motes of light ride the threads outward from the eye and twinkle with the treble.
  if(time){
   const motes=Math.round(count*1.15);
   for(let k=0;k<motes;k++){
    const f=thread(Math.floor(rand(k+201)*count)),gone=(rand(k+311)+drift*(.6+rand(k+17)*1.2))%1,u=1-gone;if(u<from)continue;
    const twinkle=.5+.5*Math.sin(time/170+k*7.3),alpha=Math.pow(Math.sin(Math.PI*gone),.7)*(.2+high*.9+energy*.25)*(.45+twinkle*.55)*dim;
    const px=ox+span*u,py=yAt(f,u),size=(.55+rand(k+5)*1.05)*unit*(1+high*1.2),colour=ink(tint(f.t,light,.55),alpha);
    ctx.fillStyle=colour;ctx.beginPath();ctx.arc(px,py,size,0,TAU);ctx.fill();
    if(k%8===0){const arm=size*4.5;ctx.strokeStyle=colour;ctx.lineWidth=.5*unit;ctx.beginPath();ctx.moveTo(px-arm,py);ctx.lineTo(px+arm,py);ctx.moveTo(px,py-arm);ctx.lineTo(px,py+arm);ctx.stroke();}
   }
  }
  // A small second fan where the light leaves the mask, echoing the reflection in the photo.
  const echo=iw*.085;
  for(let i=0;i<18;i++){
   const t=i/17,r=rand(i+401),end=ih*(-.028+t*.105),alpha=(.1+energy*.42)*(.6+r*.4)*dim,rgb=tint(t,light,i%3===0?.5:0);
   const g=ctx.createLinearGradient(mirror,my,mirror+echo,my);g.addColorStop(0,ink(rgb,alpha*.2));g.addColorStop(.25,ink(rgb,alpha));g.addColorStop(1,ink(rgb,0));
   ctx.strokeStyle=g;ctx.lineWidth=(.5+r*.4)*unit*(1+energy*.6);ctx.beginPath();
   for(let p=0;p<=18;p++){const q=p/18,px=mirror+echo*q,py=my+end*Math.pow(q,1.25)+Math.sin(q*5+flow*1.2+t*3)*ih*(.002+energy*.006)*q;if(p)ctx.lineTo(px,py);else ctx.moveTo(px,py);}
   ctx.stroke();
  }
  // The beam between the two: a fine white core in a soft halo, with coloured fringes and travelling pulses.
  const warm=light?'155,92,75':'255,220,180',cool=light?'72,128,155':'214,236,255';
  const along=alpha=>{const g=ctx.createLinearGradient(x,y,mirror,my);g.addColorStop(0,ink(warm,alpha));g.addColorStop(.5,ink(cool,alpha));g.addColorStop(1,ink(warm,alpha));return g;};
  const line=offset=>{ctx.beginPath();ctx.moveTo(x,y+offset);ctx.lineTo(mirror,my+offset);ctx.stroke();};
  ctx.strokeStyle=along((.07+energy*.13)*dim);ctx.lineWidth=(5+energy*9)*unit;line(0);
  const fringe=(1.6+energy*2.2)*unit;ctx.lineWidth=.5*unit;
  ctx.strokeStyle=ink(tint(0,light,.2),(.16+energy*.26)*dim);line(-fringe);
  ctx.strokeStyle=ink(tint(.56,light,.2),(.16+energy*.26)*dim);line(fringe);
  ctx.strokeStyle=along(light?.55:.9);ctx.lineWidth=(.8+energy*1.1)*unit;line(0);
  if(time)for(let n=0;n<3;n++){
   // q runs from the mask (0) to the eye (1); each pulse is a short streak with a bright head and a fading tail.
   const q=(flow*.22+n/3)%1,tail=Math.max(0,q-.07),at=k=>[mirror+(x-mirror)*k,my+(y-my)*k],[hx,hy]=at(q),[tx,ty]=at(tail);
   const g=ctx.createLinearGradient(hx,hy,tx,ty);g.addColorStop(0,ink(cool,(.4+high*.6)*Math.sin(Math.PI*q)*dim));g.addColorStop(1,ink(cool,0));
   ctx.strokeStyle=g;ctx.lineWidth=(1.3+energy*1.6)*unit;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(tx,ty);ctx.stroke();
  }
  // Where the beam meets each eye: a small halo and a four-point glint that opens with the music.
  for(const [cx,cy,scale] of [[x,y,1],[mirror,my,.72]]){
   const radius=(9+energy*26)*unit*scale,halo=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
   halo.addColorStop(0,light?'rgba(153,92,69,.26)':'rgba(255,238,212,.7)');halo.addColorStop(.35,light?'rgba(153,92,69,.1)':'rgba(255,190,130,.22)');halo.addColorStop(1,'rgba(255,160,90,0)');
   ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);ctx.fill();
   const reach=(26+energy*84)*unit*scale;ctx.lineWidth=.7*unit;
   for(const [dx,dy] of [[reach,0],[0,reach*.42]]){
    const g=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);g.addColorStop(0,ink(cool,0));g.addColorStop(.5,ink(light?warm:'255,255,255',(.5+energy*.4)*dim));g.addColorStop(1,ink(cool,0));
    ctx.strokeStyle=g;ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);ctx.lineTo(cx+dx,cy+dy);ctx.stroke();
   }
  }
  // Each strong bass hit sends one thin ring out from the eye.
  for(const born of rings){
   const age=(time-born)/1000;if(!time||age<0||age>1)continue;
   ctx.strokeStyle=ink(warm,Math.pow(1-age,2)*Math.min(1,age*6)*.3*dim);ctx.lineWidth=.8*unit;
   ctx.beginPath();ctx.ellipse(x,y,(10+age*78)*unit,(10+age*78)*unit*.82,0,0,TAU);ctx.stroke();
  }
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
