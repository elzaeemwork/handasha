/**
 * statistics.js - الإحصاءات والتقدم الدراسي الحقيقي
 * Analytics derived strictly from real user records with pure CSS/SVG visual charts.
 * @module modules/statistics
 */

import { getAll } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { loadingSpinner, emptyState } from '../utils/ui.js';
import { formatNumber, formatDurationText } from '../utils/formatting.js';
import { sanitizeHTML } from '../utils/validation.js';

export async function render(container) {
  container.innerHTML = loadingSpinner('جاري تجميع الإحصاءات والتقدم...');

  let period = 'week'; // 'week', 'month', 'all'

  async function loadData() {
    const [tasks, subjects, files, sessions] = await Promise.all([
      getAll('tasks'),
      getAll('subjects'),
      getAll('files'),
      getAll('focusSessions'),
    ]);
    return {
      tasks: tasks || [],
      subjects: subjects || [],
      files: files || [],
      sessions: sessions || [],
    };
  }

  function renderView(data) {
    const { tasks, subjects, files, sessions } = data;
    const now = Date.now();

    // Determine cutoff timestamp
    let cutoff = 0;
    if (period === 'week') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (period === 'month') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    const filteredTasks = tasks.filter((t) => (t.createdAt || 0) >= cutoff);
    const filteredSessions = sessions.filter((s) => (s.startedAt || 0) >= cutoff && s.completed);
    const completedTasks = filteredTasks.filter((t) => t.status === 'completed');
    const overdueTasks = filteredTasks.filter((t) => t.status !== 'completed' && t.deadline && new Date(t.deadline).getTime() < now);
    const completedFiles = files.filter((f) => f.studyStatus === 'completed');

    const totalFocusSeconds = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const taskCompletionRate = filteredTasks.length > 0 ? Math.round((completedTasks.length / filteredTasks.length) * 100) : 0;

    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));

    // Subject task breakdown
    const subjectCounts = {};
    filteredTasks.forEach((t) => {
      const sId = t.subjectId || 'general';
      subjectCounts[sId] = (subjectCounts[sId] || 0) + 1;
    });

    const hasData = tasks.length > 0 || sessions.length > 0 || files.length > 0;

    container.innerHTML = `
      <div class="tasks-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الإحصاءات والتقدم</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">مؤشرات الأداء المبنية على نشاطك الحقيقي</span>
          </div>
          <!-- Period Selector -->
          <select id="stats-period-select" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 13px;">
            <option value="week" ${period === 'week' ? 'selected' : ''}>آخر 7 أيام</option>
            <option value="month" ${period === 'month' ? 'selected' : ''}>آخر 30 يوماً</option>
            <option value="all" ${period === 'all' ? 'selected' : ''}>كل الفترات</option>
          </select>
        </div>

        ${
          !hasData
            ? emptyState(
                'chart',
                'لا توجد بيانات كافية بعد',
                'ستظهر هنا مؤشرات تقدمك وساعات التركيز بمجرد البدء بإضافة المواد والمهام واستخدام مؤقت المذاكرة.',
                null
              )
            : `
          <!-- KPI Summary Cards -->
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-icon-box" style="color: var(--color-secondary); background: #24A58A15;">
                ${icon('check-circle', 22)}
              </div>
              <div class="summary-info">
                <span class="summary-value">${taskCompletionRate}٪</span>
                <span class="summary-label">إنجاز المهام (${completedTasks.length}/${filteredTasks.length})</span>
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-icon-box" style="color: #D9534F; background: #D9534F15;">
                ${icon('timer', 22)}
              </div>
              <div class="summary-info">
                <span class="summary-value">${formatDurationText(totalFocusSeconds)}</span>
                <span class="summary-label">وقت التركيز والمذاكرة</span>
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-icon-box" style="color: var(--color-primary); background: #3657C815;">
                ${icon('file-text', 22)}
              </div>
              <div class="summary-info">
                <span class="summary-value">${completedFiles.length}</span>
                <span class="summary-label">ملفات تمت دراستها</span>
              </div>
            </div>

            <div class="summary-card">
              <div class="summary-icon-box" style="color: ${overdueTasks.length > 0 ? 'var(--color-danger)' : 'var(--color-secondary)'}; background: ${overdueTasks.length > 0 ? '#D9534F15' : '#24A58A15'};">
                ${icon(overdueTasks.length > 0 ? 'warning' : 'check', 22)}
              </div>
              <div class="summary-info">
                <span class="summary-value">${overdueTasks.length}</span>
                <span class="summary-label">مهام متأخرة</span>
              </div>
            </div>
          </div>

          <!-- Tasks Distribution by Subject -->
          <div class="card" style="display: flex; flex-direction: column; gap: 12px; margin-top: 6px;">
            <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">توزيع المهام حسب المواد</h3>
            ${
              Object.keys(subjectCounts).length === 0
                ? '<div style="font-size: 13px; color: var(--color-text-secondary); text-align: center; padding: 12px 0;">لا توجد مهام مسجلة لهذه الفترة</div>'
                : Object.entries(subjectCounts)
                    .map(([sId, count]) => {
                      const subj = subjectsMap.get(sId);
                      const name = subj ? subj.name : 'عام / غير مصنف';
                      const color = subj ? subj.color : '#3657C8';
                      const pct = Math.round((count / filteredTasks.length) * 100);

                      return `
                      <div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                          <span style="font-weight: 600;">${sanitizeHTML(name)}</span>
                          <span style="color: var(--color-text-secondary);">${count} مهمة (${pct}٪)</span>
                        </div>
                        <div style="height: 8px; border-radius: 4px; background: var(--color-bg); overflow: hidden;">
                          <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 4px;"></div>
                        </div>
                      </div>
                    `;
                    })
                    .join('')
            }
          </div>

          <!-- Focus Sessions History -->
          <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
            <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">سجل جلسات التركيز المكتملة (${filteredSessions.length})</h3>
            ${
              filteredSessions.length === 0
                ? '<div style="font-size: 13px; color: var(--color-text-secondary); text-align: center; padding: 12px 0;">لم تسجل جلسات تركيز في هذه الفترة</div>'
                : `
              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
                ${filteredSessions
                  .slice(0, 10)
                  .map((s) => {
                    const subj = subjectsMap.get(s.subjectId);
                    const subjName = subj ? subj.name : 'مذاكرة عامة';
                    const dateStr = new Date(s.startedAt).toLocaleDateString('ar-EG', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                    const timeStr = new Date(s.startedAt).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 8px; background: var(--color-bg); font-size: 12px;">
                      <div>
                        <b>${sanitizeHTML(subjName)}</b>
                        <div style="color: var(--color-text-secondary);">${dateStr} • ${timeStr}</div>
                      </div>
                      <span class="badge badge-success">${Math.round((s.duration || 0) / 60)} دقيقة</span>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            `
            }
          </div>
        `
        }
      </div>
    `;

    const selectEl = container.querySelector('#stats-period-select');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        period = e.target.value;
        renderView(data);
      });
    }
  }

  const initialData = await loadData();
  renderView(initialData);
}
