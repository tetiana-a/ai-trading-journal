/* Theme-aware prism flows driven by the player's real analyser. */
(() => {
 'use strict';
 const art=new Image();art.src='assets/images/atmospheric-prism.png';
 art.onload=()=>window.RadioDeckBridge?.redraw();
 let energy=0;
 function render(ctx,w,h,time,bass,mid,high,wave){
  const light=document.documentElement.dataset.theme==='light';
  let rms=0;if(wave){for(const sample of wave)rms+=((sample-128)/128)**2;rms=Math.sqrt(rms/wave.length);}
  const target=Math.min(1,bass*.65+rms*1.7+mid*.2);energy=time?energy+(target-energy)*(target>energy?.24:.075):0;
  const colors=light?['177,74,97','169,109,39','65,131,98','29,129,151','83,91,172']:['236,77,119','255,177,68','87,220,150','66,199,242','158,124,237'];
  ctx.save();ctx.clearRect(0,0,w,h);ctx.fillStyle=light?'#f4f3ef':'#020a10';ctx.fillRect(0,0,w,h);
  let iw=w,ih=h,ox=0,oy=0;
  if(art.complete&&art.naturalWidth){const scale=Math.min(w/art.naturalWidth,h/art.naturalHeight);iw=art.naturalWidth*scale;ih=art.naturalHeight*scale;ox=(w-iw)/2;oy=(h-ih)/2;ctx.globalAlpha=light?.14:.65;ctx.drawImage(art,ox,oy,iw,ih);ctx.globalAlpha=1;}
  const x=ox+iw*.426,y=oy+ih*.417,mirror=ox+iw*.596;
  const speed=time/1800,amplitude=ih*(.017+energy*.065),intensity=.12+energy*.42;
  ctx.globalCompositeOperation=light?'source-over':'screen';
  for(let band=0;band<colors.length;band++){
   const color=colors[band],g=ctx.createLinearGradient(0,y,x,y);g.addColorStop(0,'rgba('+color+',0)');g.addColorStop(.6,'rgba('+color+','+intensity+')');g.addColorStop(1,'rgba('+color+','+(.25+energy*.55)+')');ctx.strokeStyle=g;
   for(let line=0;line<3;line++){
    ctx.beginPath();for(let point=0;point<=60;point++){const u=point/60,px=x*u,taper=(1-u);const py=y+(band-2)*ih*.04*taper+Math.sin(u*8-speed*(1+energy)+band*.6+line*.15)*amplitude*taper+(line-1)*3*taper;if(point===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.lineWidth=(light?1.5:2.5)+energy*(line===1?14:4);ctx.stroke();
   }
  }
  const beam=ctx.createLinearGradient(x,y,mirror,y);beam.addColorStop(0,light?'rgba(155,92,75,.5)':'rgba(255,199,142,.9)');beam.addColorStop(.5,light?'rgba(72,128,155,.5)':'rgba(184,226,255,.9)');beam.addColorStop(1,light?'rgba(143,88,105,.6)':'rgba(255,191,135,.95)');ctx.strokeStyle=beam;ctx.lineWidth=1+energy*4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(mirror,y);ctx.stroke();
  for(const cx of [x,mirror]){const radius=12+energy*38,g=ctx.createRadialGradient(cx,y,0,cx,y,radius);g.addColorStop(0,light?'rgba(153,92,69,.25)':'rgba(255,221,177,.65)');g.addColorStop(1,'rgba(255,160,90,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,y,radius,0,Math.PI*2);ctx.fill();}
  if(time)for(let i=0;i<24;i++){const u=(i/24+time/15000*(.3+energy))%1;ctx.fillStyle='rgba('+colors[i%5]+','+(.06+high*.5)+')';ctx.beginPath();ctx.arc(x*u,y+Math.sin(i*3+u*6)*ih*.16*(1-u),.5+high*2,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 window.MusicAtmosphere={render};
 new MutationObserver(()=>window.RadioDeckBridge?.redraw()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
