/**
 * charts.js — Canvas-based chart drawing
 * Supports dark/light themes via CSS custom properties
 */

/**
 * Get a CSS variable value from the document root
 */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Convert HSL CSS variable to canvas-usable format
 * @param {string} hsl - e.g., "142 76% 36%"
 * @param {number} alpha - optional alpha (0-1)
 * @returns {string} - e.g., "hsla(142, 76%, 36%, 0.8)"
 */
function hslVar(hsl, alpha) {
  const parts = hsl.split(/\s+/);
  if (parts.length >= 3) {
    const [h, s, l] = parts;
    if (alpha !== undefined) {
      return `hsla(${h}, ${s}, ${l}, ${alpha})`;
    }
    return `hsl(${h}, ${s}, ${l})`;
  }
  return hsl;
}

/**
 * Draw equity curve on canvas
 * @param {HTMLCanvasElement} canvas
 * @param {Array} trades - sorted closed trades with pnl
 */
export function drawEquityCurve(canvas, trades) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);
  
  const w = rect.width;
  const h = rect.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  
  // Get theme colors
  const fgColor = getCSSVar('--foreground') || '#fafafa';
  const mutedColor = getCSSVar('--muted-foreground') || '#71717a';
  const borderColor = getCSSVar('--border') || '#27272a';
  const successHSL = getCSSVar('--success') || '142 76% 36%';
  const destructiveHSL = getCSSVar('--destructive') || '0 62.8% 30.6%';
  const bgCard = getCSSVar('--card') || '#0a0a0a';
  
  // Clear
  ctx.clearRect(0, 0, w, h);
  
  // Build equity data
  let cumulative = 0;
  const dataPoints = [{ value: 0, label: '' }];
  
  trades.forEach(trade => {
    cumulative += (trade.pnl || 0);
    dataPoints.push({
      value: cumulative,
      label: trade.date,
      pnl: trade.pnl || 0
    });
  });
  
  if (dataPoints.length <= 1) {
    // No data
    ctx.fillStyle = mutedColor;
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', w / 2, h / 2);
    return;
  }
  
  const values = dataPoints.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  
  // Grid lines
  ctx.strokeStyle = hslVar(borderColor, 0.3);
  ctx.lineWidth = 0.5;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    
    // Y-axis labels
    const val = maxVal - (range / gridLines) * i;
    ctx.fillStyle = mutedColor;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('$' + val.toFixed(0), padding.left - 8, y + 4);
  }
  
  // Build path
  const getX = (i) => padding.left + (i / (dataPoints.length - 1)) * chartW;
  const getY = (v) => padding.top + ((maxVal - v) / range) * chartH;
  
  // Area fill gradient
  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  const isPositive = cumulative >= 0;
  const lineHSL = isPositive ? successHSL : destructiveHSL;
  
  gradient.addColorStop(0, hslVar(lineHSL, 0.2));
  gradient.addColorStop(1, hslVar(lineHSL, 0.02));
  
  // Draw area
  ctx.beginPath();
  ctx.moveTo(getX(0), getY(dataPoints[0].value));
  for (let i = 1; i < dataPoints.length; i++) {
    const x0 = getX(i - 1);
    const y0 = getY(dataPoints[i - 1].value);
    const x1 = getX(i);
    const y1 = getY(dataPoints[i].value);
    const cpX = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
  }
  ctx.lineTo(getX(dataPoints.length - 1), h - padding.bottom);
  ctx.lineTo(getX(0), h - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw line
  ctx.beginPath();
  ctx.moveTo(getX(0), getY(dataPoints[0].value));
  for (let i = 1; i < dataPoints.length; i++) {
    const x0 = getX(i - 1);
    const y0 = getY(dataPoints[i - 1].value);
    const x1 = getX(i);
    const y1 = getY(dataPoints[i].value);
    const cpX = (x0 + x1) / 2;
    ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
  }
  ctx.strokeStyle = hslVar(lineHSL, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw dots for each trade
  dataPoints.forEach((point, i) => {
    if (i === 0) return;
    const x = getX(i);
    const y = getY(point.value);
    
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = (point.pnl || 0) >= 0 ? hslVar(successHSL, 0.9) : hslVar(destructiveHSL, 0.9);
    ctx.fill();
    ctx.strokeStyle = bgCard;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  
  // X-axis labels (show every Nth date)
  const labelInterval = Math.max(1, Math.floor(dataPoints.length / 8));
  ctx.fillStyle = mutedColor;
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  
  for (let i = 0; i < dataPoints.length; i += labelInterval) {
    const x = getX(i);
    const label = dataPoints[i].label || '';
    // Show short date
    const parts = label.split('-');
    const shortLabel = parts.length === 3 ? `${parts[1]}/${parts[2]}` : label;
    ctx.fillText(shortLabel, x, h - padding.bottom + 16);
  }
  
  // Current value label
  const lastPoint = dataPoints[dataPoints.length - 1];
  const lastX = getX(dataPoints.length - 1);
  const lastY = getY(lastPoint.value);
  
  ctx.fillStyle = hslVar(lineHSL, 1);
  ctx.font = 'bold 12px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText((lastPoint.value >= 0 ? '+$' : '-$') + Math.abs(lastPoint.value).toFixed(2), w - padding.right, lastY - 8);
}