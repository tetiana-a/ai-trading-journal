/**
 * radio-visualizer.js — Background audio visualizer with Web Audio API.
 * Soft feminine color palette.
 */

let audioElement = null;
let audioCtx = null;
let analyser = null;
let source = null;
const radioBtn = document.getElementById('radioBtn');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
let animationId = null;
const streamUrl = 'https://icecast4.play.cz/kiss128.mp3';

const colorPalette = [
  '201, 136, 125',  // Rose gold (accent)
  '160, 140, 200',  // Lavender
  '126, 184, 138',  // Soft green
  '217, 122, 122',  // Dusty rose
  '212, 162, 154'   // Blush
];

function resizeBg() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBg);
resizeBg();

radioBtn.addEventListener('click', async () => {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.crossOrigin = 'anonymous';
    audioElement.src = streamUrl;
    audioElement.loop = true;
  }

  if (audioElement.paused) {
    try {
      await audioElement.play();
      radioBtn.classList.add('on');
      document.body.classList.add('radio-on');
      setupAudioContext();
      animateBackground();
    } catch (e) {
      console.warn('[radio] CORS block. Retrying without audio analysis...', e);
      if (audioElement.crossOrigin) {
        audioElement.pause();
        audioElement.crossOrigin = null;
        audioElement.src = streamUrl;
        try {
          await audioElement.play();
          radioBtn.classList.add('on');
          document.body.classList.add('radio-on');
          animateBackground();
        } catch (err) {
          console.error('[radio] Stream unavailable', err);
          alert(translations[currentLang].alert_radio_error);
        }
      } else {
        alert(translations[currentLang].alert_radio_error);
      }
    }
  } else {
    audioElement.pause();
    radioBtn.classList.remove('on');
    document.body.classList.remove('radio-on');
    cancelAnimationFrame(animationId);
    drawIdleBg();
  }
});

function setupAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {
    console.warn('[radio] Web Audio API blocked. Using generative mode.', e);
    analyser = null;
  }
}

function animateBackground() {
  const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

  function draw() {
    const t = performance.now();
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    let bassEnergy = 0;

    if (analyser) {
      analyser.getByteFrequencyData(dataArray);
      for (let i = 0; i < 10; i++) bassEnergy += dataArray[i];
      bassEnergy = bassEnergy / 10 / 255;
    } else {
      bassEnergy = (Math.sin(t / 400) * 0.3 + 0.4) + Math.random() * 0.1;
    }

    const cx = bgCanvas.width / 2;
    const cy = bgCanvas.height / 2;

    // Soft concentric rings
    for (let i = 0; i < 6; i++) {
      const radius = Math.max(1, 80 + i * 90 + bassEnergy * 100);
      const alpha = Math.max(0, 0.06 + bassEnergy * 0.3 - i * 0.04);
      const color = colorPalette[i % colorPalette.length];
      bgCtx.beginPath();
      bgCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      bgCtx.strokeStyle = `rgba(${color}, ${alpha})`;
      bgCtx.lineWidth = 0.8 + bassEnergy * 2;
      bgCtx.stroke();
    }

    // Soft floating particles
    for (let i = 0; i < 24; i++) {
      const x = (Math.sin(t / 1200 + i) * 0.5 + 0.5) * bgCanvas.width;
      const y = (Math.cos(t / 1400 + i * 1.3) * 0.5 + 0.5) * bgCanvas.height;
      const size = Math.max(0.5, 1 + bassEnergy * 3 + Math.sin(i) * 1.5);
      const color = colorPalette[i % colorPalette.length];
      bgCtx.beginPath();
      bgCtx.arc(x, y, size, 0, Math.PI * 2);
      bgCtx.fillStyle = `rgba(${color}, ${0.25 + bassEnergy * 0.4})`;
      bgCtx.fill();
    }

    animationId = requestAnimationFrame(draw);
  }
  draw();
}

function drawIdleBg() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
}
drawIdleBg();
