/** Progressive scroll reveal and a lightweight desktop cursor accent. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const selector = '.rv, .sys-card, .chart-shell, .arch > div, .sys-signal-board, .pnl-chart-wrap';
  const blocks = [...document.querySelectorAll(selector)]
    .filter(element => !element.parentElement?.closest(selector));
  let observer = null;

  function reveal(element) {
    element.classList.remove('is-pending');
    element.classList.add('is-visible');
    observer?.unobserve(element);
  }

  if (!reduced.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    blocks.forEach(element => {
      const siblings = [...element.parentElement.children].filter(child => blocks.includes(child));
      element.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(element), 3) * 55}ms`);
      element.classList.add('motion-reveal', 'is-pending');
      observer.observe(element);
    });
  }
  // Keyboard navigation and anchor jumps must never land on hidden content.
  document.addEventListener('focusin', event => {
    const block = event.target.closest?.('.motion-reveal');
    if (block) reveal(block);
  });

  const cursor = document.createElement('div');
  cursor.className = 'workspace-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);
  let frame = null, x = 0, y = 0, targetX = 0, targetY = 0, lastTime = 0;
  const enabled = () => finePointer.matches && !reduced.matches && !document.hidden;

  function hideCursor() {
    cursor.classList.remove('is-visible', 'is-pressed', 'is-action');
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; lastTime = 0;
  }
  function draw(time) {
    frame = null;
    if (!enabled()) { hideCursor(); return; }
    const delta = lastTime ? Math.min(time - lastTime, 50) : 16.67;
    lastTime = time;
    const blend = 1 - Math.exp(-delta / 42);
    x += (targetX - x) * blend; y += (targetY - y) * blend;
    const moving = Math.abs(targetX - x) + Math.abs(targetY - y) > .15;
    if (!moving) { x = targetX; y = targetY; lastTime = 0; }
    cursor.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (moving) frame = requestAnimationFrame(draw);
  }
  function updateTarget(target) {
    // Keep data entry, text selection and chart crosshairs visually precise.
    if (target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), canvas, #marketChart')) {
      hideCursor(); return false;
    }
    cursor.classList.toggle('is-action', !!target.closest?.('a, button, summary, [role="button"]'));
    return true;
  }
  document.addEventListener('pointermove', event => {
    if (!enabled() || event.pointerType !== 'mouse' || !updateTarget(event.target)) { hideCursor(); return; }
    targetX = event.clientX; targetY = event.clientY;
    if (!cursor.classList.contains('is-visible')) { x = targetX; y = targetY; }
    cursor.classList.add('is-visible');
    if (frame === null) frame = requestAnimationFrame(draw);
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && enabled()) cursor.classList.add('is-pressed');
    else hideCursor();
  }, { passive: true });
  document.addEventListener('pointerup', () => cursor.classList.remove('is-pressed'), { passive: true });
  document.documentElement.addEventListener('pointerleave', hideCursor);
  document.addEventListener('keydown', hideCursor);
  // Hide until the next move rather than leaving a hover ring on a scrolled-away button.
  window.addEventListener('scroll', hideCursor, { passive: true });
  window.addEventListener('blur', hideCursor);
  window.addEventListener('pagehide', hideCursor);
  document.addEventListener('visibilitychange', hideCursor);
  finePointer.addEventListener('change', hideCursor);
  reduced.addEventListener('change', () => {
    hideCursor();
    if (reduced.matches) { blocks.forEach(reveal); observer?.disconnect(); }
  });
})();
