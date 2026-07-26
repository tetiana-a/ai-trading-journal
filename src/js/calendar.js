/**
 * calendar.js — Interactive calendar with month/year views.
 * Shows trades per day with PnL coloring, inspired by Bilovodskyi's calendar.
 */

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let calView = 'month'; // 'month' | 'year'

const DOW_SHORT = {
  ru: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  uk: ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
  cs: ['Po','Út','St','Čt','Pá','So','Ne'],
};

function initCalendar() {
  document.getElementById('calPrevMonth').addEventListener('click', () => {
    if (calView === 'month') {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
    } else {
      calYear--;
    }
    renderCalendar();
  });

  document.getElementById('calNextMonth').addEventListener('click', () => {
    if (calView === 'month') {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
    } else {
      calYear++;
    }
    renderCalendar();
  });

  document.querySelectorAll('.cal-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      calView = btn.dataset.calView;
      document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCalendar();
    });
  });

  renderCalendar();
}

function renderCalendar() {
  const t = translations[currentLang];
  const label = document.getElementById('calMonthLabel');

  if (calView === 'year') {
    label.textContent = calYear;
    renderYearView(t);
  } else {
    label.textContent = `${t.months[calMonth]} ${calYear}`;
    renderMonthView(t);
  }
}

function renderMonthView(t) {
  const container = document.getElementById('calGridContainer');
  const dows = DOW_SHORT[currentLang] || DOW_SHORT.en;
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday = 0, Sunday = 6
  let startDow = (firstDay.getDay() + 6) % 7;

  // Build a map of date -> trades
  const dayMap = {};
  trades.forEach(tr => {
    if (!tr.date) return;
    const d = tr.date;
    const [y, m, day] = d.split('-').map(Number);
    if (y === calYear && m === calMonth + 1) {
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(tr);
    }
  });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;
  const todayDate = today.getDate();

  // Previous month days
  const prevMonthLast = new Date(calYear, calMonth, 0).getDate();

  let html = '<div class="cal-grid">';
  // Day of week headers
  dows.forEach(d => { html += `<div class="cal-dow">${d}</div>`; });

  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLast - i;
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && d === todayDate;
    const dayTrades = dayMap[d] || [];
    const hasTrades = dayTrades.length > 0;

    let dayPnl = 0;
    let hasClosed = false;
    dayTrades.forEach(tr => {
      if (tr.status !== 'open') {
        const p = calcPnl(tr).pnl;
        dayPnl += p;
        hasClosed = true;
      }
    });

    const posClass = hasClosed ? (dayPnl >= 0 ? 'pos-day' : 'neg-day') : '';
    const todayClass = isToday ? 'today' : '';
    const tradeClass = hasTrades ? 'has-trades' : '';

    html += `<div class="cal-day ${todayClass} ${posClass} ${tradeClass}">`;
    html += `<div class="cal-day-num">${d}</div>`;

    if (hasTrades) {
      if (hasClosed) {
        const pnlCls = dayPnl >= 0 ? 'pos' : 'neg';
        html += `<div class="cal-day-pnl ${pnlCls}">${dayPnl >= 0 ? '+' : ''}${dayPnl.toFixed(2)}</div>`;
      }
      // Show dots for open trades
      const openCount = dayTrades.filter(tr => tr.status === 'open').length;
      const closedCount = dayTrades.filter(tr => tr.status !== 'open').length;
      if (openCount || closedCount) {
        html += '<div class="cal-day-trades">';
        if (closedCount) html += `<span class="cal-day-dot pos"></span>${closedCount}`;
        if (openCount) html += `<span class="cal-day-dot" style="background:var(--accent)"></span>${openCount}`;
        html += '</div>';
      }
      // Detail (show ticker + pnl per trade)
      html += '<div class="cal-day-detail">';
      dayTrades.forEach(tr => {
        if (tr.status !== 'open') {
          const p = calcPnl(tr).pnl;
          const cls = p >= 0 ? 'pos' : 'neg';
          html += `<div class="cal-day-detail-item"><span class="ticker">${escapeHtml(tr.ticker)}</span><span class="cal-day-pnl ${cls}">${p >= 0 ? '+' : ''}${p.toFixed(2)}</span></div>`;
        } else {
          html += `<div class="cal-day-detail-item"><span class="ticker">${escapeHtml(tr.ticker)}</span><span style="color:var(--accent);font-size:9px">open</span></div>`;
        }
      });
      html += '</div>';
    }

    html += '</div>';
  }

  // Fill remaining cells to complete the grid
  const totalCells = startDow + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderYearView(t) {
  const container = document.getElementById('calGridContainer');
  const today = new Date();
  const isCurrentYear = today.getFullYear() === calYear;
  const todayMonth = today.getMonth();
  const dows = DOW_SHORT[currentLang] || DOW_SHORT.en;

  // Build monthly PnL map
  const monthPnlMap = {};
  trades.filter(tr => tr.status !== 'open').forEach(tr => {
    if (!tr.date) return;
    const [y, m] = tr.date.split('-').map(Number);
    if (y === calYear) {
      if (!monthPnlMap[m]) monthPnlMap[m] = 0;
      monthPnlMap[m] += calcPnl(tr).pnl;
    }
  });

  let html = '<div class="cal-year-grid">';

  for (let m = 0; m < 12; m++) {
    const monthPnl = monthPnlMap[m + 1] || 0;
    const hasData = monthPnlMap[m + 1] !== undefined;
    const pnlCls = monthPnl >= 0 ? 'pos' : 'neg';
    const cardCls = hasData ? (monthPnl >= 0 ? 'pos-month' : 'neg-month') : '';

    html += `<div class="cal-year-card ${cardCls}" data-goto-month="${m}">`;
    html += '<div class="cal-year-card-head">';
    html += `<div class="cal-year-card-name">${t.months[m]}</div>`;
    if (hasData) {
      html += `<div class="cal-year-card-pnl ${pnlCls}">${monthPnl >= 0 ? '+' : ''}${monthPnl.toFixed(2)}</div>`;
    }
    html += '</div>';

    // Mini calendar
    const firstDow = (new Date(calYear, m, 1).getDay() + 6) % 7;
    const daysInM = new Date(calYear, m + 1, 0).getDate();

    html += '<div class="cal-year-mini">';
    dows.forEach(d => { html += `<div class="ym-dow">${d.slice(0,2)}</div>`; });
    for (let i = 0; i < firstDow; i++) {
      html += '<div class="ym-day ym-empty">·</div>';
    }
    for (let d = 1; d <= daysInM; d++) {
      const isTodayCell = isCurrentYear && m === todayMonth && d === today.getDate();
      html += `<div class="ym-day${isTodayCell ? ' ym-today' : ''}">${d}</div>`;
    }
    html += '</div>'; // cal-year-mini
    html += '</div>'; // cal-year-card
  }

  html += '</div>';
  container.innerHTML = html;

  // Wire click to navigate to month
  container.querySelectorAll('[data-goto-month]').forEach(card => {
    card.addEventListener('click', () => {
      calMonth = parseInt(card.dataset.gotoMonth);
      calView = 'month';
      document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-cal-view="month"]').classList.add('active');
      renderCalendar();
    });
  });
}
