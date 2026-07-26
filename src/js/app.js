/**
 * app.js — Main entry point. Initializes theme, scroll observer, language,
 * calendar, and triggers initial render.
 */

/* ===== Theme Toggle ===== */
const themeTog = document.getElementById('themeTog');
themeTog.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  drawEquity();
  drawPnlBarChart();
});

/* ===== Scroll Reveal (IntersectionObserver) ===== */
const rvObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('on');
      rvObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.rv').forEach(el => rvObserver.observe(el));

/* ===== Language Select ===== */
document.getElementById('langSelect').value = currentLang;
document.getElementById('langSelect').addEventListener('change', (e) => {
  currentLang = e.target.value;
  localStorage.setItem(STORAGE_KEYS.LANG, currentLang);
  applyTranslations();
});

/* ===== Resize Handler =====
 * Debouncing prevents expensive canvas redraws from firing continuously while
 * a browser window is resized or a mobile device changes orientation.
 */
let resizeTimer;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    drawEquity();
    drawPnlBarChart();
  }, 120);
}, { passive: true });

/* ===== Init ===== */
applyTranslations();
loadTrades();
initCalendar();
