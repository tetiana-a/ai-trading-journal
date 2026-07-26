/**
 * app.js — Main application controller
 * Initializes all modules, binds events, manages theme and i18n
 */

import { Storage } from './storage.js';
import { i18n, setLanguage, t } from './i18n.js';
import { calcPnl, computeStats, computeMonthly } from './analytics.js';
import { validateTrade } from './validation.js';
import { fetchMarketPrice } from './market-api.js';
import { analyzeTrade } from './ai-service.js';
import { addTrade, removeTrade, updateTrade, getTrades, saveTrades } from './trades.js';
import { drawEquityCurve } from './charts.js';
import { initScreenshots } from './screenshots.js';
import { exportJSON, exportCSV, importJSON } from './export-import.js';
import { RadioVisualizer, createRadioBars } from './radio-visualizer.js';

// ============================================================
// State
// ============================================================
let currentTab = 'trades';
let calendarDate = new Date();
let radioVisualizer = null;
let headerRadio = null;
let radioPlaying = false;

// ============================================================
// DOM References
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// Theme
// ============================================================
function initTheme() {
  const saved = Storage.get('theme') || 'dark';
  document.documentElement.classList.toggle('dark', saved === 'dark');
  document.documentElement.classList.toggle('light', saved === 'light');
  updateThemeIcon(saved);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', !isDark);
  document.documentElement.classList.toggle('light', isDark);
  Storage.set('theme', newTheme);
  updateThemeIcon(newTheme);
  // Redraw charts with new theme colors
  refreshCurrentView();
}

function updateThemeIcon(theme) {
  const darkIcon = $('#theme-icon-dark');
  const lightIcon = $('#theme-icon-light');
  if (darkIcon && lightIcon) {
    darkIcon.style.display = theme === 'dark' ? 'block' : 'none';
    lightIcon.style.display = theme === 'light' ? 'block' : 'none';
  }
}

// ============================================================
// i18n
// ============================================================
function initI18n() {
  const saved = Storage.get('lang') || 'ru';
  setLanguage(saved);
  $('#lang-select').value = saved;
  applyTranslations();
}

function applyTranslations() {
  $$('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text) el.textContent = text;
  });
  // Update placeholder texts
  $$('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = t(key);
    if (text) el.placeholder = text;
  });
}

// ============================================================
// Tabs
// ============================================================
function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      $$('.tab-content').forEach(c => c.style.display = 'none');
      const target = $(`#tab-${currentTab}`);
      if (target) target.style.display = 'block';
      refreshCurrentView();
    });
  });
}

// ============================================================
// Stats
// ============================================================
function refreshStats() {
  const trades = getTrades();
  const closed = trades.filter(t => t.status === 'closed');
  const stats = computeStats(closed);
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);

  $('#stat-total').textContent = trades.length;
  $('#stat-winrate').textContent = (stats.winRate * 100).toFixed(1) + '%';
  
  const pnlEl = $('#stat-pnl');
  pnlEl.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2);
  pnlEl.className = 'stat-card__value' + (totalPnl >= 0 ? ' pnl-positive' : ' pnl-negative');
  
  $('#stat-pf').textContent = stats.profitFactor.toFixed(2);
  $('#stat-avgwin').textContent = '$' + stats.avgWin.toFixed(2);
  $('#stat-avgloss').textContent = '$' + stats.avgLoss.toFixed(2);
}

// ============================================================
// Trade Table
// ============================================================
function refreshTradeTable() {
  const trades = getTrades();
  const tbody = $('#trades-body');
  const empty = $('#empty-trades');
  const table = $('#trades-table');

  if (trades.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';

  // Sort by date descending
  const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sorted.map(trade => {
    const pnl = trade.pnl || 0;
    const pnlClass = pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : '';
    const pnlText = (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2);
    const typeBadge = trade.type === 'long' ? 'badge-long' : 'badge-short';
    const statusBadge = trade.status === 'open' ? 'badge-neutral' : (pnl >= 0 ? 'badge-profit' : 'badge-loss');

    return `<tr data-id="${trade.id}">
      <td style="white-space:nowrap;">${trade.date}</td>
      <td><strong>${trade.pair}</strong></td>
      <td><span class="badge ${typeBadge}">${trade.type.toUpperCase()}</span></td>
      <td class="font-mono">$${trade.entryPrice}</td>
      <td class="font-mono">${trade.exitPrice ? '$' + trade.exitPrice : '—'}</td>
      <td class="font-mono">${trade.volume}</td>
      <td class="${pnlClass} font-mono font-bold">${trade.status === 'open' ? '—' : pnlText}</td>
      <td>
        <div style="display:flex;gap:0.25rem;">
          <button class="btn btn-ghost btn-sm edit-trade-btn" data-id="${trade.id}" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-sm delete-trade-btn" data-id="${trade.id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Bind edit/delete
  $$('.edit-trade-btn').forEach(btn => {
    btn.addEventListener('click', () => openTradeDialog(btn.dataset.id));
  });
  $$('.delete-trade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(t('confirmDelete') || 'Delete this trade?')) {
        removeTrade(btn.dataset.id);
        refreshAll();
        showToast(t('tradeDeleted') || 'Trade deleted', 'success');
      }
    });
  });
}

// ============================================================
// Calendar
// ============================================================
function refreshCalendar() {
  const grid = $('#calendar-grid');
  const label = $('#cal-month-label');
  const trades = getTrades();
  
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  
  const monthNames = [
    t('january') || 'January', t('february') || 'February',
    t('march') || 'March', t('april') || 'April',
    t('may') || 'May', t('june') || 'June',
    t('july') || 'July', t('august') || 'August',
    t('september') || 'September', t('october') || 'October',
    t('november') || 'November', t('december') || 'December'
  ];
  label.textContent = `${monthNames[month]} ${year}`;
  
  const dayNames = [
    t('mon') || 'Mon', t('tue') || 'Tue', t('wed') || 'Wed',
    t('thu') || 'Thu', t('fri') || 'Fri', t('sat') || 'Sat', t('sun') || 'Sun'
  ];
  
  // Build trade lookup
  const tradeByDate = {};
  trades.forEach(trade => {
    if (!tradeByDate[trade.date]) tradeByDate[trade.date] = [];
    tradeByDate[trade.date].push(trade);
  });
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1; // Monday = 0
  if (startDow < 0) startDow = 6;
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  let html = dayNames.map(d => `<div class="calendar-header-cell">${d}</div>`).join('');
  
  // Previous month padding
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    html += `<div class="calendar-cell other-month">${prevLast - i}</div>`;
  }
  
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTrades = tradeByDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const hasTrade = dayTrades.length > 0;
    const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const profitLoss = dayPnl >= 0 ? 'profit' : 'loss';
    
    let classes = 'calendar-cell';
    if (isToday) classes += ' today';
    if (hasTrade) classes += ' has-trade ' + profitLoss;
    
    html += `<div class="${classes}" data-date="${dateStr}" title="${dayTrades.length > 0 ? dayTrades.length + ' trade(s)' : ''}">${d}</div>`;
  }
  
  // Next month padding
  const totalCells = startDow + lastDay.getDate();
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-cell other-month">${i}</div>`;
  }
  
  grid.innerHTML = html;
  
  // Click to add trade on that date
  $$('.calendar-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => {
      if (cell.dataset.date) {
        openTradeDialog(null, cell.dataset.date);
      }
    });
  });
}

// ============================================================
// Analytics Table
// ============================================================
function refreshAnalytics() {
  const trades = getTrades();
  const monthly = computeMonthly(trades.filter(t => t.status === 'closed'));
  const tbody = $('#analytics-body');
  
  if (monthly.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:hsl(var(--muted-foreground)); padding:2rem;">${t('noData') || 'No data yet'}</td></tr>`;
    return;
  }
  
  tbody.innerHTML = monthly.map(m => {
    const pnlClass = m.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
    const pnlText = (m.pnl >= 0 ? '+' : '') + '$' + m.pnl.toFixed(2);
    return `<tr>
      <td><strong>${m.month}</strong></td>
      <td>${m.trades}</td>
      <td>${(m.winRate * 100).toFixed(1)}%</td>
      <td class="${pnlClass} font-mono font-bold">${pnlText}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// Equity Curve
// ============================================================
function refreshEquityCurve() {
  const trades = getTrades().filter(t => t.status === 'closed').sort((a, b) => new Date(a.date) - new Date(b.date));
  const canvas = $('#equity-canvas');
  if (canvas) drawEquityCurve(canvas, trades);
}

// ============================================================
// Radio Visualizer
// ============================================================
function initRadioVisualizer() {
  // Header mini visualizer (CSS-only)
  const headerContainer = $('#header-radio');
  if (headerContainer) {
    headerRadio = createRadioBars(headerContainer, 12);
    headerRadio.start();
  }
  
  // Full canvas visualizer
  const canvas = $('#radio-canvas');
  if (canvas) {
    radioVisualizer = new RadioVisualizer(canvas, {
      mode: 'bars',
      barCount: 48,
      glowIntensity: 0.6,
      sensitivity: 1.5
    });
    radioVisualizer.startSimulation();
    radioPlaying = true;
  }
  
  // Mode buttons
  $$('.radio-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.radio-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (radioVisualizer) {
        radioVisualizer.setMode(btn.dataset.mode);
      }
    });
  });
  
  // Play/Stop
  const toggleBtn = $('#radio-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (radioPlaying) {
        radioVisualizer?.stop();
        headerRadio?.stop();
        toggleBtn.textContent = '▶';
        radioPlaying = false;
      } else {
        radioVisualizer?.startSimulation();
        headerRadio?.start();
        toggleBtn.textContent = '⏸';
        radioPlaying = true;
      }
    });
    toggleBtn.textContent = '⏸';
  }
}

// ============================================================
// Trade Dialog
// ============================================================
function openTradeDialog(tradeId = null, prefillDate = null) {
  const overlay = $('#trade-dialog-overlay');
  const titleEl = $('#dialog-title');
  const form = $('#trade-form');
  
  form.reset();
  $('#trade-id').value = '';
  $('#screenshot-preview').style.display = 'none';
  $('#ai-analysis').style.display = 'none';
  $('#ai-loading').style.display = 'none';
  
  // Clear validation errors
  $$('.input-error').forEach(el => el.classList.remove('input-error'));
  $$('.error-text').forEach(el => el.remove());
  
  if (tradeId) {
    // Edit mode
    const trade = getTrades().find(t => t.id === tradeId);
    if (!trade) return;
    
    titleEl.textContent = t('editTrade') || 'Edit Trade';
    $('#trade-id').value = trade.id;
    $('#trade-date').value = trade.date;
    $('#trade-pair').value = trade.pair;
    $('#trade-type').value = trade.type;
    $('#trade-status').value = trade.status;
    $('#trade-entry').value = trade.entryPrice;
    $('#trade-exit').value = trade.exitPrice || '';
    $('#trade-volume').value = trade.volume;
    $('#trade-fee').value = trade.fee || 0;
    $('#trade-notes').value = trade.notes || '';
    
    if (trade.screenshot) {
      const preview = $('#screenshot-preview');
      preview.src = trade.screenshot;
      preview.style.display = 'block';
    }
    if (trade.aiAnalysis) {
      $('#ai-analysis').textContent = trade.aiAnalysis;
      $('#ai-analysis').style.display = 'block';
    }
  } else {
    titleEl.textContent = t('addTrade') || 'Add Trade';
    if (prefillDate) {
      $('#trade-date').value = prefillDate;
    } else {
      $('#trade-date').value = new Date().toISOString().split('T')[0];
    }
  }
  
  overlay.style.display = 'flex';
}

function closeTradeDialog() {
  $('#trade-dialog-overlay').style.display = 'none';
}

function saveTradeFromDialog() {
  const form = $('#trade-form');
  const id = $('#trade-id').value;
  
  const tradeData = {
    date: $('#trade-date').value,
    pair: $('#trade-pair').value.trim().toUpperCase(),
    type: $('#trade-type').value,
    status: $('#trade-status').value,
    entryPrice: parseFloat($('#trade-entry').value),
    exitPrice: parseFloat($('#trade-exit').value) || null,
    volume: parseFloat($('#trade-volume').value),
    fee: parseFloat($('#trade-fee').value) || 0,
    notes: $('#trade-notes').value.trim(),
    screenshot: $('#screenshot-preview').src || null,
    aiAnalysis: $('#ai-analysis').textContent || null,
  };
  
  // Validate
  const errors = validateTrade(tradeData);
  
  // Clear previous errors
  $$('.input-error').forEach(el => el.classList.remove('input-error'));
  $$('.error-text').forEach(el => el.remove());
  
  if (errors.length > 0) {
    errors.forEach(err => {
      const input = $(`#trade-${err.field}`);
      if (input) {
        input.classList.add('input-error');
        const errorEl = document.createElement('div');
        errorEl.className = 'error-text';
        errorEl.textContent = err.message;
        input.parentNode.appendChild(errorEl);
      }
    });
    return;
  }
  
  // Calculate PNL for closed trades
  if (tradeData.status === 'closed' && tradeData.exitPrice) {
    tradeData.pnl = calcPnl(tradeData);
  }
  
  if (id) {
    updateTrade(id, tradeData);
    showToast(t('tradeUpdated') || 'Trade updated', 'success');
  } else {
    addTrade(tradeData);
    showToast(t('tradeAdded') || 'Trade added', 'success');
  }
  
  closeTradeDialog();
  refreshAll();
}

// ============================================================
// Settings Dialog
// ============================================================
function openSettings() {
  const overlay = $('#settings-dialog-overlay');
  $('#settings-groq-key').value = Storage.get('groqApiKey') || '';
  $('#settings-binance-key').value = Storage.get('binanceApiKey') || '';
  
  const autoFetch = Storage.get('autoFetchPrices');
  const switchEl = $('#settings-auto-fetch');
  switchEl.classList.toggle('active', autoFetch === 'true');
  
  overlay.style.display = 'flex';
}

function closeSettings() {
  $('#settings-dialog-overlay').style.display = 'none';
}

function saveSettings() {
  Storage.set('groqApiKey', $('#settings-groq-key').value.trim());
  Storage.set('binanceApiKey', $('#settings-binance-key').value.trim());
  Storage.set('autoFetchPrices', $('#settings-auto-fetch').classList.contains('active'));
  closeSettings();
  showToast(t('settingsSaved') || 'Settings saved', 'success');
}

// ============================================================
// Export / Import
// ============================================================
function initExportImport() {
  // Dropdown toggle
  const btn = $('#export-import-btn');
  const menu = $('#export-import-menu');
  
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
  
  document.addEventListener('click', () => {
    menu.style.display = 'none';
  });
  
  $('#export-json-btn')?.addEventListener('click', () => {
    exportJSON();
    menu.style.display = 'none';
  });
  
  $('#export-csv-btn')?.addEventListener('click', () => {
    exportCSV();
    menu.style.display = 'none';
  });
  
  $('#import-json-btn')?.addEventListener('click', () => {
    $('#import-file-input')?.click();
    menu.style.display = 'none';
  });
  
  $('#import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          importJSON(data);
          refreshAll();
          showToast(t('importSuccess') || 'Import successful', 'success');
        } catch (err) {
          showToast(t('importError') || 'Import failed: invalid JSON', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  });
}

// ============================================================
// Toast
// ============================================================
function showToast(message, type = 'info') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================================
// Refresh
// ============================================================
function refreshCurrentView() {
  switch (currentTab) {
    case 'trades': refreshTradeTable(); break;
    case 'calendar': refreshCalendar(); break;
    case 'analytics': refreshAnalytics(); break;
    case 'equity': refreshEquityCurve(); break;
  }
}

function refreshAll() {
  refreshStats();
  refreshTradeTable();
  refreshCalendar();
  refreshAnalytics();
  refreshEquityCurve();
}

// ============================================================
// Event Bindings
// ============================================================
function bindEvents() {
  // Theme toggle
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  
  // Language select
  $('#lang-select')?.addEventListener('change', (e) => {
    setLanguage(e.target.value);
    Storage.set('lang', e.target.value);
    applyTranslations();
    refreshAll(); // Refresh calendar month names etc.
  });
  
  // Add trade
  $('#add-trade-btn')?.addEventListener('click', () => openTradeDialog());
  
  // Dialog
  $('#dialog-close')?.addEventListener('click', closeTradeDialog);
  $('#dialog-cancel')?.addEventListener('click', closeTradeDialog);
  $('#dialog-save')?.addEventListener('click', saveTradeFromDialog);
  $('#trade-dialog-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTradeDialog();
  });
  
  // Settings
  $('#settings-btn')?.addEventListener('click', openSettings);
  $('#settings-close')?.addEventListener('click', closeSettings);
  $('#settings-cancel')?.addEventListener('click', closeSettings);
  $('#settings-save')?.addEventListener('click', saveSettings);
  $('#settings-dialog-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  $('#settings-auto-fetch')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
  });
  
  // Calendar navigation
  $('#cal-prev')?.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    refreshCalendar();
  });
  $('#cal-next')?.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    refreshCalendar();
  });
  
  // AI Analysis
  $('#ai-analyze-btn')?.addEventListener('click', async () => {
    const pair = $('#trade-pair').value;
    const type = $('#trade-type').value;
    const entry = $('#trade-entry').value;
    const exit = $('#trade-exit').value;
    const volume = $('#trade-volume').value;
    const notes = $('#trade-notes').value;
    
    if (!pair || !entry) {
      showToast(t('fillRequiredFields') || 'Fill in pair and entry price', 'error');
      return;
    }
    
    const analysisEl = $('#ai-analysis');
    const loadingEl = $('#ai-loading');
    analysisEl.style.display = 'none';
    loadingEl.style.display = 'flex';
    
    try {
      const result = await analyzeTrade({ pair, type, entry, exit, volume, notes });
      analysisEl.textContent = result;
      analysisEl.style.display = 'block';
    } catch (err) {
      showToast(err.message || (t('aiError') || 'AI analysis failed'), 'error');
    } finally {
      loadingEl.style.display = 'none';
    }
  });
  
  // Auto-fetch price on pair blur
  const autoFetch = Storage.get('autoFetchPrices') === 'true';
  if (autoFetch) {
    $('#trade-pair')?.addEventListener('blur', async () => {
      const pair = $('#trade-pair').value.trim().toUpperCase();
      if (pair) {
        try {
          const price = await fetchMarketPrice(pair);
          if (price) {
            $('#trade-entry').value = price;
          }
        } catch (e) {
          // Silently fail
        }
      }
    });
  }
  
  // Screenshot handling
  initScreenshots();
  
  // Export/Import
  initExportImport();
  
  // Keyboard shortcut: Escape closes dialogs
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTradeDialog();
      closeSettings();
    }
  });
}

// ============================================================
// Initialize
// ============================================================
function init() {
  initTheme();
  initI18n();
  initTabs();
  bindEvents();
  initRadioVisualizer();
  refreshAll();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}