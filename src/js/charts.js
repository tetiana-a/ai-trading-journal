/**
 * charts.js — Canvas-based equity curve and PnL bar chart renderer.
 * Enhanced with gradient fills and smooth curves.
 */

function drawEquity() {
  const canvas = document.getElementById('equityCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const sorted = trades
    .filter(tr => tr.status !== 'open')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let cum = 0;
  const pts = [0];
  sorted.forEach(tr => { cum += calcPnl(tr).pnl; pts.push(cum); });

  const style = getComputedStyle(document.documentElement);
  const lineColorVar = style.getPropertyValue('--line2').trim();

  // Not enough data — draw flat line
  if (pts.length < 2) {
    ctx.strokeStyle = lineColorVar;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = (max - min) || 1;
  const stepX = rect.width / (pts.length - 1);
  const isPositive = pts[pts.length - 1] >= pts[0];
  const lineColor = isPositive
    ? style.getPropertyValue('--pos').trim()
    : style.getPropertyValue('--neg').trim();

  const padY = rect.height * 0.12;
  const drawH = rect.height - padY * 2;

  function getY(v) {
    return padY + drawH - ((v - min) / range) * drawH;
  }
  function getX(i) {
    return i * stepX;
  }

  // Gradient fill under curve
  const grad = ctx.createLinearGradient(0, 0, 0, rect.height);
  if (isPositive) {
    grad.addColorStop(0, 'rgba(126, 184, 138, 0.18)');
    grad.addColorStop(1, 'rgba(126, 184, 138, 0.0)');
  } else {
    grad.addColorStop(0, 'rgba(217, 122, 122, 0.18)');
    grad.addColorStop(1, 'rgba(217, 122, 122, 0.0)');
  }

  // Draw smooth curve using quadratic bezier
  ctx.beginPath();
  ctx.moveTo(getX(0), getY(pts[0]));
  for (let i = 1; i < pts.length; i++) {
    const prevX = getX(i - 1), prevY = getY(pts[i - 1]);
    const currX = getX(i), currY = getY(pts[i]);
    const cpX = (prevX + currX) / 2;
    ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + currY) / 2);
  }
  // Finish the last segment
  const lastI = pts.length - 1;
  ctx.quadraticCurveTo(getX(lastI - 0.5), getY(pts[lastI - 0.5] || pts[lastI - 1]), getX(lastI), getY(pts[lastI]));

  // Stroke the line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fill under curve
  ctx.lineTo(getX(lastI), rect.height);
  ctx.lineTo(getX(0), rect.height);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw endpoint dot with glow
  const lastX = getX(lastI);
  const lastY = getY(pts[lastI]);

  // Glow
  ctx.beginPath();
  ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
  ctx.fillStyle = isPositive ? 'rgba(126, 184, 138, 0.2)' : 'rgba(217, 122, 122, 0.2)';
  ctx.fill();

  // Dot
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

/** Draw monthly PnL bar chart. */
function drawPnlBarChart() {
  const canvas = document.getElementById('pnlBarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const months = computeMonthly(trades);
  if (!months.length) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--txt3').trim();
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0 ' + (translations[currentLang].pl_trade_5 || 'trades'), rect.width / 2, rect.height / 2);
    return;
  }

  const t = translations[currentLang];
  const style = getComputedStyle(document.documentElement);
  const posColor = style.getPropertyValue('--pos').trim();
  const negColor = style.getPropertyValue('--neg').trim();
  const txt3Color = style.getPropertyValue('--txt3').trim();
  const lineColorVar = style.getPropertyValue('--line').trim();

  const pad = { top: 10, bottom: 28, left: 8, right: 8 };
  const w = rect.width - pad.left - pad.right;
  const h = rect.height - pad.top - pad.bottom;

  const maxAbs = Math.max(...months.map(m => Math.abs(m.pnl)), 1);
  const barW = Math.min(32, (w / months.length) * 0.6);
  const gap = w / months.length;

  // Zero line
  const zeroY = pad.top + h / 2;
  ctx.strokeStyle = lineColorVar;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(rect.width - pad.right, zeroY);
  ctx.stroke();

  months.forEach((m, i) => {
    const x = pad.left + gap * i + (gap - barW) / 2;
    const barH = (Math.abs(m.pnl) / maxAbs) * (h / 2);
    const isPos = m.pnl >= 0;
    const y = isPos ? zeroY - barH : zeroY;
    const color = isPos ? posColor : negColor;

    // Bar with rounded top
    const radius = Math.min(4, barW / 2);
    ctx.beginPath();
    if (isPos) {
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
      ctx.lineTo(x + barW, zeroY);
    } else {
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, y + barH - radius);
      ctx.quadraticCurveTo(x, y + barH, x + radius, y + barH);
      ctx.lineTo(x + barW - radius, y + barH);
      ctx.quadraticCurveTo(x + barW, y + barH, x + barW, y + barH - radius);
      ctx.lineTo(x + barW, zeroY);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Month label
    const monthLabel = t.months[m.month - 1].slice(0, 3);
    ctx.fillStyle = txt3Color;
    ctx.font = '9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(monthLabel, x + barW / 2, rect.height - 8);
  });
}
