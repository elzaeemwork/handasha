/**
 * dashboard.js - الرئيسية
 * Main dashboard module showing today's overview, upcoming deadlines, and study progress
 */
import { getAll, query, getAllFromIndex } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatDate, formatRelativeTime, getDayName, formatTime, daysRemaining, isToday, formatCountdown } from '../utils/dates.js';
import { sanitizeHTML } from '../utils/validation.js';
import { formatNumber, truncateText } from '../utils/formatting.js';

/**
 * Get Arabic greeting based on time of day
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'مساء الخير 🌙';
  if (hour < 12) return 'صباح الخير ☀️';
  if (hour < 17) return 'مرحبًا 👋';
  return 'مساء الخير 🌙';
}

/**
 * Get today's day index (0=Sunday)
 */
function getTodayDayIndex() {
  return new Date().getDay();
}

/**
 * Calculate study progress for the current week
 */
function calculateWeekProgress(tasks) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const weekTasks = tasks.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d >= startOfWeek && d < endOfWeek;
  });

  const completed = weekTasks.filter(t => t.status === 'completed').length;
  return { completed, total: weekTasks.length };
}

/**
 * Get tasks due in the next N days (not completed)
 */
function getUpcomingDeadlines(tasks, days = 3) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() + days);

  return tasks
    .filter(t => {
      if (!t.deadline || t.status === 'completed') return false;
      const d = new Date(t.deadline);
      return d >= now && d <= cutoff;
    })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

/**
 * Get overdue tasks
 */
function getOverdueTasks(tasks) {
  const now = new Date();
  return tasks.filter(t => {
    if (!t.deadline || t.status === 'completed') return false;
    return new Date(t.deadline) < now;
  });
}

/**
 * Render a summary card
 */
function renderSummaryCard(iconName, label, value, color, onClick) {
  const card = document.createElement('div');
  card.className = 'summary-card';
  card.style.cssText = `
    background: var(--color-surface, #fff);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
    cursor: ${onClick ? 'pointer' : 'default'};
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    border: 1px solid var(--color-border, #e8ecf2);
    transition: transform 0.15s ease;
  `;
  card.innerHTML = `
    <div style="width: 40px; height: 40px; border-radius: 12px; background: ${color}15;
                display: flex; align-items: center; justify-content: center;">
      <span style="color: ${color}; font-size: 20px;">${icon(iconName)}</span>
    </div>
    <span class="tabular-digits" style="font-size: 22px; font-weight: 700; color: var(--color-text, #1a1a2e);">${sanitizeHTML(String(value))}</span>
    <span style="font-size: 12px; color: var(--color-text-secondary, #6b7280); text-align: center;">${sanitizeHTML(label)}</span>
  `;
  if (onClick) {
    card.addEventListener('click', onClick);
    card.addEventListener('pointerdown', () => { card.style.transform = 'scale(0.96)'; });
    card.addEventListener('pointerup', () => { card.style.transform = ''; });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
  return card;
}

/**
 * Render Quick Access Strip for frequent engineering tools
 */
function renderQuickAccessStrip() {
  const strip = document.createElement('div');
  strip.className = 'quick-access-strip';
  strip.setAttribute('role', 'toolbar');
  strip.setAttribute('aria-label', 'أدوات الوصول السريع');

  const tools = [
    { label: 'مؤقت التركيز', route: '#/focus-timer', iconClass: 'focus-gradient', iconSvg: icon('timer', 18) },
    { label: 'حاسبة هندسية', route: '#/calculator', iconClass: 'calc-gradient', iconSvg: icon('calculator', 18) },
    { label: 'تدوين ملاحظة', route: '#/notes', iconClass: 'note-gradient', iconSvg: icon('note', 18) },
    { label: 'خريطة مفاهيم', route: '#/mindmaps', iconClass: 'map-gradient', iconSvg: icon('brain', 18) },
  ];

  strip.innerHTML = tools.map(t => `
    <button class="quick-pill" data-route="${t.route}" aria-label="${t.label}">
      <div class="quick-pill-icon ${t.iconClass}">
        ${t.iconSvg}
      </div>
      <span class="quick-pill-label">${t.label}</span>
    </button>
  `).join('');

  strip.querySelectorAll('.quick-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.route;
    });
  });

  return strip;
}

/**
 * Render today's schedule section
 */
function renderTodaySchedule(lectures, subjects) {
  const section = document.createElement('section');
  section.className = 'dashboard-section';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
  header.innerHTML = `
    <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text, #1a1a2e); margin: 0;">
      ${icon('calendar')} جدول اليوم
    </h2>
    <a href="#/schedule" style="font-size: 13px; color: var(--color-primary, #3657C8); text-decoration: none;">عرض الكل</a>
  `;
  section.appendChild(header);

  if (lectures.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = `
      background: var(--color-surface, #fff); border-radius: 16px; padding: 24px;
      text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid var(--color-border, #e8ecf2);
    `;
    empty.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
      <p style="color: var(--color-text-secondary, #6b7280); margin: 0 0 12px;">لا توجد محاضرات اليوم</p>
      <a href="#/schedule" style="color: var(--color-primary, #3657C8); font-size: 14px; text-decoration: none;">
        إضافة محاضرة +
      </a>
    `;
    section.appendChild(empty);
    return section;
  }

  const subjectMap = {};
  subjects.forEach(s => { subjectMap[s.id] = s; });

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  lectures.forEach(lec => {
    const subj = subjectMap[lec.subjectId] || {};
    const color = subj.color || '#3657C8';
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--color-surface, #fff); border-radius: 12px; padding: 14px 16px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid var(--color-border, #e8ecf2);
      border-right: 4px solid ${color};
      cursor: pointer;
    `;
    card.addEventListener('click', () => {
      if (lec.subjectId) window.location.hash = `#/subjects/${lec.subjectId}`;
    });

    const startTime = lec.startTime || '';
    const endTime = lec.endTime || '';
    const typeBadge = lec.type ? `<span style="font-size: 10px; padding: 2px 8px; border-radius: 8px;
      background: ${color}15; color: ${color};">${sanitizeHTML(lec.type)}</span>` : '';

    card.innerHTML = `
      <div style="min-width: 50px; text-align: center;">
        <div style="font-size: 14px; font-weight: 700; color: ${color};">${sanitizeHTML(startTime)}</div>
        <div style="font-size: 11px; color: var(--color-text-secondary, #6b7280);">${sanitizeHTML(endTime)}</div>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 15px; font-weight: 600; color: var(--color-text, #1a1a2e); margin-bottom: 4px;">
          ${sanitizeHTML(subj.name || 'مادة غير معروفة')}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${lec.location ? `<span style="font-size: 12px; color: var(--color-text-secondary, #6b7280);">${icon('location')} ${sanitizeHTML(lec.location)}</span>` : ''}
          ${typeBadge}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  section.appendChild(list);
  return section;
}

/**
 * Render upcoming deadlines section
 */
function renderDeadlines(upcoming, overdue, subjects) {
  const section = document.createElement('section');
  section.className = 'dashboard-section';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
  header.innerHTML = `
    <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text, #1a1a2e); margin: 0;">
      ${icon('alert')} لا تنسَ
    </h2>
    <a href="#/tasks" style="font-size: 13px; color: var(--color-primary, #3657C8); text-decoration: none;">عرض المهام</a>
  `;
  section.appendChild(header);

  const allItems = [...overdue, ...upcoming];
  if (allItems.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = `
      background: var(--color-surface, #fff); border-radius: 16px; padding: 24px;
      text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid var(--color-border, #e8ecf2);
    `;
    empty.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
      <p style="color: var(--color-text-secondary, #6b7280); margin: 0;">لا توجد مهام قريبة — أحسنت!</p>
    `;
    section.appendChild(empty);
    return section;
  }

  const subjectMap = {};
  subjects.forEach(s => { subjectMap[s.id] = s; });

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  allItems.slice(0, 5).forEach(task => {
    const subj = subjectMap[task.subjectId] || {};
    const isOverdue = overdue.includes(task);
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--color-surface, #fff); border-radius: 12px; padding: 14px 16px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid ${isOverdue ? '#ef444450' : 'var(--color-border, #e8ecf2)'};
      cursor: pointer;
    `;
    card.addEventListener('click', () => { window.location.hash = '#/tasks'; });

    const priorityColors = { 'عالية': '#ef4444', 'متوسطة': '#f59e0b', 'منخفضة': '#22c55e' };
    const pColor = priorityColors[task.priority] || '#6b7280';

    card.innerHTML = `
      <div style="width: 4px; height: 36px; border-radius: 2px; background: ${pColor}; flex-shrink: 0;"></div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 14px; font-weight: 600; color: var(--color-text, #1a1a2e); margin-bottom: 4px;">
          ${sanitizeHTML(task.title || '')}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${subj.name ? `<span style="font-size: 11px; padding: 2px 8px; border-radius: 8px;
            background: ${subj.color || '#3657C8'}15; color: ${subj.color || '#3657C8'};">${sanitizeHTML(subj.name)}</span>` : ''}
          ${isOverdue
            ? `<span style="font-size: 11px; color: #ef4444; font-weight: 600;">متأخرة</span>`
            : `<span style="font-size: 11px; color: var(--color-text-secondary, #6b7280);">${formatRelativeTime(task.deadline)}</span>`
          }
        </div>
      </div>
      ${isOverdue ? `<span style="font-size: 18px;">⚠️</span>` : ''}
    `;
    list.appendChild(card);
  });

  section.appendChild(list);
  return section;
}

/**
 * Render study progress section
 */
function renderProgress(progress) {
  const section = document.createElement('section');
  section.className = 'dashboard-section';

  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: 12px;';
  header.innerHTML = `
    <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text, #1a1a2e); margin: 0;">
      ${icon('chart')} تقدّم هذا الأسبوع
    </h2>
  `;
  section.appendChild(header);

  if (progress.total === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = `
      background: var(--color-surface, #fff); border-radius: 16px; padding: 24px;
      text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid var(--color-border, #e8ecf2);
    `;
    empty.innerHTML = `
      <p style="color: var(--color-text-secondary, #6b7280); margin: 0;">لا توجد مهام مجدولة لهذا الأسبوع</p>
    `;
    section.appendChild(empty);
    return section;
  }

  const pct = Math.round((progress.completed / progress.total) * 100);
  const card = document.createElement('div');
  card.style.cssText = `
    background: var(--color-surface, #fff); border-radius: 16px; padding: 18px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    border: 1px solid var(--color-border, #e8ecf2);
  `;
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 14px; color: var(--color-text, #1a1a2e);">
        ${formatNumber(progress.completed)} من ${formatNumber(progress.total)} مهمة
      </span>
      <span style="font-size: 14px; font-weight: 700; color: var(--color-primary, #3657C8);">${pct}%</span>
    </div>
    <div style="height: 8px; background: var(--color-border, #e8ecf2); border-radius: 4px; overflow: hidden;">
      <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #3657C8, #5B7FFF);
                  border-radius: 4px; transition: width 0.6s ease;"></div>
    </div>
  `;
  section.appendChild(card);
  return section;
}

/**
 * Render continue studying section
 */
function renderContinueStudying(settings, subjects) {
  const lastSubjectId = settings?.lastOpenedSubjectId;
  if (!lastSubjectId) return null;

  const subj = subjects.find(s => s.id === lastSubjectId);
  if (!subj) return null;

  const section = document.createElement('section');
  section.className = 'dashboard-section';

  const card = document.createElement('div');
  card.style.cssText = `
    background: linear-gradient(135deg, ${subj.color || '#3657C8'}, ${subj.color || '#3657C8'}CC);
    border-radius: 16px; padding: 18px; cursor: pointer;
    box-shadow: 0 2px 8px ${subj.color || '#3657C8'}30;
  `;
  card.addEventListener('click', () => {
    window.location.hash = `#/subjects/${subj.id}`;
  });
  card.innerHTML = `
    <div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-bottom: 6px;">${icon('book')} تابع دراستك</div>
    <div style="color: #fff; font-size: 17px; font-weight: 700;">${sanitizeHTML(subj.name)}</div>
    ${subj.instructor ? `<div style="color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px;">${sanitizeHTML(subj.instructor)}</div>` : ''}
  `;
  section.appendChild(card);
  return section;
}

/**
 * Main render function
 */
export async function render(container, params) {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'padding: 16px 16px 100px; max-width: 600px; margin: 0 auto;';
  wrapper.appendChild(loadingSpinner());
  container.appendChild(wrapper);

  try {
    // Load all data in parallel
    const [subjects, tasks, lectures, exams, settingsArr] = await Promise.all([
      getAll('subjects').catch(() => []),
      getAll('tasks').catch(() => []),
      getAll('schedule').catch(() => []),
      getAll('exams').catch(() => []),
      getAll('settings').catch(() => [])
    ]);

    // Build settings map
    const settings = {};
    settingsArr.forEach(s => { settings[s.key || s.id] = s.value !== undefined ? s.value : s; });

    wrapper.innerHTML = '';

    // Greeting header
    const greetingEl = document.createElement('div');
    greetingEl.style.cssText = 'margin-bottom: 20px;';
    const today = new Date();
    greetingEl.innerHTML = `
      <h1 style="font-size: 24px; font-weight: 800; color: var(--color-text, #1a1a2e); margin: 0 0 4px;">
        ${getGreeting()}
      </h1>
      <p style="font-size: 14px; color: var(--color-text-secondary, #6b7280); margin: 0;">
        ${formatDate(today)}
      </p>
    `;
    wrapper.appendChild(greetingEl);

    // Quick Access Strip (1-tap access to primary student tools)
    wrapper.appendChild(renderQuickAccessStrip());

    // Summary cards (responsive 2x2 on mobile, 4-col on desktop)
    const todayDayIndex = getTodayDayIndex();
    const todayLectures = lectures
      .filter(l => !l.archived && ((l.dayOfWeek !== undefined ? Number(l.dayOfWeek) : Number(l.day)) === todayDayIndex))
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    const pendingTasks = tasks.filter(t => t.status !== 'completed');

    // Next exam
    const now = new Date();
    const upcomingExams = exams
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const nextExam = upcomingExams[0];
    const examCountdown = nextExam ? daysRemaining(nextExam.date) : null;

    // Notifications count (overdue tasks + exams within 2 days)
    const overdueTasks = getOverdueTasks(tasks);
    const urgentExams = upcomingExams.filter(e => {
      const d = daysRemaining(e.date);
      return d !== null && d <= 2;
    });
    const notifCount = overdueTasks.length + urgentExams.length;

    const cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 24px;';

    cardsRow.appendChild(renderSummaryCard('calendar', 'محاضرات اليوم', todayLectures.length, '#3657C8',
      () => { window.location.hash = '#/schedule'; }));
    cardsRow.appendChild(renderSummaryCard('task', 'مهام معلّقة', pendingTasks.length, '#f59e0b',
      () => { window.location.hash = '#/tasks'; }));
    cardsRow.appendChild(renderSummaryCard('exam', 'أقرب امتحان',
      examCountdown !== null ? `${examCountdown} يوم` : '—', '#ef4444',
      () => { window.location.hash = '#/exams'; }));
    cardsRow.appendChild(renderSummaryCard('bell', 'تنبيهات', notifCount, '#8b5cf6'));

    wrapper.appendChild(cardsRow);

    // Continue studying
    const continueSection = renderContinueStudying(settings, subjects.filter(s => !s.archived));
    if (continueSection) wrapper.appendChild(continueSection);

    // Today's schedule
    wrapper.appendChild(renderTodaySchedule(todayLectures, subjects));

    // Add spacer
    const spacer1 = document.createElement('div');
    spacer1.style.height = '20px';
    wrapper.appendChild(spacer1);

    // Upcoming deadlines
    const upcoming = getUpcomingDeadlines(tasks, 3);
    wrapper.appendChild(renderDeadlines(upcoming, overdueTasks, subjects));

    // Add spacer
    const spacer2 = document.createElement('div');
    spacer2.style.height = '20px';
    wrapper.appendChild(spacer2);

    // Study progress
    const progress = calculateWeekProgress(tasks);
    wrapper.appendChild(renderProgress(progress));

  } catch (err) {
    console.error('Dashboard render error:', err);
    wrapper.innerHTML = '';
    wrapper.appendChild(emptyState(
      icon('alert'),
      'حدث خطأ في تحميل البيانات',
      'حاول مرة أخرى لاحقًا'
    ));
  }
}
