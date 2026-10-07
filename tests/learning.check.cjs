const fs=require('fs'),vm=require('vm'),assert=require('assert'),{JSDOM}=require('jsdom');
(async()=>{
for(const lang of ['ru','en','uk','cs']){
 const path=lang==='ru'?'learning.html':`learning-${lang}.html`,html=fs.readFileSync(path,'utf8');
 const dom=new JSDOM(html,{url:'https://example.com/'+path,runScripts:'outside-only'}),w=dom.window,d=w.document;
 assert.equal(d.documentElement.lang,lang);assert.equal(d.querySelector('#learningLanguage').value,lang);
 assert(!d.body.textContent.includes('\\n'));assert.equal(d.querySelectorAll('.chapter').length,9);
 w.HTMLCanvasElement.prototype.getContext=()=>null;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.matchMedia=()=>({matches:true,addEventListener(){}});
 let attempts=0,fail=false,audios=[];
 w.Audio=class extends w.EventTarget{constructor(){super();audios.push(this)} play(){attempts++;return fail||this.crossOrigin?Promise.reject(new Error('CORS or unavailable')):Promise.resolve()} pause(){} load(){} removeAttribute(){}};
 for(const el of d.querySelectorAll('script[src]')){const code=fs.readFileSync(el.getAttribute('src'),'utf8');new vm.Script(code);w.eval(code);}
 assert.equal(d.querySelectorAll('#radioDock').length,1);assert.equal(d.querySelector('#radioStationSelect').options.length,21);
 d.querySelector('#radioBtn').click();assert(d.querySelector('#radioDock').classList.contains('open'));
 await w.startRadio();assert.equal(d.querySelector('#radioPlayBtn').getAttribute('aria-pressed'),'true');assert.equal(attempts,2);
 const slider=d.querySelector('#radioVolume');slider.value='.24';slider.dispatchEvent(new w.Event('input'));assert.equal(audios.at(-1).volume,.24);
 w.stopRadio();assert.equal(d.querySelector('#radioPlayBtn').getAttribute('aria-pressed'),'false');
 fail=true;await w.startRadio();assert.equal(d.querySelector('#radioDockStatus').dataset.kind,'error');assert.equal(d.querySelector('#radioPlayBtn').getAttribute('aria-pressed'),'false');
 d.querySelector('#themeTog').click();assert.equal(d.documentElement.dataset.theme,'light');
 if(lang==='uk')assert(d.querySelector('#radioDockStatus').textContent.includes('Потік'));
 if(lang==='cs')assert(d.querySelector('#radioDockStatus').textContent.includes('Stream není'));
 dom.window.close();console.log('PASS '+lang+': 8 modules, language selection, boot, radio CORS fallback, volume, pause, unavailable stream, theme');
}
})().catch(e=>{console.error(e);process.exitCode=1});

