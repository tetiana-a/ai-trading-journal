/**
 * radio-visualizer.js — Professional multi-station audio deck + reactive canvas.
 *
 * Goals:
 * - keep the trading workspace calm and uncluttered;
 * - use curated public radio streams only;
 * - preserve playback even when a station blocks WebAudio/CORS analysis;
 * - keep all settings local to the browser.
 */

let audioElement = null;
let audioCtx = null;
let analyser = null;
let source = null;
let animationId = null;
let isPlaying = false;
let isLoading = false, requestId = 0, cancelAttempt = null, bufferTimer = null;

const radioBtn = document.getElementById('radioBtn');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas?.getContext('2d');

const stations = [
  {"id":"indiepop","name":"Indie Pop Rocks!","country":"US","genre":"Indie · Rock","url":"https://ice6.somafm.com/indiepop-128-mp3","alt":"https://ice2.somafm.com/indiepop-128-mp3"},
  {"id":"u80s","name":"Underground 80s","country":"US","genre":"80s · New Wave","url":"https://ice6.somafm.com/u80s-256-mp3","alt":"https://ice2.somafm.com/u80s-256-mp3"},
  {"id":"folkfwd","name":"Folk Forward","country":"US","genre":"Folk","url":"https://ice6.somafm.com/folkfwd-128-mp3","alt":"https://ice2.somafm.com/folkfwd-128-mp3"},
  {"id":"seventies","name":"Left Coast 70s","country":"US","genre":"70s · Rock","url":"https://ice6.somafm.com/seventies-320-mp3","alt":"https://ice2.somafm.com/seventies-320-mp3"},
  {"id":"spacestation","name":"Space Station Soma","country":"US","genre":"Electronic · Space","url":"https://ice6.somafm.com/spacestation-320-mp3","alt":"https://ice2.somafm.com/spacestation-320-mp3"},
  {"id":"deepspaceone","name":"Deep Space One","country":"US","genre":"Ambient · Focus","url":"https://ice6.somafm.com/deepspaceone-128-mp3","alt":"https://ice2.somafm.com/deepspaceone-128-mp3"},
  {"id":"defcon","name":"DEF CON Radio","country":"US","genre":"Electronic","url":"https://ice6.somafm.com/defcon-256-mp3","alt":"https://ice2.somafm.com/defcon-256-mp3"},
  {"id":"cliqhop","name":"cliqhop idm","country":"US","genre":"IDM · Electronic","url":"https://ice6.somafm.com/cliqhop-256-mp3","alt":"https://ice2.somafm.com/cliqhop-256-mp3"},
  {"id":"bossa","name":"Bossa Beyond","country":"US","genre":"Bossa Nova · World","url":"https://ice6.somafm.com/bossa-256-mp3","alt":"https://ice2.somafm.com/bossa-256-mp3"},
  {"id":"poptron","name":"PopTron","country":"US","genre":"Electropop","url":"https://ice6.somafm.com/poptron-128-mp3","alt":"https://ice2.somafm.com/poptron-128-mp3"},
 {id:'jazz',name:'Sonic Universe',country:'US',genre:'Jazz',url:'https://ice2.somafm.com/sonicuniverse-128-mp3',alt:'https://ice5.somafm.com/sonicuniverse-128-mp3'},
 {id:'lush',name:'Lush',country:'US',genre:'Electronic',url:'https://ice2.somafm.com/lush-128-mp3',alt:'https://ice5.somafm.com/lush-128-mp3'},
 {id:'beat',name:'Beat Blender',country:'US',genre:'House',url:'https://ice2.somafm.com/beatblender-128-mp3',alt:'https://ice5.somafm.com/beatblender-128-mp3'},
  {
    id:'kiss',
    name:'Radio Kiss',
    country:'CZ',
    genre:'Pop · Dance',
    url:'https://icecast4.play.cz/kiss128.mp3'
  },
  {
    id:'radio1',
    name:'Radio 1 CZ',
    country:'CZ',
    genre:'Alternative · Electronic',
    url:'https://stream.rcs.revma.com/stk8hrvb938uv'
  },
  {
    id:'soma',
    name:'SomaFM Groove Salad',
    country:'US',
    genre:'Chill · Downtempo',
    url:'https://ice2.somafm.com/groovesalad-128-mp3',
    alt:'https://ice5.somafm.com/groovesalad-128-mp3'
  },
  {
    id:'drone',
    name:'SomaFM Drone Zone',
    country:'US',
    genre:'Ambient · Focus',
    url:'https://ice2.somafm.com/dronezone-128-mp3',
    alt:'https://ice5.somafm.com/dronezone-128-mp3'
  },
  {
    id:'agent',
    name:'SomaFM Secret Agent',
    country:'US',
    genre:'Cinematic · Lounge',
    url:'https://ice2.somafm.com/secretagent-128-mp3',
    alt:'https://ice5.somafm.com/secretagent-128-mp3'
  },
  {
    id:'fip',
    name:'FIP',
    country:'FR',
    genre:'Eclectic · Jazz · World',
    url:'https://icecast.radiofrance.fr/fip-midfi.mp3?id=openapi'
  },
  {
    id:'kexp',
    name:'KEXP',
    country:'US',
    genre:'Indie · Alternative',
    url:'https://kexp.streamguys1.com/kexp160.aac',
    alt:'https://kexp.streamguys1.com/kexp64.aac'
  },
  {
    id:'swissjazz',
    name:'Radio Swiss Jazz',
    country:'CH',
    genre:'Jazz · Soul · Blues',
    url:'https://stream.srg-ssr.ch/srgssr/rsj/mp3/128'
  }
];

const colorPalette = [
  '201,136,125',
  '160,140,200',
  '126,184,138',
  '217,122,122',
  '212,162,154'
];

function readPreference(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } }
function savePreference(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
let currentStationId = readPreference('tk_radio_station','soma');
if (!stations.some(s => s.id === currentStationId)) currentStationId = 'soma';

let volume = Number(readPreference('tk_radio_volume','0.52'));
if (!Number.isFinite(volume)) volume = 0.52;
volume = Math.min(1,Math.max(0,volume));

let dockOpen = readPreference('tk_radio_dock_open','0') === '1';
let visualizerEnabled = readPreference('tk_radio_visualizer','1') !== '0';
let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

function $(id) { return document.getElementById(id); }

function selectedStation() {
  return stations.find(s => s.id === currentStationId) || stations[0];
}

function setDockStatus(text, kind = '') {
  const el = $('radioDockStatus');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

function updateDock() {
  const station = selectedStation();
  const dock = $('radioDock');
  const select = $('radioStationSelect');
  const play = $('radioPlayBtn');
  const navLabel = radioBtn?.querySelector('.radio-nav-label');
  const navState = radioBtn?.querySelector('.radio-nav-state');

  if (dock) dock.classList.toggle('open', dockOpen);
  if (select && select.value !== currentStationId) select.value = currentStationId;

  const name = $('radioStationName');
  const meta = $('radioStationMeta');
  if (name) name.textContent = station.name;
  if (meta) meta.textContent = station.country + ' · ' + station.genre;

  if (play) {
    play.classList.toggle('playing', isPlaying);
    play.setAttribute('aria-label', isLoading ? 'Cancel connection' : isPlaying ? 'Pause radio' : 'Play radio');
    play.setAttribute('aria-pressed',String(isPlaying));
    play.innerHTML = isLoading ? '<span>×</span>' : isPlaying ? '<span class="pause-glyph">Ⅱ</span>' : '<span class="play-glyph">▶</span>';
  }

  if (radioBtn) {
    radioBtn.classList.toggle('on', isPlaying);
    radioBtn.setAttribute('aria-expanded', String(dockOpen));
    radioBtn.title = isPlaying ? ('Playing ' + station.name) : 'Open Audio Deck';
  }

  if (navLabel) navLabel.textContent = station.name;
  if (navState) navState.textContent = isPlaying ? 'LIVE' : 'AUDIO';

  document.body.classList.toggle('radio-on', isPlaying && visualizerEnabled);
  document.body.classList.toggle('radio-dock-open', dockOpen);

  const viz = $('radioVizToggle');
  if (viz) {
    viz.classList.toggle('active', visualizerEnabled);
    viz.setAttribute('aria-pressed',String(visualizerEnabled));
    viz.textContent = visualizerEnabled ? 'Visualizer on' : 'Visualizer off';
  }

  const slider = $('radioVolume');
  if (slider && Number(slider.value) !== volume) slider.value = String(volume);
}

function buildControls() {
  if (!radioBtn || $('radioDock')) return;

  radioBtn.classList.add('radio-launcher');
  radioBtn.innerHTML = [
    '<span class="radio-nav-icon" aria-hidden="true">♪</span>',
    '<span class="radio-nav-label">Audio</span>',
    '<span class="radio-nav-state">AUDIO</span>'
  ].join('');

  const dock = document.createElement('aside');
  dock.id = 'radioDock';
  dock.className = 'radio-dock';
  dock.setAttribute('aria-label', 'Audio Deck');
  radioBtn.setAttribute('aria-controls','radioDock');
  dock.innerHTML = `
    <div class="radio-dock-top">
      <div class="radio-live-mark"><span></span> AUDIO DECK</div>
      <button class="radio-close" id="radioDockClose" type="button" aria-label="Close audio deck">×</button>
    </div>

    <div class="radio-now">
      <div class="radio-now-copy">
        <div class="radio-now-label">Now tuned to</div>
        <strong id="radioStationName">—</strong>
        <span id="radioStationMeta">—</span>
      </div>
      <div class="radio-eq" id="radioEq" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
    </div>

    <div class="radio-main-controls">
      <button class="radio-skip" id="radioPrevBtn" type="button" aria-label="Previous station">‹</button>
      <button class="radio-play" id="radioPlayBtn" type="button" aria-label="Play radio"><span class="play-glyph">▶</span></button>
      <button class="radio-skip" id="radioNextBtn" type="button" aria-label="Next station">›</button>
    </div>

    <div class="radio-tuning">
      <label for="radioStationSelect">Station</label>
      <select id="radioStationSelect" class="radio-station-select"></select>
    </div>

    <div class="radio-volume-row">
      <span class="radio-volume-icon" aria-hidden="true">VOL</span>
      <input id="radioVolume" type="range" min="0" max="1" step="0.02" aria-label="Radio volume">
      <span id="radioVolumeValue">52%</span>
    </div>

    <div class="radio-dock-footer">
      <button class="radio-mode" id="radioVizToggle" type="button">Visualizer on</button>
      <span id="radioDockStatus" role="status" aria-live="polite">Ready</span>
    </div>
  `;

  document.body.appendChild(dock);

  const select = $('radioStationSelect');
  stations.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.country + ' · ' + s.name + ' — ' + s.genre;
    select.appendChild(option);
  });
  select.value = currentStationId;

  $('radioVolume').value = String(volume);
  $('radioVolumeValue').textContent = Math.round(volume * 100) + '%';

  radioBtn.addEventListener('click', () => {
    dockOpen = !dockOpen;
    savePreference('tk_radio_dock_open', dockOpen ? '1' : '0');
    updateDock();
  });

  $('radioDockClose').addEventListener('click', () => {
    dockOpen = false;
    savePreference('tk_radio_dock_open', '0');
    updateDock();
  });

  $('radioPlayBtn').addEventListener('click', async () => {
    if (isPlaying || isLoading) stopRadio();
    else await startRadio();
  });

  $('radioPrevBtn').addEventListener('click', () => changeStation(-1));
  $('radioNextBtn').addEventListener('click', () => changeStation(1));

  select.addEventListener('change', async () => {
    const selectedId = select.value;
    const resume = isPlaying || isLoading; stopRadio();
    currentStationId = selectedId;
    savePreference('tk_radio_station', currentStationId);
    setDockStatus('Tuning…');
    updateDock();
    if (resume) await startRadio(); else setDockStatus('Ready');
  });

  $('radioVolume').addEventListener('input', e => {
    volume = Number(e.target.value);
    savePreference('tk_radio_volume', String(volume));
    if (audioElement) audioElement.volume = volume;
    $('radioVolumeValue').textContent = Math.round(volume * 100) + '%';
  });

  $('radioVizToggle').addEventListener('click', () => {
    visualizerEnabled = !visualizerEnabled;
    savePreference('tk_radio_visualizer', visualizerEnabled ? '1' : '0');
    updateDock();
    if (isPlaying && visualizerEnabled) animateBackground();
    else if (!visualizerEnabled) drawIdleBg();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dockOpen) {
      dockOpen = false;
      savePreference('tk_radio_dock_open', '0');
      updateDock();
    }
  });

  updateDock();
}

async function changeStation(direction) {
  const idx = stations.findIndex(s => s.id === currentStationId);
  const next = (idx + direction + stations.length) % stations.length;
  const resume = isPlaying || isLoading; stopRadio();
  currentStationId = stations[next].id;
  savePreference('tk_radio_station', currentStationId);
  setDockStatus('Tuning…');
  updateDock();
  if (resume) await startRadio(); else setDockStatus('Ready');
}

function resizeBg() {
  if (!bgCanvas || !bgCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  bgCanvas.width = Math.floor(window.innerWidth * dpr);
  bgCanvas.height = Math.floor(window.innerHeight * dpr);
  bgCanvas.style.width = window.innerWidth + 'px';
  bgCanvas.style.height = window.innerHeight + 'px';
  bgCtx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resizeBg);
resizeBg();

function english() { return typeof currentLang !== 'undefined' ? currentLang === 'en' : document.documentElement.lang === 'en'; }
function message(en, ru) { return english() ? en : ru; }
function teardownAudioContext() {
  analyser = null; source = null;
  if (audioCtx) audioCtx.close().catch(() => {}); audioCtx = null;
}
function releaseAudio() {
  if (cancelAttempt) { cancelAttempt(); cancelAttempt = null; }
  if (audioElement) { audioElement.pause(); audioElement.removeAttribute('src'); audioElement.load(); audioElement = null; }
  teardownAudioContext();
}
function createAudio(useCors, url = selectedStation().url) {
  releaseAudio(); const audio = new Audio();
  if (useCors) audio.crossOrigin = 'anonymous';
  audio.preload = 'none'; audio.src = url; audio.volume = volume; audioElement = audio;
  return audio;
}
function setupAudioContext() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return;
    audioCtx = new Context(); analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .82;
    source = audioCtx.createMediaElementSource(audioElement); source.connect(analyser); analyser.connect(audioCtx.destination);
    audioCtx.resume().catch(() => {});
  } catch (_) {
    // A connected source must still reach the destination if analysis fails.
    if (source && audioCtx) { try { source.disconnect(); source.connect(audioCtx.destination); } catch (_) {} }
    analyser = null;
  }
}
function playAttempt(audio) {
  return new Promise((resolve,reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return; settled = true; clearTimeout(timer); audio.removeEventListener('error',failed);
      cancelAttempt = null; error ? reject(error) : resolve();
    };
    const failed = () => finish(new Error('Stream unavailable'));
    const timer = setTimeout(() => finish(new Error('Connection timed out')),12000);
    cancelAttempt = () => finish(new DOMException('Cancelled','AbortError'));
    audio.addEventListener('error',failed);
    Promise.resolve(audio.play()).then(() => finish(),finish);
  });
}
async function startRadio(recovery = false) {
  if (!radioBtn) return;
  stopRadio(); const token = requestId; isLoading = true; updateDock();
  setDockStatus((recovery ? message('Reconnecting · ','Восстановление · ') : message('Connecting · ','Подключение · '))+selectedStation().name,'loading');
  let direct = false;
  try {
    let audio, lastError;
    const station = selectedStation();
    const candidates = (recovery ? [station.alt,station.url] : [station.url,station.alt]).filter(Boolean);
    for (const url of candidates) {
      try {
        direct = false; audio = createAudio(true,url);
        try { await playAttempt(audio); }
        catch (error) {
          if (token !== requestId) return;
          if (error.name === 'NotAllowedError' || error.name === 'AbortError') throw error;
          direct = true; audio = createAudio(false,url); await playAttempt(audio);
        }
        lastError = null; break;
      } catch (error) {
        if (token !== requestId) return;
        lastError = error;
        if (error.name === 'NotAllowedError' || error.name === 'AbortError') break;
      }
    }
    if (lastError) throw lastError;
    if (token !== requestId) return;
    isLoading = false; isPlaying = true;
    if (!direct) setupAudioContext();
    const recover = () => {
      if (token !== requestId) return;
      // One bounded recovery, using only this station's official candidates.
      if (!recovery) { startRadio(true); return; }
      stopRadio();
      setDockStatus(message('Station disconnected. Press Play to retry.','Связь со станцией потеряна. Нажмите Play для повтора.'),'error');
    };
    audio.addEventListener('error', recover);
    audio.addEventListener('ended', recover);
    const buffering = () => {
      if (token !== requestId || !isPlaying) return;
      setDockStatus(message('Buffering…','Буферизация…'),'loading');
      if (bufferTimer === null) bufferTimer = setTimeout(recover,12000);
    };
    audio.addEventListener('waiting', buffering);
    audio.addEventListener('stalled', buffering);
    audio.addEventListener('playing', () => {
      if (token !== requestId) return;
      clearTimeout(bufferTimer); bufferTimer = null; playbackStatus(direct);
    });
    playbackStatus(direct); updateDock(); animateBackground();
  } catch (error) {
    if (token !== requestId) return; stopRadio();
    setDockStatus(error.name === 'NotAllowedError' ? message('Press Play to allow audio.','Нажмите Play для воспроизведения.') : message('Stream unavailable. Try another station.','Поток недоступен. Выберите другую станцию.'),'error');
  }
}
function playbackStatus(direct) {
  setDockStatus(message('Live · ','В эфире · ')+selectedStation().name+(direct ? message(' · Ambient canvas',' · Фоновая анимация') : ''),'live');
}
function stopRadio() {
  clearTimeout(bufferTimer); bufferTimer = null;
  requestId++; isPlaying = false; isLoading = false; releaseAudio();
  if (animationId) cancelAnimationFrame(animationId); animationId = null;
  updateDock(); drawIdleBg(); setDockStatus(message('Paused · ','Пауза · ')+selectedStation().name);
}

window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e => { reducedMotion = e.matches; if (isPlaying) animateBackground(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(animationId); animationId = null; } else if (isPlaying) animateBackground(); });
window.addEventListener('pagehide',stopRadio);

function animateBackground() {
  if (!bgCanvas || !bgCtx || !visualizerEnabled) return;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  if (reducedMotion || document.hidden) { drawIdleBg(); return; }

  const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  const wave = analyser ? new Uint8Array(analyser.fftSize) : null;

  function draw() {
    if (!isPlaying || !visualizerEnabled) return;

    const t = performance.now();
    const w = window.innerWidth;
    const h = window.innerHeight;
    bgCtx.clearRect(0,0,w,h);

    let bass = 0, mid = 0, high = 0;

    if (analyser) {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);

      for (let i=0;i<18;i++) bass += freq[i] || 0;
      for (let i=22;i<72;i++) mid += freq[i] || 0;
      for (let i=80;i<150;i++) high += freq[i] || 0;

      bass = bass / 18 / 255;
      mid = mid / 50 / 255;
      high = high / 70 / 255;
    } else {
      bass = 0.28 + Math.sin(t/460)*0.10;
      mid = 0.22 + Math.cos(t/690)*0.08;
      high = 0.18 + Math.sin(t/920)*0.06;
    }

    if (reducedMotion) {
      bass *= 0.45;
      mid *= 0.45;
      high *= 0.45;
    }

    // Fintech grid
    bgCtx.save();
    bgCtx.globalAlpha = 0.07 + mid*0.06;
    bgCtx.strokeStyle = 'rgba(160,140,200,.38)';
    bgCtx.lineWidth = 0.5;

    const step = 48;
    const xOffset = reducedMotion ? 0 : (t/90)%step;
    const yOffset = reducedMotion ? 0 : (t/120)%step;

    for (let x=xOffset;x<w;x+=step) {
      bgCtx.beginPath();
      bgCtx.moveTo(x,0);
      bgCtx.lineTo(x,h);
      bgCtx.stroke();
    }
    for (let y=yOffset;y<h;y+=step) {
      bgCtx.beginPath();
      bgCtx.moveTo(0,y);
      bgCtx.lineTo(w,y);
      bgCtx.stroke();
    }
    bgCtx.restore();

    const cx = w*0.70;
    const cy = h*0.43;

    // Precision orbital rings
    for (let i=0;i<7;i++) {
      const r = 62 + i*62 + bass*105 + Math.sin(t/760+i)*5;
      const color = colorPalette[i % colorPalette.length];
      bgCtx.beginPath();
      bgCtx.arc(cx,cy,r,0,Math.PI*2);
      bgCtx.strokeStyle = 'rgba(' + color + ',' + Math.max(0.025,0.10+bass*0.22-i*0.011) + ')';
      bgCtx.lineWidth = 0.55 + bass*1.45;
      bgCtx.stroke();
    }

    // Audio horizon
    bgCtx.beginPath();
    const samples = wave ? wave.length : 180;
    for (let i=0;i<samples;i++) {
      const x = i/(samples-1)*w;
      const signal = wave ? (wave[i]-128)/128 : Math.sin(i*0.18+t/540)*0.22 + Math.sin(i*0.055+t/870)*0.12;
      const y = h*0.76 + signal*(22+bass*36);
      if (i===0) bgCtx.moveTo(x,y); else bgCtx.lineTo(x,y);
    }
    bgCtx.strokeStyle = 'rgba(212,162,154,' + (0.12+bass*0.30) + ')';
    bgCtx.lineWidth = 1;
    bgCtx.stroke();

    // Subtle market-tape bars
    const barCount = Math.min(42, Math.floor(w/32));
    for (let i=0;i<barCount;i++) {
      const x = i/(barCount-1)*w;
      const level = analyser && freq ? (freq[(i*3)%freq.length] || 0)/255 : (0.2 + Math.abs(Math.sin(i*0.7+t/700))*0.18);
      const barH = 6 + level*(22 + high*35);
      bgCtx.fillStyle = 'rgba(126,184,138,' + (0.03 + level*0.10) + ')';
      bgCtx.fillRect(x,h*0.88-barH,1,barH);
    }

    // Orbiting particles
    const particles = reducedMotion ? 16 : 34;
    for (let i=0;i<particles;i++) {
      const a = t/2600 + i*0.55;
      const radius = 65 + (i%9)*47 + mid*65;
      const x = cx + Math.cos(a*(1+(i%3)*0.06))*radius;
      const y = cy + Math.sin(a*(0.84+(i%5)*0.035))*radius*0.55;
      const size = 0.65 + bass*2.7 + (i%4)*0.18;
      const color = colorPalette[i%colorPalette.length];

      bgCtx.beginPath();
      bgCtx.arc(x,y,size,0,Math.PI*2);
      bgCtx.fillStyle = 'rgba(' + color + ',' + (0.12+bass*0.36) + ')';
      bgCtx.fill();
    }

    // Sync the mini equalizer to the same energy.
    const eqBars = document.querySelectorAll('#radioEq i');
    eqBars.forEach((bar, i) => {
      const sampled = analyser && freq ? (freq[(i*7)%freq.length] || 0)/255 : (0.3 + Math.abs(Math.sin(t/370+i))*0.45);
      bar.style.transform = 'scaleY(' + Math.max(.18, sampled) + ')';
      bar.style.opacity = String(.35 + sampled*.65);
    });

    animationId = requestAnimationFrame(draw);
  }

  draw();
}

function drawIdleBg() {
  if (!bgCanvas || !bgCtx) return;
  bgCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
  document.querySelectorAll('#radioEq i').forEach((bar, i) => {
    bar.style.transform = 'scaleY(' + (0.18 + (i%3)*0.05) + ')';
    bar.style.opacity = '.28';
  });
}

buildControls();
drawIdleBg();
