/**
 * exams.js - الكوزات والامتحانات الجامعية
 * Exam schedules, countdowns, topics, and readiness tracking.
 * @module modules/exams
 */

import { add, get, getAll, update, remove } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatDate, formatRelativeTime, daysRemaining, formatCountdown } from '../utils/dates.js';
import { sanitizeHTML } from '../utils/validation.js';
import { navigate } from '../router.js';

const EXAM_TYPES = {
  quiz: 'كوز (امتحان قصير)',
  monthly: 'امتحان شهري',
  midterm: 'امتحان نصف السنة',
  final: 'امتحان نهائي',
  practical: 'امتحان عملي / مختبر',
  presentation: 'مناقشة أو عرض مشروع',
};

const READINESS_LEVELS = {
  notStarted: { label: 'لم أبدأ بعد', color: '#D9534F' },
  reviewing: { label: 'قيد المراجعة', color: '#E8A23A' },
  ready: { label: 'جاهز تماماً', color: '#24A58A' },
};

export async function render(container) {
  container.innerHTML = loadingSpinner('جاري تحميل جدول الامتحانات والكوزات...');

  async function loadData() {
    const [exams, subjects] = await Promise.all([getAll('exams'), getAll('subjects')]);
    return { exams: exams || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { exams, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));
    const now = Date.now();

    // Split upcoming and past
    const upcoming = [];
    const past = [];

    exams.forEach((ex) => {
      const examTime = ex.date ? new Date(`${ex.date}T${ex.time || '09:00'}:00`).getTime() : 0;
      if (examTime >= now) {
        upcoming.push({ ...ex, examTime });
      } else {
        past.push({ ...ex, examTime });
      }
    });

    upcoming.sort((a, b) => a.examTime - b.examTime);
    past.sort((a, b) => b.examTime - a.examTime);

    container.innerHTML = `
      <div class="exams-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الكوزات والامتحانات</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">مواعيد الاختبارات، المادة الداخلة، والاستعداد</span>
          </div>
          <button id="btn-add-exam" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ${icon('plus', 18)}
            <span>إضافة اختبار</span>
          </button>
        </div>

        <!-- Upcoming Section -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="font-size: 16px; font-weight: 700; color: var(--color-text); margin: 0;">الامتحانات القادمة (${upcoming.length})</h3>
          
          ${
            upcoming.length === 0
              ? emptyState(
                  'file-text',
                  'لا توجد امتحانات قادمة',
                  'لا توجد كوزات أو امتحانات مجدولة حالياً. يمكنك الاسترخاء أو إضافة موعد جديد.',
                  'إضافة موعد كوز أو امتحان',
                  () => openExamForm(null, data)
                )
              : upcoming
                  .map((ex) => {
                    const subj = subjectsMap.get(ex.subjectId);
                    const subjName = subj ? subj.name : 'مادة محذوفة';
                    const subjColor = subj ? subj.color : '#3657C8';
                    const typeLabel = EXAM_TYPES[ex.type] || 'امتحان';
                    const readiness = READINESS_LEVELS[ex.readiness] || READINESS_LEVELS.notStarted;
                    const remDays = daysRemaining(ex.examTime);

                    return `
                    <div class="exam-card" style="border-right: 5px solid ${subjColor};">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px; font-weight: 700; color: var(--color-text);">${sanitizeHTML(subjName)}</span>
                            <span class="badge badge-primary" style="font-size: 11px;">${typeLabel}</span>
                          </div>
                          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">
                            📅 <b>${formatDate(ex.examTime)}</b> ${ex.time ? `• الساعة ${ex.time}` : ''}
                            ${ex.location ? `• 📍 ${sanitizeHTML(ex.location)}` : ''}
                          </div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                          <button class="btn btn-ghost btn-edit-exam" data-id="${ex.id}" style="padding: 4px;" title="تعديل">${icon('edit', 16)}</button>
                          <button class="btn btn-ghost btn-delete-exam" data-id="${ex.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">${icon('trash', 16)}</button>
                        </div>
                      </div>

                      <!-- Countdown & Readiness -->
                      <div class="exam-countdown-box">
                        <span style="display: inline-flex; align-items: center; gap: 6px;">
                          ${icon('clock', 16)}
                          <span>المتبقي: <b>${formatCountdown(ex.examTime)}</b></span>
                        </span>
                        <span style="color: ${readiness.color}; font-weight: 700; font-size: 12px;">
                          ● ${readiness.label}
                        </span>
                      </div>

                      ${
                        ex.topics
                          ? `<div style="background: var(--color-bg); padding: 10px; border-radius: 8px; font-size: 13px; color: var(--color-text);">
                              <b>الموضوعات الداخلة:</b> ${sanitizeHTML(ex.topics)}
                             </div>`
                          : ''
                      }

                      ${ex.notes ? `<div style="font-size: 12px; color: var(--color-text-secondary);">📝 ${sanitizeHTML(ex.notes)}</div>` : ''}
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>

        <!-- Past Exams Collapsible -->
        ${
          past.length > 0
            ? `
          <div style="margin-top: 14px; border-top: 1px solid var(--color-border); padding-top: 14px;">
            <details>
              <summary style="font-size: 14px; font-weight: 600; color: var(--color-text-secondary); cursor: pointer; padding: 6px 0;">
                الامتحانات السابقة (${past.length})
              </summary>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                ${past
                  .map((ex) => {
                    const subj = subjectsMap.get(ex.subjectId);
                    const subjName = subj ? subj.name : 'مادة محذوفة';
                    const typeLabel = EXAM_TYPES[ex.type] || 'امتحان';
                    return `
                    <div style="padding: 10px; border-radius: 8px; background: var(--color-card); border: 1px solid var(--color-border); opacity: 0.7; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <b>${sanitizeHTML(subjName)}</b> - ${typeLabel}
                        <div style="font-size: 11px; color: var(--color-text-secondary);">${formatDate(ex.examTime)}</div>
                      </div>
                      <button class="btn btn-ghost btn-delete-exam" data-id="${ex.id}" style="padding: 4px; color: var(--color-danger);">${icon('trash', 14)}</button>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </details>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Event listeners
    container.querySelector('#btn-add-exam').addEventListener('click', () => {
      openExamForm(null, data);
    });

    container.querySelectorAll('.btn-edit-exam').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = exams.find((ex) => ex.id === btn.dataset.id);
        if (target) openExamForm(target, data);
      });
    });

    container.querySelectorAll('.btn-delete-exam').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirm('حذف الامتحان', 'هل أنت متأكد من حذف هذا الموعد؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('exams', btn.dataset.id);
          toast('تم حذف موعد الامتحان', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  function openExamForm(exam, data) {
    const { subjects } = data;
    const isEdit = !!exam;
    const cur = exam || {
      subjectId: subjects[0]?.id || '',
      type: 'quiz',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      location: '',
      topics: '',
      notes: '',
      readiness: 'notStarted',
    };

    const formHTML = `
      <form id="exam-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">المادة الدراسية *</label>
            <select name="subjectId" class="form-select">
              ${subjects.map((s) => `<option value="${s.id}" ${s.id === cur.subjectId ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">نوع الاختبار *</label>
            <select name="type" class="form-select">
              ${Object.entries(EXAM_TYPES).map(([k, v]) => `<option value="${k}" ${k === cur.type ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">التاريخ *</label>
            <input type="date" name="date" class="form-input" value="${cur.date}" required />
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">الوقت</label>
            <input type="time" name="time" class="form-input" value="${cur.time || '09:00'}" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">مكان الامتحان (اختياري)</label>
            <input type="text" name="location" class="form-input" value="${sanitizeHTML(cur.location || '')}" placeholder="مثال: القاعة الكبرى" />
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">مستوى الاستعداد</label>
            <select name="readiness" class="form-select">
              ${Object.entries(READINESS_LEVELS).map(([k, v]) => `<option value="${k}" ${k === cur.readiness ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">الموضوعات الداخلة في الامتحان</label>
          <textarea name="topics" class="form-textarea" rows="3" placeholder="مثال: الفصول 1، 2، 3 + مسائل الشيت الأخير...">${sanitizeHTML(cur.topics || '')}</textarea>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="display: block; font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">ملاحظات إضافية</label>
          <input type="text" name="notes" class="form-input" value="${sanitizeHTML(cur.notes || '')}" placeholder="مثال: مسموح بالآلة الحاسبة الهندسية وجدول القوانين" />
        </div>
      </form>
    `;

    modal(isEdit ? 'تعديل موعد الاختبار' : 'إضافة موعد كوز أو امتحان', formHTML, [
      {
        text: 'حفظ الموعد',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('exam-form');
          const formData = new FormData(form);

          const date = formData.get('date');
          if (!date) {
            toast('يرجى تحديد تاريخ الامتحان', 'warning');
            return;
          }

          const payload = {
            subjectId: formData.get('subjectId'),
            type: formData.get('type') || 'quiz',
            date,
            time: formData.get('time') || '09:00',
            location: formData.get('location')?.trim() || '',
            readiness: formData.get('readiness') || 'notStarted',
            topics: formData.get('topics')?.trim() || '',
            notes: formData.get('notes')?.trim() || '',
            createdAt: cur.createdAt || Date.now(),
            updatedAt: Date.now(),
          };

          if (isEdit) payload.id = exam.id;

          if (isEdit) {
            await update('exams', payload);
            toast('تم تعديل موعد الاختبار', 'success');
          } else {
            await add('exams', payload);
            toast('تمت إضافة موعد الاختبار بنجاح', 'success');
          }

          closeFn();
          const updated = await loadData();
          renderView(updated);
        },
      },
    ]);
  }

  // FAB Listener
  const fabHandler = (e) => {
    if (e.detail?.action === 'add-exam') {
      loadData().then((d) => openExamForm(null, d));
    }
  };
  window.addEventListener('fab-action', fabHandler);

  const initialData = await loadData();
  renderView(initialData);

  return () => {
    window.removeEventListener('fab-action', fabHandler);
  };
}
