/**
 * calendar.js - التقويم
 * Monthly calendar with events from schedule, tasks, exams, and reminders
 */

import { add, get, getAll, update, remove, getAllFromIndex } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, bottomSheet, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatDate, formatRelativeTime, getDayName, getMonthName, formatTime, getMonthCalendarGrid, isToday } from '../utils/dates.js';
import { validateRequired, sanitizeHTML } from '../utils/validation.js';
import { formatNumber } from '../utils/formatting.js';

const ARABIC_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const EVENT_TYPE_ICONS = {
  schedule: 'calendar',
  task: 'check-square',
  exam: 'file-text',
  reminder: 'bell'
};
const EVENT_TYPE_LABELS = {
  schedule: 'محاضرة',
  task: 'مهمة',
  exam: 'اختبار',
  reminder: 'تذكير'
};

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null;
let container = null;
let allEvents = [];

export async function render(cont, params) {
  container = cont;
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDate = null;

  container.innerHTML = loadingSpinner();
  allEvents = await loadAllEvents();
  renderCalendar();
}

async function loadAllEvents() {
  const events = [];

  try {
    const schedules = await getAll('schedule');
    if (schedules && schedules.length) {
      for (const s of schedules) {
        const dWeek = s.dayOfWeek !== undefined ? s.dayOfWeek : s.day;
        if (dWeek !== undefined && s.startTime) {
          events.push({
            type: 'schedule',
            title: s.title || s.subject || 'محاضرة',
            time: s.startTime,
            dayOfWeek: Number(dWeek),
            recurring: true,
            subjectColor: s.color || '#4ECDC4',
            raw: s
          });
        }
      }
    }
  } catch (e) { /* store may not exist */ }

  try {
    const tasks = await getAll('tasks');
    if (tasks && tasks.length) {
      for (const t of tasks) {
        if (t.deadline || t.dueDate) {
          const dateStr = t.deadline || t.dueDate;
          events.push({
            type: 'task',
            title: t.title || 'مهمة',
            date: dateStr,
            time: t.dueTime || t.time || '',
            subjectColor: t.color || '#FFE66D',
            raw: t
          });
        }
      }
    }
  } catch (e) { /* store may not exist */ }

  try {
    const exams = await getAll('exams');
    if (exams && exams.length) {
      for (const ex of exams) {
        if (ex.date) {
          events.push({
            type: 'exam',
            title: ex.title || ex.subject || 'اختبار',
            date: ex.date,
            time: ex.time || ex.startTime || '',
            subjectColor: ex.color || '#FF6B6B',
            raw: ex
          });
        }
      }
    }
  } catch (e) { /* store may not exist */ }

  try {
    const reminders = await getAll('reminders');
    if (reminders && reminders.length) {
      for (const r of reminders) {
        if (r.date) {
          events.push({
            type: 'reminder',
            title: r.title || 'تذكير',
            date: r.date,
            time: r.time || '',
            subjectColor: r.color || '#C44DFF',
            id: r.id,
            raw: r
          });
        }
      }
    }
  } catch (e) { /* store may not exist */ }

  return events;
}

function getEventsForDate(year, month, day) {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dateObj = new Date(year, month, day);
  const dayOfWeek = dateObj.getDay();
  const result = [];

  for (const ev of allEvents) {
    if (ev.recurring && ev.dayOfWeek === dayOfWeek) {
      result.push(ev);
    } else if (ev.date) {
      const evDate = ev.date.substring(0, 10);
      if (evDate === dateStr) {
        result.push(ev);
      }
    }
  }

  result.sort((a, b) => {
    const tA = a.time || '99:99';
    const tB = b.time || '99:99';
    return tA.localeCompare(tB);
  });

  return result;
}

function hasEventsOnDate(year, month, day) {
  return getEventsForDate(year, month, day).length > 0;
}

function getEventDotsForDate(year, month, day) {
  const events = getEventsForDate(year, month, day);
  const types = new Set();
  for (const ev of events) {
    types.add(ev.type);
  }
  return Array.from(types);
}

function renderCalendar() {
  const grid = getMonthCalendarGrid(currentYear, currentMonth);
  const monthName = getMonthName(currentMonth);

  let html = `
    <div class="calendar-page">
      <div class="calendar-header">
        <button class="cal-nav-btn" id="cal-next">${icon('chevron-right')}</button>
        <h2 class="cal-month-title">${sanitizeHTML(monthName)} ${formatNumber(currentYear)}</h2>
        <button class="cal-nav-btn" id="cal-prev">${icon('chevron-left')}</button>
      </div>

      <div class="calendar-grid">
        <div class="cal-day-names">
          ${ARABIC_DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        </div>
        <div class="cal-days">
  `;

  for (const week of grid) {
    for (const cell of week) {
      if (!cell || cell.day === 0) {
        html += `<div class="cal-day cal-day-empty"></div>`;
      } else {
        const isTodayClass = isToday(new Date(currentYear, currentMonth, cell.day)) ? 'cal-day-today' : '';
        const isSelected = selectedDate &&
          selectedDate.year === currentYear &&
          selectedDate.month === currentMonth &&
          selectedDate.day === cell.day ? 'cal-day-selected' : '';
        const dots = getEventDotsForDate(currentYear, currentMonth, cell.day);
        const dotsHtml = dots.length > 0 ? `<div class="cal-dots">${dots.map(t => {
          const colorMap = { schedule: '#4ECDC4', task: '#FFE66D', exam: '#FF6B6B', reminder: '#C44DFF' };
          return `<span class="cal-dot" style="background:${colorMap[t] || '#999'}"></span>`;
        }).join('')}</div>` : '';

        html += `<div class="cal-day ${isTodayClass} ${isSelected}" data-day="${cell.day}">
          <span class="cal-day-num">${formatNumber(cell.day)}</span>
          ${dotsHtml}
        </div>`;
      }
    }
  }

  html += `
        </div>
      </div>

      <div class="cal-actions">
        <button class="btn btn-primary btn-sm" id="cal-add-reminder">
          ${icon('plus')} إضافة تذكير
        </button>
      </div>

      <div class="cal-events-section" id="cal-events-section">
        ${selectedDate ? renderDayEvents() : '<p class="cal-hint">اضغط على يوم لعرض أحداثه</p>'}
      </div>
    </div>
  `;

  container.innerHTML = html;
  bindCalendarEvents();
}

function renderDayEvents() {
  if (!selectedDate) return '';
  const events = getEventsForDate(selectedDate.year, selectedDate.month, selectedDate.day);
  const dateStr = `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`;
  const dateObj = new Date(selectedDate.year, selectedDate.month, selectedDate.day);
  const dayName = getDayName(dateObj.getDay());

  let html = `<h3 class="cal-events-title">${sanitizeHTML(dayName)} - ${formatDate(dateStr)}</h3>`;

  if (events.length === 0) {
    html += `<p class="cal-no-events">لا توجد أحداث في هذا اليوم</p>`;
    return html;
  }

  html += `<div class="cal-events-list">`;
  for (const ev of events) {
    const typeIcon = EVENT_TYPE_ICONS[ev.type] || 'circle';
    const typeLabel = EVENT_TYPE_LABELS[ev.type] || ev.type;
    const timeDisplay = ev.time ? formatTime(ev.time) : '';
    const isReminder = ev.type === 'reminder';

    html += `
      <div class="cal-event-card" style="border-right: 3px solid ${ev.subjectColor}">
        <div class="cal-event-icon" style="color: ${ev.subjectColor}">${icon(typeIcon)}</div>
        <div class="cal-event-info">
          <div class="cal-event-title">${sanitizeHTML(ev.title)}</div>
          <div class="cal-event-meta">
            <span class="cal-event-type">${sanitizeHTML(typeLabel)}</span>
            ${timeDisplay ? `<span class="cal-event-time">${timeDisplay}</span>` : ''}
          </div>
        </div>
        ${isReminder ? `
          <div class="cal-event-actions">
            <button class="btn-icon cal-edit-reminder" data-id="${ev.id}" title="تعديل">${icon('edit')}</button>
            <button class="btn-icon cal-delete-reminder" data-id="${ev.id}" title="حذف">${icon('trash')}</button>
          </div>
        ` : ''}
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

function bindCalendarEvents() {
  const prevBtn = container.querySelector('#cal-prev');
  const nextBtn = container.querySelector('#cal-next');
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

  if (addReminderBtn) {
    addReminderBtn.addEventListener('click', () => {
      const defaultDate = selectedDate
        ? `${selectedDate.year}-${String(selectedDate.month + 1).padStart(2, '0')}-${String(selectedDate.day).padStart(2, '0')}`
        : new Date().toISOString().substring(0, 10);
      showReminderForm(null, defaultDate);
    });
  }

  const dayCells = container.querySelectorAll('.cal-day[data-day]');
  dayCells.forEach(cell => {
    cell.addEventListener('click', () => {
      const day = parseInt(cell.dataset.day, 10);
      selectedDate = { year: currentYear, month: currentMonth, day };
      renderCalendar();
    });
  });

  const editBtns = container.querySelectorAll('.cal-edit-reminder');
  editBtns.forEach(btn => {
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

  const deleteBtns = container.querySelectorAll('.cal-delete-reminder');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const confirmed = await confirm('هل تريد حذف هذا التذكير؟');
      if (confirmed) {
        try {
          await remove('reminders', id);
          allEvents = await loadAllEvents();
          toast('تم حذف التذكير', 'success');
          renderCalendar();
        } catch (err) {
          toast('حدث خطأ أثناء الحذف', 'error');
        }
      }
    });
  });
}

function showReminderForm(existing, defaultDate) {
  const isEdit = !!existing;
  const title = isEdit ? 'تعديل التذكير' : 'إضافة تذكير';

  const content = `
    <form id="reminder-form" class="form">
      <div class="form-group">
        <label class="form-label">العنوان <span class="required">*</span></label>
        <input type="text" id="reminder-title" class="form-input" value="${isEdit ? sanitizeHTML(existing.title || '') : ''}" placeholder="عنوان التذكير" required>
      </div>
      <div class="form-group">
        <label class="form-label">التاريخ <span class="required">*</span></label>
        <input type="date" id="reminder-date" class="form-input" value="${isEdit ? (existing.date || '') : (defaultDate || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">الوقت</label>
        <input type="time" id="reminder-time" class="form-input" value="${isEdit ? (existing.time || '') : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea id="reminder-notes" class="form-input form-textarea" rows="3" placeholder="ملاحظات إضافية...">${isEdit ? sanitizeHTML(existing.notes || '') : ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? 'تحديث' : 'إضافة'}</button>
        <button type="button" class="btn btn-secondary" id="reminder-cancel">إلغاء</button>
      </div>
    </form>
  `;

  const modalEl = modal(title, content);

  const form = document.getElementById('reminder-form');
  const cancelBtn = document.getElementById('reminder-cancel');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (modalEl && typeof modalEl.close === 'function') modalEl.close();
      else document.querySelector('.modal-overlay')?.remove();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleVal = document.getElementById('reminder-title').value.trim();
      const dateVal = document.getElementById('reminder-date').value;
      const timeVal = document.getElementById('reminder-time').value;
      const notesVal = document.getElementById('reminder-notes').value.trim();

      const tCheck = validateRequired(titleVal, 'عنوان التذكير');
      if (!tCheck.valid) {
        toast(tCheck.error, 'warning');
        return;
      }
      const dCheck = validateRequired(dateVal, 'التاريخ');
      if (!dCheck.valid) {
        toast(dCheck.error, 'warning');
        return;
      }

      const reminderData = {
        title: titleVal,
        date: dateVal,
        time: timeVal || '',
        notes: notesVal,
        fired: false,
        updatedAt: new Date().toISOString()
      };

      try {
        if (isEdit) {
          await update('reminders', { ...existing, ...reminderData });
          toast('تم تحديث التذكير', 'success');
        } else {
          reminderData.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
          reminderData.createdAt = new Date().toISOString();
          await add('reminders', reminderData);
          toast('تم إضافة التذكير', 'success');
        }

        if (modalEl && typeof modalEl.close === 'function') modalEl.close();
        else document.querySelector('.modal-overlay')?.remove();

        allEvents = await loadAllEvents();
        renderCalendar();
      } catch (err) {
        toast('حدث خطأ أثناء الحفظ', 'error');
      }
    });
  }
}
