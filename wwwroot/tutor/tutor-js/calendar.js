document.addEventListener('DOMContentLoaded', () => {
// Sessions
  const events = [];

  const EVENT_COLORS = ['purple', 'yellow', 'blue', 'green', 'pink'];
  const colorMap = {}; // learnerName → color so each student gets a consistent color
  let colorIndex = 0;

  function parseStartHour(timeStr) {
    if (!timeStr) return null;
    const part = timeStr.split('-')[0].trim(); // "4:00 PM"
    const [timePart, period] = part.split(' ');
    let [hours] = timePart.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours;
  }

  function parseDuration(timeStr) {
    if (!timeStr) return 1;
    const parts = timeStr.split('-');
    if (parts.length < 2) return 1;
    const start = parseStartHour(parts[0].trim() + ' ' + timeStr.split(' ')[1]);
    const end   = parseStartHour(parts[1].trim());
    if (start == null || end == null) return 1;
    return Math.max(1, end - start);
  }

  function loadBookingsIntoCalendar() {
    fetch('/Tutor/MyBookings')
      .then(r => r.json())
      .then(data => {
        events.length = 0; // clear any stale data
        data.forEach(b => {
          if (b.status.toLowerCase() !== 'confirmed') return; // only show confirmed

          const dateObj = new Date(b.date);
          const dateKey = [
            dateObj.getFullYear(),
            String(dateObj.getMonth() + 1).padStart(2, '0'),
            String(dateObj.getDate()).padStart(2, '0')
          ].join('-');

          const startHour = parseStartHour(b.time);
          if (startHour == null) return;
          if (!colorMap[b.learnerName]) {
            colorMap[b.learnerName] = EVENT_COLORS[colorIndex % EVENT_COLORS.length];
            colorIndex++;
          }

          events.push({
            date:      dateKey,
            startHour: startHour,
            duration:  1, // each booking takes 1 row
            student:   b.learnerName,
            subject:   b.subject,
            color:     colorMap[b.learnerName]
          });
        });
        render();
      })
      .catch(() => render()); // still render the empty grid on error
  }
// State
  let currentMonday = getMonday(new Date()); // start on the current week

  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // 8am-6pm
  const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
// Elements
  const dateRangeEl = document.getElementById('calDateRange');
  const prevBtn     = document.getElementById('calPrev');
  const nextBtn     = document.getElementById('calNext');
  const todayBtn    = document.getElementById('calToday');
  const gridEl      = document.getElementById('calGrid');
// Helpers
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getWeekDates(monday) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function formatDateRange(monday) {
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 6);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const mMonth = monthNames[monday.getMonth()];
    const fMonth = monthNames[friday.getMonth()];
    const mDay = monday.getDate();
    const fDay = friday.getDate();
    const year = friday.getFullYear();

    if (monday.getMonth() === friday.getMonth()) {
      return `${mMonth} ${mDay} - ${fDay}, ${year}`;
    } else {
      return `${mMonth} ${mDay} - ${fMonth} ${fDay}, ${year}`;
    }
  }

  function formatHour(h) {
    if (h === 12) return '12 pm';
    if (h > 12) return `${h - 12} pm`;
    return `${h} am`;
  }

  function getEventsForDate(dateKey) {
    return events.filter(e => e.date === dateKey);
  }
// Calendar
  function render() {
    if (!gridEl || !dateRangeEl) return;

    const weekDates = getWeekDates(currentMonday);
    dateRangeEl.textContent = formatDateRange(currentMonday);
    let html = '';
    html += '<div class="cal-corner"></div>';
    weekDates.forEach((d, i) => {
      const isToday = formatDateKey(d) === formatDateKey(new Date());
      html += `<div class="cal-header ${isToday ? 'cal-today-col' : ''}">
        <span class="cal-day-name">${DAY_NAMES[i]}</span>
        <span class="cal-day-num ${isToday ? 'cal-today-num' : ''}">${d.getDate()}</span>
      </div>`;
    });
    HOURS.forEach(hour => {
      html += `<div class="cal-time">${formatHour(hour)}</div>`;
      weekDates.forEach(d => {
        const dateKey = formatDateKey(d);
        const isToday = dateKey === formatDateKey(new Date());
        const cellEvents = getEventsForDate(dateKey).filter(e => e.startHour === hour);

        html += `<div class="cal-cell ${isToday ? 'cal-today-cell' : ''}">`;
        cellEvents.forEach(ev => {
          html += `<div class="cal-event cal-event-${ev.color}" style="height: ${ev.duration * 100}%;">
            <span class="cal-event-name">${ev.student}</span>
            <span class="cal-event-subject">Subject : ${ev.subject}</span>
          </div>`;
        });
        html += '</div>';
      });
    });

    gridEl.innerHTML = html;
  }
  loadBookingsIntoCalendar();
// Navigation
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonday.setDate(currentMonday.getDate() - 7);
      render();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonday.setDate(currentMonday.getDate() + 7);
      render();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentMonday = getMonday(new Date());
      render();
    });
  }
// Sidebar
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (sidebarOverlay) sidebarOverlay.classList.toggle('show');
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }
// Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });

});
