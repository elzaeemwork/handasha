/**
 * calendar.js - التقويم الدراسي الشامل
 * Monthly calendar with events from schedule, tasks, exams, and reminders
 * @module modules/calendar
 */

import { add, get, getAll, update, remove } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, bottomSheet, emptyState, loadingSpinner } from '../utils/ui.js';
import {
  formatDate,
  formatRelativeTime,
  getDayName,
  getMonthName,
  formatTime,
  getMonthCalendarGrid,
  isToday,
  isSameDay,
  toLocalISODate
} from '../utils/dates.js';
import { validateRequired, sanitizeHTML } from '../utils/validation.js';
import { formatNumber } from '../utils/formatting.js';

// Arabic week days starting from Saturday (matching getWeekStart)
const ARABIC_WEEKDAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const EVENT_TYPE_INFO = {
  schedule: { label: 'محاضرة', iconName: 'calendar', defaultColor: '#3657C8', badgeClass: 'badge-primary' },
  task: { label: 'واجب', iconName: 'check-square', defaultColor: '#E8A23A', badgeClass: 'badge-warning' },
  exam: { label: 'امتحان', iconName: 'file-text', defaultColor: '#D9534F', badgeClass: 'badge-error' },
  reminder: { label: 'تذكير', iconName: 'bell', defaultColor: '#24A58A', badgeClass: 'badge-success' }
};

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = new Date();
let container = null;
let allEvents = [];
let subjectsMap = new Map();

/**
 * Main render function called by the SPA router.
 * @param {HTMLElement} cont
 * @param {Object} [params]
 * @returns {Function} cleanup function
 */
export async function render(cont, params) {
  container = cont;
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  container.innerHTML = `
    <div class="calendar-container">
      <div style="padding: 40px 0; text-align: center;">${loadingSpinner()}</div>
    </div>
  `;

  // FAB Event Listener
  const fabHandler = (e) => {
    if (e.detail?.action === 'add-reminder') {
      const defaultDateStr = selectedDate ? toLocalISODate(selectedDate) : toLocalISODate(new Date());
      showReminderForm(null, defaultDateStr);
    }
  };
  window.addEventListener('fab-action', fabHandler);

  await loadAllEvents();
  renderCalendar();

  return () => {
    window.removeEventListener('fab-action', fabHandler);
  };
}

/**
 * Load all events across schedules, tasks, exams, and reminders.
 */
async function loadAllEvents() {
  allEvents = [];
  subjectsMap = new Map();

  try {
    const subjects = await getAll('subjects').catch(() => []);
    if (Array.isArray(subjects)) {
      subjects.forEach((s) => {
        if (s && s.id) subjectsMap.set(s.id, s);
      });
    }
  } catch (err) {
    console.warn('[CALENDAR] Failed to load subjects:', err);
  }

  // 1. Recurring weekly lectures from schedule
  try {
    const schedules = await getAll('schedule').catch(() => []);
    if (Array.isArray(schedules)) {
      for (const s of schedules) {
        const dWeek = s.dayOfWeek !== undefined ? Number(s.dayOfWeek) : Number(s.day);
        if (!isNaN(dWeek)) {
          const subj = s.subjectId ? subjectsMap.get(s.subjectId) : null;
          allEvents.push({
            type: 'schedule',
            title: s.title || (subj ? subj.name : 'محاضرة'),
            time: s.startTime || s.time || '',
            endTime: s.endTime || '',
            hall: s.hall || s.room || s.location || '',
            dayOfWeek: dWeek,
            recurring: true,
            subjectName: subj?.name || s.title || 'محاضرة',
            subjectColor: subj?.color || s.color || '#3657C8',
            raw: s
          });
        }
      }
    }
  } catch (err) {
    console.warn('[CALENDAR] Failed to load schedule:', err);
  }

  // 2. Tasks with deadlines
  try {
    const tasks = await getAll('tasks').catch(() => []);
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        const dateStr = t.deadline || t.dueDate;
        if (dateStr) {
          const subj = t.subjectId ? subjectsMap.get(t.subjectId) : null;
          allEvents.push({
            type: 'task',
            title: t.title || 'مهمة',
            date: dateStr.substring(0, 10),
            time: t.dueTime || t.time || '',
            status: t.status || 'pending',
            priority: t.priority || 'medium',
            subjectName: subj?.name || '',
            subjectColor: subj?.color || '#E8A23A',
            raw: t
          });
        }
      }
    }
  } catch (err) {
    console.warn('[CALENDAR] Failed to load tasks:', err);
  }

  // 3. Exams
  try {
    const exams = await getAll('exams').catch(() => []);
    if (Array.isArray(exams)) {
      for (const ex of exams) {
        if (ex.date) {
          const subj = ex.subjectId ? subjectsMap.get(ex.subjectId) : null;
          allEvents.push({
            type: 'exam',
            title: ex.title || (subj ? `امتحان ${subj.name}` : 'امتحان'),
            date: ex.date.substring(0, 10),
            time: ex.time || ex.startTime || '',
            hall: ex.hall || ex.room || '',
            examType: ex.type || 'quiz',
            subjectName: subj?.name || '',
            subjectColor: subj?.color || '#D9534F',
            raw: ex
          });
        }
      }
    }
  } catch (err) {
    console.warn('[CALENDAR] Failed to load exams:', err);
  }

  // 4. Reminders
  try {
    const reminders = await getAll('reminders').catch(() => []);
    if (Array.isArray(reminders)) {
      for (const r of reminders) {
        if (r.date) {
          allEvents.push({
            type: 'reminder',
            id: r.id,
            title: r.title || 'تذكير',
            date: r.date.substring(0, 10),
            time: r.time || '',
            notes: r.notes || '',
            subjectName: '',
            subjectColor: '#24A58A',
            raw: r
          });
        }
      }
    }
  } catch (err) {
    console.warn('[CALENDAR] Failed to load reminders:', err);
  }
}

/**
 * Filter events for a given Date object.
 * @param {Date} targetDate
 * @returns {Array} events
 */
function getEventsForDate(targetDate) {
  if (!targetDate || !(targetDate instanceof Date)) return [];
  const dateIso = toLocalISODate(targetDate);
  const dayOfWeek = targetDate.getDay();
  const result = [];

  for (const ev of allEvents) {
    if (ev.recurring && ev.dayOfWeek === dayOfWeek) {
      result.push(ev);
    } else if (ev.date && ev.date === dateIso) {
      result.push(ev);
    }
  }

  result.sort((a, b) => {
    const tA = a.time || '99:99';
    const tB = b.time || '99:99';
    return tA.localeCompare(tB);
  });

  return result;
}

/**
 * Get distinct event types present on a given Date.
 * @param {Date} date
 * @returns {string[]}
 */
function getEventDotsForDate(date) {
  const events = getEventsForDate(date);
  const types = new Set();
  for (const ev of events) {
    types.add(ev.type);
  }
  return Array.from(types);
}

/**
 * Render the whole monthly calendar view and event list.
 */
function renderCalendar() {
  if (!container) return;

  const grid = getMonthCalendarGrid(currentYear, currentMonth);
  const monthDate = new Date(currentYear, currentMonth, 1);
  const monthName = getMonthName(monthDate);
  const yearDisplay = formatNumber(currentYear);

  let html = `
    <div class="calendar-container">
      <!-- Calendar Card -->
      <div class="calendar-card">
        <!-- Calendar Header -->
        <div class="calendar-header">
          <div class="calendar-nav-group">
            <button class="cal-nav-btn" id="cal-next" title="الشهر القادم" aria-label="الشهر القادم">
              ${icon('chevron-right', 20)}
            </button>
            <button class="cal-today-btn" id="cal-today">اليوم</button>
          </div>
          <h2 class="calendar-month-title">
            <span>${sanitizeHTML(monthName)}</span>
            <span>${yearDisplay}</span>
          </h2>
          <div class="calendar-nav-group">
            <button class="cal-nav-btn" id="cal-prev" title="الشهر السابق" aria-label="الشهر السابق">
              ${icon('chevron-left', 20)}
            </button>
          </div>
        </div>

        <!-- Weekdays Header Row -->
        <div class="calendar-weekdays">
          ${ARABIC_WEEKDAYS.map((d) => `<div class="calendar-weekday">${d}</div>`).join('')}
        </div>

        <!-- Calendar Days Grid (6 weeks x 7 days) -->
        <div class="calendar-grid">
  `;

  for (const week of grid) {
    for (const cellDate of week) {
      const isCurrentMonth = cellDate.getMonth() === currentMonth;
      const isTodayCell = isToday(cellDate);
      const isSelectedCell = selectedDate && isSameDay(cellDate, selectedDate);
      const dots = getEventDotsForDate(cellDate);

      const classes = [
        'calendar-day-cell',
        isCurrentMonth ? '' : 'other-month',
        isTodayCell ? 'today' : '',
        isSelectedCell ? 'selected' : ''
      ].filter(Boolean).join(' ');

      const cellIso = toLocalISODate(cellDate);
      const dayNum = formatNumber(cellDate.getDate());

      const dotsHtml = dots.length > 0
        ? `<div class="calendar-dots">${dots
            .map((t) => {
              const color = EVENT_TYPE_INFO[t]?.defaultColor || '#999';
              return `<span class="calendar-dot" style="background:${color};"></span>`;
            })
            .join('')}</div>`
        : '';

      html += `
        <div class="${classes}" data-date="${cellIso}">
          <span class="calendar-day-number">${dayNum}</span>
          ${dotsHtml}
        </div>
      `;
    }
  }

  html += `
        </div>
      </div>

      <!-- Selected Day Events Section -->
      <div class="calendar-events-section" id="cal-events-section">
        ${renderDayEvents()}
      </div>
    </div>
  `;

  container.innerHTML = html;
  bindCalendarEvents();
}

/**
 * Render events list for the currently selected date.
 */
function renderDayEvents() {
  if (!selectedDate) {
    return `<div class="calendar-empty-card"><p>اضغط على يوم في التقويم لعرض جدول المحاضرات والمهام.</p></div>`;
  }

  const events = getEventsForDate(selectedDate);
  const formattedDateStr = formatDate(selectedDate);

  let html = `
    <div class="calendar-events-header">
      <h3 class="calendar-events-title">
        ${icon('calendar', 18)} ${formattedDateStr}
      </h3>
      <button class="btn btn-primary btn-sm" id="cal-add-reminder">
        ${icon('plus', 16)} إضافة تذكير
      </button>
    </div>
  `;

  if (events.length === 0) {
    html += `
      <div class="calendar-empty-card">
        <div style="font-size: 32px; opacity: 0.6;">🏖️</div>
        <p style="margin: 0; font-weight: 600; color: var(--color-text);">لا توجد أحداث أو مهام في هذا اليوم</p>
        <span style="font-size: 13px; color: var(--color-text-secondary);">يمكنك إضافة تذكير شخصي أو الاستراحة!</span>
      </div>
    `;
    return html;
  }

  html += `<div class="calendar-events-list">`;
  for (const ev of events) {
    const info = EVENT_TYPE_INFO[ev.type] || {
      label: ev.type,
      iconName: 'circle',
      defaultColor: '#3657C8',
      badgeClass: 'badge-neutral'
    };
    const accentColor = ev.subjectColor || info.defaultColor;
    const timeDisplay = ev.time ? (ev.endTime ? `${ev.time} - ${ev.endTime}` : ev.time) : '';
    const isReminder = ev.type === 'reminder';

    html += `
      <div class="calendar-event-card" style="border-right: 4px solid ${accentColor};">
        <div class="calendar-event-icon" style="background: ${accentColor}18; color: ${accentColor};">
          ${icon(info.iconName, 20)}
        </div>
        <div class="calendar-event-info">
          <div class="calendar-event-title">${sanitizeHTML(ev.title)}</div>
          <div class="calendar-event-meta">
            <span class="badge ${info.badgeClass} calendar-event-badge">${info.label}</span>
            ${ev.subjectName ? `<span>${sanitizeHTML(ev.subjectName)}</span>` : ''}
            ${timeDisplay ? `<span>⏰ ${timeDisplay}</span>` : ''}
            ${ev.hall ? `<span>📍 ${sanitizeHTML(ev.hall)}</span>` : ''}
            ${ev.notes ? `<span>📝 ${sanitizeHTML(ev.notes)}</span>` : ''}
          </div>
        </div>
        ${isReminder ? `
          <div class="calendar-event-actions">
            <button class="cal-event-btn cal-edit-reminder" data-id="${ev.id}" title="تعديل" aria-label="تعديل">${icon('edit', 18)}</button>
            <button class="cal-event-btn danger cal-delete-reminder" data-id="${ev.id}" title="حذف" aria-label="حذف">${icon('trash', 18)}</button>
          </div>
        ` : ''}
      </div>
    `;
  }
  html += `</div>`;

  return html;
}

/**
 * Bind DOM click handlers for navigation, date selection, reminders.
 */
function bindCalendarEvents() {
  const prevBtn = container.querySelector('#cal-prev');
  const nextBtn = container.querySelector('#cal-next');
  const todayBtn = container.querySelector('#cal-today');
  const addReminderBtn = container.querySelector('#cal-add-reminder');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
      selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      renderCalendar();
    });
  }

  if (addReminderBtn) {
    addReminderBtn.addEventListener('click', () => {
      const defaultDateStr = selectedDate ? toLocalISODate(selectedDate) : toLocalISODate(new Date());
      showReminderForm(null, defaultDateStr);
    });
  }

  // Day cell click handlers
  const dayCells = container.querySelectorAll('.calendar-day-cell[data-date]');
  dayCells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      if (dateStr) {
        const parts = dateStr.split('-').map(Number);
        selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);

        // If clicked day is from another month, transition to that month
        if (selectedDate.getMonth() !== currentMonth) {
          currentYear = selectedDate.getFullYear();
          currentMonth = selectedDate.getMonth();
        }

        renderCalendar();
      }
    });
  });

  // Reminder Edit Buttons
  const editBtns = container.querySelectorAll('.cal-edit-reminder');
  editBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        const reminder = await get('reminders', id);
        if (reminder) {
          showReminderForm(reminder);
        }
      } catch (err) {
        toast('حدث خطأ أثناء تحميل التذكير', 'error');
      }
    });
  });

  // Reminder Delete Buttons
  const deleteBtns = container.querySelectorAll('.cal-delete-reminder');
  deleteBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const confirmed = await confirm('حذف التذكير', 'هل أنت متأكد من رغبتك في حذف هذا التذكير؟', 'حذف', 'إلغاء', true);
      if (confirmed) {
        try {
          await remove('reminders', id);
          await loadAllEvents();
          toast('تم حذف التذكير بنجاح', 'success');
          renderCalendar();
        } catch (err) {
          toast('حدث خطأ أثناء حذف التذكير', 'error');
        }
      }
    });
  });
}

/**
 * Open form modal to create or update a reminder.
 * @param {Object} [existing]
 * @param {string} [defaultDate]
 */
function showReminderForm(existing, defaultDate) {
  const isEdit = !!existing;
  const title = isEdit ? 'تعديل التذكير' : 'إضافة تذكير جديد';

  const initialDate = existing?.date || defaultDate || toLocalISODate(new Date());
  const initialTime = existing?.time || '';
  const initialTitle = existing?.title || '';
  const initialNotes = existing?.notes || '';

  const formEl = document.createElement('form');
  formEl.id = 'reminder-form';
  formEl.className = 'form';
  formEl.style.cssText = 'display: flex; flex-direction: column; gap: 14px;';
  formEl.innerHTML = `
    <div class="form-group" style="margin: 0;">
      <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
        عنوان التذكير <span style="color: var(--color-danger, #D9534F);">*</span>
      </label>
      <input type="text" id="reminder-title" class="form-input" value="${sanitizeHTML(initialTitle)}" placeholder="مثال: تسليم تقرير المختبر" required autofocus />
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
          التاريخ <span style="color: var(--color-danger, #D9534F);">*</span>
        </label>
        <input type="date" id="reminder-date" class="form-input" value="${initialDate}" required />
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
          الوقت
        </label>
        <input type="time" id="reminder-time" class="form-input" value="${initialTime}" />
      </div>
    </div>

    <div class="form-group" style="margin: 0;">
      <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
        ملاحظات إضافية
      </label>
      <textarea id="reminder-notes" class="form-input form-textarea" rows="3" placeholder="أي تفاصيل تود تذكرها...">${sanitizeHTML(initialNotes)}</textarea>
    </div>
  `;

  modal({
    title,
    content: formEl,
    confirmText: isEdit ? 'حفظ التعديلات' : 'إضافة',
    cancelText: 'إلغاء',
    onConfirm: async () => {
      const titleVal = formEl.querySelector('#reminder-title').value.trim();
      const dateVal = formEl.querySelector('#reminder-date').value;
      const timeVal = formEl.querySelector('#reminder-time').value;
      const notesVal = formEl.querySelector('#reminder-notes').value.trim();

      const tCheck = validateRequired(titleVal, 'عنوان التذكير');
      if (!tCheck.valid) {
        toast(tCheck.error, 'warning');
        return false;
      }

      const dCheck = validateRequired(dateVal, 'تاريخ التذكير');
      if (!dCheck.valid) {
        toast(dCheck.error, 'warning');
        return false;
      }

      // Compute remindAt timestamp
      let remindAt = null;
      if (dateVal) {
        const timePart = timeVal || '09:00';
        remindAt = new Date(`${dateVal}T${timePart}:00`).getTime();
      }

      const reminderData = {
        title: titleVal,
        date: dateVal,
        time: timeVal || '',
        notes: notesVal,
        remindAt: remindAt || Date.now(),
        isFired: false,
        updatedAt: new Date().toISOString()
      };

      try {
        if (isEdit) {
          await update('reminders', { ...existing, ...reminderData });
          toast('تم تحديث التذكير بنجاح', 'success');
        } else {
          reminderData.id = 'rem_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          reminderData.createdAt = new Date().toISOString();
          await add('reminders', reminderData);
          toast('تمت إضافة التذكير بنجاح', 'success');
        }

        // Set selectedDate to the reminder's date so user immediately sees it
        const parts = dateVal.split('-').map(Number);
        selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        currentYear = selectedDate.getFullYear();
        currentMonth = selectedDate.getMonth();

        await loadAllEvents();
        renderCalendar();
        return true;
      } catch (err) {
        console.error('Error saving reminder:', err);
        toast('حدث خطأ أثناء حفظ التذكير', 'error');
        return false;
      }
    }
  });
}
