/**
 * radio-visualizer.js — Multi-station radio player + audio-reactive 2026 canvas.
 * Public radio streams only. The visualizer falls back to generative mode
 * when a stream does not expose audio data through CORS.
 */

let audioElement = null;
let audioCtx = null;
let analyser = null;
let source = null;
let animationId = null;
let isPlaying = false;

const radioBtn = document.getElementById('radioBtn');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas?.getContext('2d');

const stations = [
  { id:'kiss', name:'Radio Kiss', url:'https://icecast4.play.cz/kiss128.mp3' },
  { id:'radio1', name:'Radio 1 CZ', url:'https://stream.rcs.revma.com/stk8hrvb938uv' },
  { id:'soma', name:'SomaFM Groove Salad', url:'https://ice2.somafm.com/groovesalad-128-mp3' }
];

const colorPalette = [
  '201, 136, 125',
  '160, 140, 200',
  '126, 184, 138',
  '217, 122, 122',
  '212, 162, 154'
];

let currentStationId = localStorage.getItem('tk_radio_station') || 'kiss';
let volume = Number(localStorage.getItem('tk_radio_volume') || 0.55);

function selectedStation() {
  return stations.find(s => s.id === currentStationId) || stations[0];
}

function radioErrorMessage() {
  try {
    return translations?.[currentLang]?.alert_radio_error || 'Radio stream is unavailable.';
  } catch (_) {
    return 'Radio stream is unavailable.';
  }
}

function buildControls() {
  if (!radioBtn || document.getElementById('radioStationSelect')) return;
  const parent = radioBtn.parentElement;
  const wrap = document.createElement('div');
  wrap.className = 'radio-suite';
  parent.insertBefore(wrap, radioBtn);
  wrap.appendChild(radioBtn);

  const stationSelect = document.createElement('select');
  stationSelect.id = 'radioStationSelect';
  stationSelect.className = 'radio-station-select';
  stationSelect.setAttribute('aria-label','Radio station');
  stations.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    stationSelect.appendChild(o);
  });
  stationSelect.value = currentStationId;
  wrap.appendChild(stationSelect);

  const volumeWrap = document.createElement('label');
  volumeWrap.className = 'radio-volume-wrap';
  volumeWrap.title = 'Volume';
  volumeWrap.innerHTML = '<span>VOL</span><input id="radioVolume" type="range" min="0" max="1" step="0.05">';
  wrap.appendChild(volumeWrap);
  const slider = volumeWrap.querySelector('input');
  slider.value = volume;

  stationSelect.addEventListener('change', async () => {
    currentStationId = stationSelect.value;
    localStorage.setItem('tk_radio_station', currentStationId);
    updateButtonLabel();
    if (isPlaying) await startRadio(true);
  });

  slider.addEventListener('input', () => {
    volume = Number(slider.value);
    localStorage.setItem('tk_radio_volume', String(volume));
    if (audioElement) audioElement.volume = volume;
  });

  updateButtonLabel();
}

function updateButtonLabel() {
  if (!radioBtn) return;
  const span = radioBtn.querySelector('span');
  if (span) span.textContent = isPlaying ? 'Pause' : 'Play';
  radioBtn.title = selectedStation().name;
}

function resizeBg() {
  if (!bgCanvas) return;
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

function createAudio(useCors = true) {
  if (audioElement) {
    try { audioElement.pause(); } catch (_) {}
  }
  teardownAudioContext();
  audioElement = new Audio();
  if (useCors) audioElement.crossOrigin = 'anonymous';
  audioElement.preload = 'none';
  audioElement.src = selectedStation().url;
  audioElement.volume = volume;
  return audioElement;
}

function setupAudioContext() {
  if (!audioElement || audioCtx || !audioElement.crossOrigin) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {
    console.warn('[radio] analyser unavailable; using generative visualization', e);
    analyser = null;
  }
}

async function startRadio(forceReload = false) {
  if (!radioBtn) return;
  const station = selectedStation();
  if (!audioElement || forceReload || audioElement.src !== station.url) createAudio(true);
  try {
    await audioElement.play();
    isPlaying = true;
    setupAudioContext();
  } catch (e) {
    console.warn('[radio] CORS playback failed; retrying without analyser', e);
    createAudio(false);
    try {
      await audioElement.play();
      isPlaying = true;
      analyser = null;
    } catch (err) {
      console.error('[radio] stream unavailable', err);
      isPlaying = false;
      alert(radioErrorMessage());
      updateButtonLabel();
      return;
    }
  }

  radioBtn.classList.add('on');
  document.body.classList.add('radio-on');
  updateButtonLabel();
  animateBackground();
}

function stopRadio() {
  if (audioElement) audioElement.pause();
  isPlaying = false;
  radioBtn?.classList.remove('on');
  document.body.classList.remove('radio-on');
  if (animationId) cancelAnimationFrame(animationId);
  updateButtonLabel();
  drawIdleBg();
}

radioBtn?.addEventListener('click', async () => {
  if (isPlaying) stopRadio();
  else await startRadio();
});

function animateBackground() {
  if (!bgCanvas || !bgCtx) return;
  if (animationId) cancelAnimationFrame(animationId);
  const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  const wave = analyser ? new Uint8Array(analyser.fftSize) : null;

  function draw() {
    const t = performance.now();
    const w = window.innerWidth;
    const h = window.innerHeight;
    bgCtx.clearRect(0,0,w,h);

    let bass = 0, mid = 0;
    if (analyser) {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);
      for (let i=0;i<16;i++) bass += freq[i] || 0;
      for (let i=24;i<70;i++) mid += freq[i] || 0;
      bass = bass / 16 / 255;
      mid = mid / 46 / 255;
    } else {
      bass = 0.34 + Math.sin(t/420)*0.13;
      mid = 0.28 + Math.cos(t/630)*0.10;
    }

    // soft technical grid
    bgCtx.save();
    bgCtx.globalAlpha = 0.10 + mid*0.05;
    bgCtx.strokeStyle = 'rgba(160,140,200,.35)';
    bgCtx.lineWidth = 0.5;
    const step = 44;
    for (let x=(t/70)%step;x<w;x+=step) {
      bgCtx.beginPath(); bgCtx.moveTo(x,0); bgCtx.lineTo(x,h); bgCtx.stroke();
    }
    for (let y=(t/95)%step;y<h;y+=step) {
      bgCtx.beginPath(); bgCtx.moveTo(0,y); bgCtx.lineTo(w,y); bgCtx.stroke();
    }
    bgCtx.restore();

    const cx = w/2, cy = h/2;

    // reactive rings
    for (let i=0;i<8;i++) {
      const r = 70 + i*72 + bass*120 + Math.sin(t/700+i)*8;
      const color = colorPalette[i % colorPalette.length];
      bgCtx.beginPath();
      bgCtx.arc(cx,cy,r,0,Math.PI*2);
      bgCtx.strokeStyle = 'rgba(' + color + ',' + Math.max(0.025,0.13+bass*0.25-i*0.013) + ')';
      bgCtx.lineWidth = 0.7 + bass*1.8;
      bgCtx.stroke();
    }

    // waveform horizon
    if (wave) {
      bgCtx.beginPath();
      for (let i=0;i<wave.length;i++) {
        const x = i/(wave.length-1)*w;
        const y = h*0.72 + (wave[i]-128)/128*(26+bass*30);
        if (i===0) bgCtx.moveTo(x,y); else bgCtx.lineTo(x,y);
      }
      bgCtx.strokeStyle = 'rgba(212,162,154,' + (0.16+bass*0.28) + ')';
      bgCtx.lineWidth = 1;
      bgCtx.stroke();
    }

    // orbiting particles
    for (let i=0;i<36;i++) {
      const a = t/2300 + i*0.52;
      const radius = 80 + (i%9)*52 + mid*70;
      const x = cx + Math.cos(a*(1+(i%3)*0.07))*radius;
      const y = cy + Math.sin(a*(0.82+(i%5)*0.04))*radius*0.56;
      const size = 0.8 + bass*3 + (i%4)*0.25;
      const color = colorPalette[i%colorPalette.length];
      bgCtx.beginPath(); bgCtx.arc(x,y,size,0,Math.PI*2);
      bgCtx.fillStyle = 'rgba(' + color + ',' + (0.18+bass*0.42) + ')';
      bgCtx.fill();
    }

    animationId = requestAnimationFrame(draw);
  }
  draw();
}

function drawIdleBg() {
  if (!bgCanvas || !bgCtx) return;
  bgCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
}

buildControls();
drawIdleBg();
