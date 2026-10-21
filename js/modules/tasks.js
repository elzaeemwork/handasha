/**
 * tasks.js - المهام والواجبات والتقارير الهندسية
 * Task tracking, homework deadlines, lab reports, and priorities.
 * @module modules/tasks
 */

import { add, get, getAll, update, remove } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, bottomSheet, emptyState, loadingSpinner, formatStatusBadge } from '../utils/ui.js';
import { formatDate, formatRelativeTime, daysRemaining } from '../utils/dates.js';
import { sanitizeHTML, validateRequired } from '../utils/validation.js';
import { navigate } from '../router.js';

const TASK_TYPES = {
  homework: 'واجب منزلي',
  labReport: 'تقرير مختبر',
  project: 'تسليم مشروع',
  study: 'دراسة محاضرة',
  review: 'مراجعة امتحان',
  personal: 'مهمة شخصية',
};

const PRIORITIES = {
  low: { label: 'منخفضة', color: '#24A58A' },
  medium: { label: 'متوسطة', color: '#E8A23A' },
  high: { label: 'عالية جداً', color: '#D9534F' },
};

export async function render(container) {
  container.innerHTML = loadingSpinner('جاري تحميل المهام والواجبات...');

  let currentTab = 'all'; // all, notStarted, inProgress, completed, overdue
  let filterSubject = 'all';
  let searchQuery = '';

  async function loadData() {
    const [tasks, subjects] = await Promise.all([getAll('tasks'), getAll('subjects')]);
    return { tasks: tasks || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { tasks, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));
    const now = Date.now();

    // Enrich tasks with overdue flag
    const enriched = tasks.map((t) => {
      const isOverdue = t.status !== 'completed' && t.deadline && new Date(t.deadline).getTime() < now;
      return { ...t, isOverdue };
    });

    // Filter
    let filtered = enriched.filter((t) => {
      // Tab filter
      if (currentTab === 'notStarted' && t.status !== 'notStarted') return false;
      if (currentTab === 'inProgress' && t.status !== 'inProgress') return false;
      if (currentTab === 'completed' && t.status !== 'completed') return false;
      if (currentTab === 'overdue' && !t.isOverdue) return false;

      // Subject filter
      if (filterSubject !== 'all' && t.subjectId !== filterSubject) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchDetails = (t.details || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDetails) return false;
      }

      return true;
    });

    // Sort: overdue first, then by deadline
    filtered.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return dateA - dateB;
    });

    // Counts for tabs
    const counts = {
      all: enriched.length,
      notStarted: enriched.filter((t) => t.status === 'notStarted').length,
      inProgress: enriched.filter((t) => t.status === 'inProgress').length,
      completed: enriched.filter((t) => t.status === 'completed').length,
      overdue: enriched.filter((t) => t.isOverdue).length,
    };

    container.innerHTML = `
      <div class="tasks-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">المهام والواجبات</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">متابعة الواجبات، تقارير المختبر، والمشاريع</span>
          </div>
          <button id="btn-add-task" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ${icon('plus', 18)}
            <span>مهمة جديدة</span>
          </button>
        </div>

        <!-- Search & Subject Filter -->
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1; position: relative;">
            <input type="text" id="task-search-input" value="${sanitizeHTML(searchQuery)}" placeholder="بحث في المهام..." 
              style="width: 100%; padding: 10px 36px 10px 12px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 14px;" />
            <span style="position: absolute; right: 10px; top: 10px; color: var(--color-text-secondary);">${icon('search', 18)}</span>
          </div>
          <select id="task-subject-filter" style="padding: 10px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 13px; max-width: 140px;">
            <option value="all">كل المواد</option>
            ${subjects.map((s) => `<option value="${s.id}" ${filterSubject === s.id ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>`).join('')}
          </select>
        </div>

        <!-- Filter Tabs -->
        <div class="file-categories">
          <button class="subject-tab-btn ${currentTab === 'all' ? 'active' : ''}" data-tab="all">الكل (${counts.all})</button>
          <button class="subject-tab-btn ${currentTab === 'inProgress' ? 'active' : ''}" data-tab="inProgress">قيد التنفيذ (${counts.inProgress})</button>
          <button class="subject-tab-btn ${currentTab === 'notStarted' ? 'active' : ''}" data-tab="notStarted">لم تبدأ (${counts.notStarted})</button>
          <button class="subject-tab-btn ${currentTab === 'overdue' ? 'active' : ''}" data-tab="overdue" style="${counts.overdue > 0 ? 'color: var(--color-danger); font-weight:700;' : ''}">متأخرة (${counts.overdue})</button>
          <button class="subject-tab-btn ${currentTab === 'completed' ? 'active' : ''}" data-tab="completed">مكتملة (${counts.completed})</button>
        </div>

        <!-- Task List -->
        <div id="tasks-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${
            filtered.length === 0
              ? emptyState(
                  'check-square',
                  'لا توجد مهام مطابقة',
                  currentTab === 'completed' ? 'لم تكمل أي مهمة بعد في هذا القسم.' : 'أحسنت! لا توجد مهام معلقة في هذه الفئة.',
                  'إضافة مهمة جديدة',
                  () => openTaskForm(null, data)
                )
              : filtered
                  .map((t) => {
                    const subj = subjectsMap.get(t.subjectId);
                    const subjName = subj ? subj.name : 'شخصي / عام';
                    const subjColor = subj ? subj.color : '#3657C8';
                    const priorityInfo = PRIORITIES[t.priority] || PRIORITIES.medium;
                    const typeLabel = TASK_TYPES[t.type] || 'مهمة';
                    const isDone = t.status === 'completed';

                    let deadlineBadge = '';
                    if (t.deadline) {
                      const dDate = new Date(t.deadline);
                      const rem = daysRemaining(dDate);
                      if (isDone) {
                        deadlineBadge = `<span style="color: var(--color-text-secondary);">${formatDate(dDate)}</span>`;
                      } else if (t.isOverdue) {
                        deadlineBadge = `<span style="color: var(--color-danger); font-weight: 700;">متأخرة (${formatRelativeTime(dDate)})</span>`;
                      } else if (rem <= 2) {
                        deadlineBadge = `<span style="color: var(--color-warning); font-weight: 700;">مستحقة ${formatRelativeTime(dDate)}</span>`;
                      } else {
                        deadlineBadge = `<span>الموعد: ${formatDate(dDate)}</span>`;
                      }
                    }

                    return `
                    <div class="task-card ${isDone ? 'completed' : ''}" data-id="${t.id}" style="border-right: 4px solid ${subjColor};">
                      <div class="task-main-row">
                        <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${t.id}" title="${isDone ? 'تحديد كغير مكتملة' : 'تحديد كمكتملة'}">
                          ${isDone ? icon('check', 16) : ''}
                        </div>
                        <div class="task-info">
                          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <span class="task-title">${sanitizeHTML(t.title)}</span>
                            <div style="display: flex; gap: 4px;">
                              <button class="btn btn-ghost btn-edit-task" data-id="${t.id}" style="padding: 4px;" title="تعديل">${icon('edit', 16)}</button>
                              <button class="btn btn-ghost btn-delete-task" data-id="${t.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">${icon('trash', 16)}</button>
                            </div>
                          </div>
                          ${t.details ? `<p style="font-size: 13px; color: var(--color-text-secondary); margin: 4px 0 0; line-height: 1.4;">${sanitizeHTML(t.details)}</p>` : ''}
                          <div class="task-meta" style="margin-top: 6px;">
                            <span class="badge" style="background: ${subjColor}15; color: ${subjColor}; font-weight: 600;">${sanitizeHTML(subjName)}</span>
                            <span class="badge badge-default">${typeLabel}</span>
                            <span style="display: inline-flex; align-items: center; gap: 4px; color: ${priorityInfo.color}; font-weight: 600;">
                              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${priorityInfo.color};"></span>
                              ${priorityInfo.label}
                            </span>
                            ${deadlineBadge}
                            ${t.estimatedTime ? `<span>⏱️ ${t.estimatedTime} دقيقة</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    // Event listeners
    container.querySelector('#btn-add-task').addEventListener('click', () => {
      openTaskForm(null, data);
    });

    const sInput = container.querySelector('#task-search-input');
    sInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderView(data);
    });

    const sFilter = container.querySelector('#task-subject-filter');
    sFilter.addEventListener('change', (e) => {
      filterSubject = e.target.value;
      renderView(data);
    });

    container.querySelectorAll('.subject-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        renderView(data);
      });
    });

    // Checkbox toggle status
    container.querySelectorAll('.task-checkbox').forEach((chk) => {
      chk.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tId = chk.dataset.id;
        const target = tasks.find((t) => t.id === tId);
        if (target) {
          if (target.status === 'completed') {
            target.status = 'inProgress';
            target.completedAt = null;
          } else {
            target.status = 'completed';
            target.completedAt = Date.now();
          }
          target.updatedAt = Date.now();
          await update('tasks', target);
          toast(target.status === 'completed' ? '🎉 أحسنت! تم إكمال المهمة' : 'تم تغيير الحالة إلى قيد التنفيذ', 'success');
          renderView(data);
        }
      });
    });

    container.querySelectorAll('.btn-edit-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = tasks.find((t) => t.id === btn.dataset.id);
        if (target) openTaskForm(target, data);
      });
    });

    container.querySelectorAll('.btn-delete-task').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirm('حذف المهمة', 'هل أنت متأكد من حذف هذه المهمة نهائياً؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('tasks', btn.dataset.id);
          toast('تم حذف المهمة', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  function openTaskForm(task, data) {
    const { subjects } = data;
    const isEdit = !!task;
    const cur = task || {
      title: '',
      subjectId: subjects[0]?.id || '',
      type: 'homework',
      priority: 'medium',
      status: 'notStarted',
      details: '',
      deadline: '',
      estimatedTime: 45,
    };

    let deadlineDateStr = '';
    let deadlineTimeStr = '23:59';
    if (cur.deadline) {
      const d = new Date(cur.deadline);
      if (!isNaN(d.getTime())) {
        deadlineDateStr = d.toISOString().split('T')[0];
        deadlineTimeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }

    const formHTML = `
      <form id="task-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">عنوان المهمة *</label>
          <input type="text" name="title" value="${sanitizeHTML(cur.title)}" placeholder="مثال: تسليم شيت المسائل 3" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">المادة الدراسية</label>
            <select name="subjectId" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
              <option value="">(شخصي / عام)</option>
              ${subjects.map((s) => `<option value="${s.id}" ${s.id === cur.subjectId ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">نوع المهمة</label>
            <select name="type" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
              ${Object.entries(TASK_TYPES).map(([k, v]) => `<option value="${k}" ${k === cur.type ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">تاريخ التسليم</label>
            <input type="date" name="deadlineDate" value="${deadlineDateStr}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">وقت التسليم</label>
            <input type="time" name="deadlineTime" value="${deadlineTimeStr}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">الأولوية</label>
            <select name="priority" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
              <option value="low" ${cur.priority === 'low' ? 'selected' : ''}>منخفضة</option>
              <option value="medium" ${cur.priority === 'medium' ? 'selected' : ''}>متوسطة</option>
              <option value="high" ${cur.priority === 'high' ? 'selected' : ''}>عالية جداً</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">الحالة</label>
            <select name="status" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
              <option value="notStarted" ${cur.status === 'notStarted' ? 'selected' : ''}>لم تبدأ</option>
              <option value="inProgress" ${cur.status === 'inProgress' ? 'selected' : ''}>قيد التنفيذ</option>
              <option value="completed" ${cur.status === 'completed' ? 'selected' : ''}>مكتملة</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">وقت الدراسة المتوقع (بالدقائق)</label>
          <input type="number" name="estimatedTime" value="${cur.estimatedTime || 45}" min="5" max="600" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">تفاصيل إضافية</label>
          <textarea name="details" rows="3" placeholder="تفاصيل المطلوب والمراجع المطلوبة..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; resize: vertical;">${sanitizeHTML(cur.details || '')}</textarea>
        </div>
      </form>
    `;

    modal(isEdit ? 'تعديل المهمة' : 'إضافة مهمة جديدة', formHTML, [
      {
        text: 'حفظ المهمة',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('task-form');
          const formData = new FormData(form);

          const title = formData.get('title')?.trim();
          if (!title) {
            toast('يرجى كتابة عنوان المهمة', 'warning');
            return;
          }

          let finalDeadline = null;
          const dDate = formData.get('deadlineDate');
          const dTime = formData.get('deadlineTime') || '23:59';
          if (dDate) {
            finalDeadline = new Date(`${dDate}T${dTime}:00`).getTime();
          }

          const payload = {
            title,
            subjectId: formData.get('subjectId') || '',
            type: formData.get('type') || 'homework',
            priority: formData.get('priority') || 'medium',
            status: formData.get('status') || 'notStarted',
            details: formData.get('details')?.trim() || '',
            deadline: finalDeadline,
            estimatedTime: Number(formData.get('estimatedTime')) || 0,
            completedAt: formData.get('status') === 'completed' ? (cur.completedAt || Date.now()) : null,
            createdAt: cur.createdAt || Date.now(),
            updatedAt: Date.now(),
          };

          if (isEdit) payload.id = task.id;

          if (isEdit) {
            await update('tasks', payload);
            toast('تم تعديل المهمة بنجاح', 'success');
          } else {
            await add('tasks', payload);
            toast('تمت إضافة المهمة بنجاح', 'success');
          }

          closeFn();
          const updated = await loadData();
          renderView(updated);
        },
      },
    ]);
  }

  // Listen to FAB
  const fabHandler = (e) => {
    if (e.detail?.action === 'add-task') {
      loadData().then((d) => openTaskForm(null, d));
    }
  };
  window.addEventListener('fab-action', fabHandler);

  const initialData = await loadData();
  renderView(initialData);

  return () => {
    window.removeEventListener('fab-action', fabHandler);
  };
}
