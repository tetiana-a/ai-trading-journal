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
let activeUrl = '';

const radioBtn = document.getElementById('radioBtn');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas?.getContext('2d');

const stations = [
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

let currentStationId = localStorage.getItem('tk_radio_station') || 'soma';
if (!stations.some(s => s.id === currentStationId)) currentStationId = 'soma';

let volume = Number(localStorage.getItem('tk_radio_volume') || 0.52);
if (!Number.isFinite(volume)) volume = 0.52;

let dockOpen = localStorage.getItem('tk_radio_dock_open') === '1';
let visualizerEnabled = localStorage.getItem('tk_radio_visualizer') !== '0';
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
    play.setAttribute('aria-label', isPlaying ? 'Pause radio' : 'Play radio');
    play.innerHTML = isPlaying ? '<span class="pause-glyph">Ⅱ</span>' : '<span class="play-glyph">▶</span>';
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
      <span id="radioDockStatus">Ready</span>
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
    localStorage.setItem('tk_radio_dock_open', dockOpen ? '1' : '0');
    updateDock();
  });

  $('radioDockClose').addEventListener('click', () => {
    dockOpen = false;
    localStorage.setItem('tk_radio_dock_open', '0');
    updateDock();
  });

  $('radioPlayBtn').addEventListener('click', async () => {
    if (isPlaying) stopRadio();
    else await startRadio();
  });

  $('radioPrevBtn').addEventListener('click', () => changeStation(-1));
  $('radioNextBtn').addEventListener('click', () => changeStation(1));

  select.addEventListener('change', async () => {
    currentStationId = select.value;
    localStorage.setItem('tk_radio_station', currentStationId);
    setDockStatus('Tuning…');
    updateDock();
    if (isPlaying) await startRadio(true);
  });

  $('radioVolume').addEventListener('input', e => {
    volume = Number(e.target.value);
    localStorage.setItem('tk_radio_volume', String(volume));
    if (audioElement) audioElement.volume = volume;
    $('radioVolumeValue').textContent = Math.round(volume * 100) + '%';
  });

  $('radioVizToggle').addEventListener('click', () => {
    visualizerEnabled = !visualizerEnabled;
    localStorage.setItem('tk_radio_visualizer', visualizerEnabled ? '1' : '0');
    updateDock();
    if (isPlaying && visualizerEnabled) animateBackground();
    else if (!visualizerEnabled) drawIdleBg();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dockOpen) {
      dockOpen = false;
      localStorage.setItem('tk_radio_dock_open', '0');
      updateDock();
    }
  });

  updateDock();
}

async function changeStation(direction) {
  const idx = stations.findIndex(s => s.id === currentStationId);
  const next = (idx + direction + stations.length) % stations.length;
  currentStationId = stations[next].id;
  localStorage.setItem('tk_radio_station', currentStationId);
  setDockStatus('Tuning…');
  updateDock();
  if (isPlaying) await startRadio(true);
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

function teardownAudioContext() {
  analyser = null;
  source = null;
  if (audioCtx) {
    try { audioCtx.close(); } catch (_) {}
  }
  audioCtx = null;
}

function createAudio(url, useCors = true) {
  if (audioElement) {
    try { audioElement.pause(); } catch (_) {}
  }
  teardownAudioContext();

  audioElement = new Audio();
  if (useCors) audioElement.crossOrigin = 'anonymous';
  audioElement.preload = 'none';
  audioElement.src = url;
  activeUrl = url;
  audioElement.volume = volume;

  audioElement.addEventListener('waiting', () => setDockStatus('Buffering…'));
  audioElement.addEventListener('playing', () => setDockStatus('Live', 'live'));
  audioElement.addEventListener('stalled', () => setDockStatus('Network delay'));
  audioElement.addEventListener('error', () => setDockStatus('Stream unavailable', 'error'));

  return audioElement;
}

function setupAudioContext() {
  if (!audioElement || audioCtx || !audioElement.crossOrigin) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.84;

    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {
    console.warn('[radio] WebAudio analyser unavailable, keeping playback only', e);
    analyser = null;
  }
}

async function tryPlay(url, useCors) {
  createAudio(url, useCors);
  await audioElement.play();
  isPlaying = true;
  if (useCors) setupAudioContext();
  return true;
}

async function startRadio(forceReload = false) {
  const station = selectedStation();
  setDockStatus('Connecting…');

  if (!forceReload && audioElement && activeUrl && isPlaying) {
    try {
      await audioElement.play();
      setDockStatus('Live', 'live');
      updateDock();
      return;
    } catch (_) {}
  }

  const candidates = [station.url, station.alt].filter(Boolean);
  let lastError = null;

  for (const url of candidates) {
    try {
      await tryPlay(url, true);
      break;
    } catch (corsError) {
      lastError = corsError;
      try {
        await tryPlay(url, false);
        analyser = null;
        break;
      } catch (playError) {
        lastError = playError;
        isPlaying = false;
      }
    }
  }

  if (!isPlaying) {
    console.error('[radio] all stream attempts failed', lastError);
    setDockStatus('Unavailable — choose another station', 'error');
    updateDock();
    return;
  }

  setDockStatus(analyser ? 'Live · audio-reactive' : 'Live · generative visual', 'live');
  updateDock();
  if (visualizerEnabled) animateBackground();
}

function stopRadio() {
  if (audioElement) {
    try { audioElement.pause(); } catch (_) {}
  }
  isPlaying = false;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  setDockStatus('Paused');
  updateDock();
  drawIdleBg();
}

function animateBackground() {
  if (!bgCanvas || !bgCtx || !visualizerEnabled) return;
  if (animationId) cancelAnimationFrame(animationId);

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
