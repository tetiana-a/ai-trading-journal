/**
 * Radio Visualizer — Bilovodskyi inspired design
 * Web Audio API-based radio equalizer animation
 * 
 * Features:
 * - Multiple visualization modes (bars, wave, circle)
 * - Audio-reactive using AnalyserNode
 * - Smooth animations with glow effects
 * - CSS variable-driven theming
 */

export class RadioVisualizer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.animationId = null;
    this.isPlaying = false;
    this.mode = options.mode || 'bars'; // bars, wave, circle
    this.barCount = options.barCount || 40;
    this.glowIntensity = options.glowIntensity || 0.6;
    this.color = options.color || null; // null = use CSS variable
    this.backgroundColor = options.backgroundColor || null;
    this.sensitivity = options.sensitivity || 1.5;
    this.smoothing = options.smoothing || 0.8;
    this.onAudioError = options.onAudioError || null;

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);
    this._resize();
  }

  /**
   * Resize canvas to match container
   */
  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * Initialize Web Audio API context
   */
  _initAudio() {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.barCount * 4;
      this.analyser.smoothingTimeConstant = this.smoothing;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('Web Audio API not available:', e);
      if (this.onAudioError) this.onAudioError(e);
    }
  }

  /**
   * Connect an audio element to the visualizer
   */
  connectAudio(audioElement) {
    this._initAudio();
    if (!this.audioContext) return;

    try {
      if (this.source) {
        this.source.disconnect();
      }
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('Failed to connect audio:', e);
    }
  }

  /**
   * Connect a MediaStream (e.g., microphone) to the visualizer
   */
  async connectStream(stream) {
    this._initAudio();
    if (!this.audioContext) return;

    try {
      if (this.source) {
        this.source.disconnect();
      }
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      // Don't connect analyser to destination to avoid feedback
    } catch (e) {
      console.warn('Failed to connect stream:', e);
    }
  }

  /**
   * Get the primary color from CSS variables
   */
  _getColor(alpha = 1) {
    if (this.color) return this.color;
    
    const style = getComputedStyle(this.canvas);
    const hsl = style.getPropertyValue('--radio-bar-color').trim() || '142 76% 36%';
    return `hsla(${hsl} / ${alpha})`;
  }

  _getGlowColor(alpha = 1) {
    if (this.color) return this.color;
    
    const style = getComputedStyle(this.canvas);
    const hsl = style.getPropertyValue('--radio-glow').trim() || '142 76% 36%';
    return `hsla(${hsl} / ${alpha})`;
  }

  _getBackgroundColor() {
    if (this.backgroundColor) return this.backgroundColor;
    
    const style = getComputedStyle(this.canvas);
    const bg = style.getPropertyValue('--radio-bg').trim() || '0 0% 8%';
    return `hsl(${bg})`;
  }

  /**
   * Start simulated animation (no audio source needed)
   */
  startSimulation() {
    this.isPlaying = true;
    this._simulateData = new Float32Array(this.barCount);
    this._targets = new Float32Array(this.barCount);
    this._simulate();
  }

  /**
   * Start audio-reactive visualization
   */
  start() {
    if (!this.audioContext || !this.analyser) {
      this.startSimulation();
      return;
    }
    
    this.isPlaying = true;
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    this._animate();
  }

  /**
   * Stop the visualization
   */
  stop() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Set visualization mode
   */
  setMode(mode) {
    this.mode = mode;
  }

  /**
   * Main animation loop (audio-reactive)
   */
  _animate() {
    if (!this.isPlaying) return;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    this._draw(this.dataArray);
    
    this.animationId = requestAnimationFrame(() => this._animate());
  }

  /**
   * Simulated animation loop (no audio)
   */
  _simulate() {
    if (!this.isPlaying) return;

    const time = performance.now() / 1000;
    
    for (let i = 0; i < this.barCount; i++) {
      // Create organic-looking patterns
      const wave1 = Math.sin(time * 2 + i * 0.3) * 0.5 + 0.5;
      const wave2 = Math.sin(time * 3.7 + i * 0.15) * 0.3 + 0.5;
      const wave3 = Math.cos(time * 1.5 + i * 0.5) * 0.2 + 0.5;
      const center = Math.exp(-Math.pow((i - this.barCount / 2) / (this.barCount * 0.3), 2));
      
      this._targets[i] = (wave1 * 0.4 + wave2 * 0.3 + wave3 * 0.3) * center * 255 * this.sensitivity;
    }

    // Smooth interpolation
    for (let i = 0; i < this.barCount; i++) {
      this._simulateData[i] += (this._targets[i] - this._simulateData[i]) * 0.15;
    }

    this._draw(this._simulateData);
    this.animationId = requestAnimationFrame(() => this._simulate());
  }

  /**
   * Main draw function
   */
  _draw(data) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = this._getBackgroundColor();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    switch (this.mode) {
      case 'bars':
        this._drawBars(ctx, w, h, data);
        break;
      case 'wave':
        this._drawWave(ctx, w, h, data);
        break;
      case 'circle':
        this._drawCircle(ctx, w, h, data);
        break;
      default:
        this._drawBars(ctx, w, h, data);
    }
  }

  /**
   * Draw bar equalizer
   */
  _drawBars(ctx, w, h, data) {
    const barWidth = Math.max(2, (w - (this.barCount - 1) * 2) / this.barCount);
    const gap = 2;

    for (let i = 0; i < this.barCount; i++) {
      const value = (data[i] || 0) / 255;
      const barHeight = Math.max(3, value * (h - 16));
      const x = i * (barWidth + gap) + (w - this.barCount * (barWidth + gap) + gap) / 2;
      const y = h - barHeight - 8;

      // Glow effect
      ctx.shadowColor = this._getGlowColor(this.glowIntensity * value);
      ctx.shadowBlur = 8 * value;

      // Gradient bar
      const gradient = ctx.createLinearGradient(x, y + barHeight, x, y);
      gradient.addColorStop(0, this._getColor(0.6));
      gradient.addColorStop(0.5, this._getColor(0.85));
      gradient.addColorStop(1, this._getColor(1));
      ctx.fillStyle = gradient;

      // Rounded bar
      ctx.beginPath();
      const radius = Math.min(barWidth / 2, 3);
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();

      // Reflection
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const reflectionGradient = ctx.createLinearGradient(x, h - 8, x, h - 8 + barHeight * 0.3);
      reflectionGradient.addColorStop(0, this._getColor(0.15));
      reflectionGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = reflectionGradient;
      ctx.fillRect(x, h - 8, barWidth, barHeight * 0.3);
    }

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  /**
   * Draw wave form
   */
  _drawWave(ctx, w, h, data) {
    const sliceWidth = w / this.barCount;

    // Glow
    ctx.shadowColor = this._getGlowColor(this.glowIntensity);
    ctx.shadowBlur = 12;

    // Main wave
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    for (let i = 0; i < this.barCount; i++) {
      const value = (data[i] || 0) / 255;
      const y = h / 2 + (value - 0.5) * h * 0.7;
      const x = i * sliceWidth + sliceWidth / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * sliceWidth + sliceWidth / 2;
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY || y, cpX, (prevY || y + y) / 2);
      }
      var prevY = y;
    }
    ctx.strokeStyle = this._getColor(0.9);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fill underneath
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, this._getColor(0.15));
    fillGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  /**
   * Draw circular visualizer
   */
  _drawCircle(ctx, w, h, data) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.25;
    const step = (Math.PI * 2) / this.barCount;

    ctx.shadowColor = this._getGlowColor(this.glowIntensity);
    ctx.shadowBlur = 10;

    for (let i = 0; i < this.barCount; i++) {
      const value = (data[i] || 0) / 255;
      const angle = i * step - Math.PI / 2;
      const barLen = value * radius * 0.8 + 4;
      const innerR = radius;
      const outerR = radius + barLen;

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * outerR;
      const y2 = cy + Math.sin(angle) * outerR;

      const alpha = 0.4 + value * 0.6;
      ctx.strokeStyle = this._getColor(alpha);
      ctx.lineWidth = Math.max(2, (Math.PI * 2 * radius / this.barCount) * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = this._getColor(0.1);
    ctx.fill();
    ctx.strokeStyle = this._getColor(0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  /**
   * Update settings
   */
  updateSettings(options = {}) {
    if (options.mode) this.mode = options.mode;
    if (options.barCount) {
      this.barCount = options.barCount;
      if (this.analyser) {
        this.analyser.fftSize = this.barCount * 4;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
    }
    if (options.glowIntensity !== undefined) this.glowIntensity = options.glowIntensity;
    if (options.sensitivity !== undefined) this.sensitivity = options.sensitivity;
    if (options.smoothing !== undefined) this.smoothing = options.smoothing;
    if (options.color !== undefined) this.color = options.color;
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.stop();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * CSS-only radio equalizer bars (lightweight, no canvas)
 * For the header/mini visualizer
 */
export function createRadioBars(container, count = 12) {
  container.innerHTML = '';
  container.classList.add('radio-visualizer');
  
  const bars = [];
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'radio-visualizer__bar';
    // Stagger the animation delay for a wave effect
    bar.style.setProperty('--eq-height', `${8 + Math.random() * 16}px`);
    bar.style.animationDelay = `${i * 0.05}s`;
    bar.style.animationDuration = `${0.3 + Math.random() * 0.4}s`;
    container.appendChild(bar);
    bars.push(bar);
  }
  
  return {
    container,
    bars,
    start() {
      container.classList.add('active');
    },
    stop() {
      container.classList.remove('active');
    },
    setBarHeight(index, height) {
      if (bars[index]) {
        bars[index].style.height = height + 'px';
      }
    }
  };
}

export default RadioVisualizer;