/**
 * schedule.js - الجدول الدراسي الأسبوعي
 * Manages university lectures, schedules, time conflicts, and classroom locations.
 * @module modules/schedule
 */

import { add, get, getAll, update, remove } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, bottomSheet, emptyState, loadingSpinner } from '../utils/ui.js';
import { sanitizeHTML, validateRequired, validateTime } from '../utils/validation.js';
import { navigate } from '../router.js';

const DAYS = [
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الاثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' },
  { id: 6, name: 'السبت' },
];

export async function render(container) {
  container.innerHTML = loadingSpinner('جاري تحميل الجدول الدراسي...');

  const todayIndex = new Date().getDay();
  let selectedDay = todayIndex;
  let viewMode = 'day'; // 'day' or 'week'

  async function loadData() {
    const [schedules, subjects] = await Promise.all([getAll('schedule'), getAll('subjects')]);
    return { schedules: schedules || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { schedules, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));

    // Filter lectures for selected day
    const dayLectures = schedules
      .filter((s) => Number(s.dayOfWeek) === Number(selectedDay))
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Check current time status
    const now = new Date();
    const currentDay = now.getDay();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    container.innerHTML = `
      <div class="schedule-container">
        <!-- Top Toolbar -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الجدول الدراسي</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">تنظيم المحاضرات الأسبوعية والقاعات</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: inline-flex; background: var(--color-bg); padding: 3px; border-radius: 10px; border: 1px solid var(--color-border);">
              <button id="toggle-view-day" class="btn btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-ghost'}" style="padding: 4px 10px; font-size: 12px; margin: 0;">عرض اليوم</button>
              <button id="toggle-view-week" class="btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}" style="padding: 4px 10px; font-size: 12px; margin: 0;">عرض الأسبوع</button>
            </div>
            <button id="btn-add-lecture" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
              ${icon('plus', 16)}
              <span>إضافة محاضرة</span>
            </button>
          </div>
        </div>

        ${
          viewMode === 'day'
            ? `
        <!-- Days Selector Navigation -->
        <div class="days-nav">
          ${DAYS.map(
            (d) => `
            <button class="day-pill ${selectedDay === d.id ? 'active' : ''}" data-day="${d.id}">
              ${d.name}
              ${d.id === todayIndex ? '<span style="display: block; font-size: 9px; opacity: 0.8;">(اليوم)</span>' : ''}
            </button>
          `
          ).join('')}
        </div>

        <!-- Lectures List for the Day -->
        <div id="lectures-list" style="display: flex; flex-direction: column; gap: 12px;">
          ${
            dayLectures.length === 0
              ? emptyState(
                  'calendar',
                  'لا توجد محاضرات في هذا اليوم',
                  `لم تقم بإضافة أي محاضرة ليوم ${DAYS.find((d) => d.id === selectedDay)?.name}.`,
                  'إضافة محاضرة لهذا اليوم',
                  () => openLectureForm(null, data, selectedDay)
                )
              : dayLectures
                  .map((lec) => {
                    const subj = subjectsMap.get(lec.subjectId);
                    const subjName = subj ? subj.name : 'مادة محذوفة';
                    const subjColor = subj ? subj.color : '#3657C8';

                    let isOngoing = false;
                    let isCompleted = false;
                    if (selectedDay === currentDay) {
                      if (lec.startTime && lec.endTime) {
                        if (currentTimeStr >= lec.startTime && currentTimeStr <= lec.endTime) {
                          isOngoing = true;
                        } else if (currentTimeStr > lec.endTime) {
                          isCompleted = true;
                        }
                      }
                    }

                    return `
                    <div class="lecture-card ${isCompleted ? 'completed-lecture' : ''}" style="--subject-color: ${subjColor}; ${isOngoing ? 'box-shadow: 0 0 0 2px var(--color-primary);' : ''}">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px; font-weight: 700; color: var(--color-text);">${sanitizeHTML(subjName)}</span>
                            ${isOngoing ? '<span class="badge badge-success" style="font-size: 11px;">الآن جارية</span>' : ''}
                            ${isCompleted ? '<span class="badge badge-default" style="font-size: 11px;">انتهت</span>' : ''}
                          </div>
                          <div class="lecture-time-badge" style="margin-top: 4px;">
                            ${icon('clock', 15)}
                            <span dir="ltr">${lec.startTime || '--:--'} - ${lec.endTime || '--:--'}</span>
                            <span class="badge badge-default" style="font-size: 11px; margin-right: 6px;">${sanitizeHTML(lec.lectureType || 'نظري')}</span>
                          </div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                          ${
                            subj
                              ? `<button class="btn btn-ghost btn-open-files" data-subject="${subj.id}" title="ملفات المادة" style="padding: 6px; color: var(--color-primary);">
                                  ${icon('folder', 18)}
                                 </button>`
                              : ''
                          }
                          <button class="btn btn-ghost btn-edit-lec" data-id="${lec.id}" title="تعديل" style="padding: 6px;">
                            ${icon('edit', 18)}
                          </button>
                          <button class="btn btn-ghost btn-delete-lec" data-id="${lec.id}" title="حذف" style="padding: 6px; color: var(--color-danger);">
                            ${icon('trash', 18)}
                          </button>
                        </div>
                      </div>

                      <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">
                        ${lec.location ? `<span>📍 القاعة/المختبر: <b>${sanitizeHTML(lec.location)}</b></span>` : ''}
                        ${lec.notes ? `<span>📝 ${sanitizeHTML(lec.notes)}</span>` : ''}
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
        `
            : `
        <!-- Full Week Schedule View -->
        <div class="week-schedule-grid" style="display: flex; flex-direction: column; gap: 14px;">
          ${DAYS.map((d) => {
            const dLectures = schedules
              .filter((s) => Number(s.dayOfWeek) === Number(d.id))
              .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            return `
              <div class="card" style="padding: 14px; ${d.id === todayIndex ? 'border-right: 4px solid var(--color-primary); background: #ffffff;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 15px; font-weight: 700; color: var(--color-text);">${d.name}</span>
                    ${d.id === todayIndex ? '<span class="badge badge-primary" style="font-size: 10px;">اليوم</span>' : ''}
                  </div>
                  <span style="font-size: 12px; color: var(--color-text-secondary);">${dLectures.length} محاضرات</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${
                    dLectures.length === 0
                      ? '<span style="font-size: 12px; color: var(--color-text-secondary); font-style: italic;">لا توجد محاضرات مجدولة</span>'
                      : dLectures
                          .map((lec) => {
                            const subj = subjectsMap.get(lec.subjectId);
                            const subjName = subj ? subj.name : 'مادة محذوفة';
                            const subjColor = subj ? subj.color : '#3657C8';
                            return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; background: var(--color-bg); border-right: 3px solid ${subjColor}; font-size: 13px;">
                              <div>
                                <b style="color: var(--color-text);">${sanitizeHTML(subjName)}</b>
                                <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">
                                  ${lec.location ? `📍 ${sanitizeHTML(lec.location)} • ` : ''}${sanitizeHTML(lec.lectureType || 'نظري')}
                                </div>
                              </div>
                              <span dir="ltr" style="font-weight: 600; color: var(--color-primary); font-size: 12px;">${lec.startTime || ''} - ${lec.endTime || ''}</span>
                            </div>
                          `;
                          })
                          .join('')
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
        `
        }
      </div>
    `;

    // Event Listeners
    container.querySelector('#toggle-view-day')?.addEventListener('click', () => {
      viewMode = 'day';
      renderView(data);
    });

    container.querySelector('#toggle-view-week')?.addEventListener('click', () => {
      viewMode = 'week';
      renderView(data);
    });

    // Event Listeners
    container.querySelector('#btn-add-lecture').addEventListener('click', () => {
      openLectureForm(null, data, selectedDay);
    });

    container.querySelectorAll('.day-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        selectedDay = Number(pill.dataset.day);
        renderView(data);
      });
    });

    container.querySelectorAll('.btn-open-files').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigate(`/files/${btn.dataset.subject}`);
      });
    });

    container.querySelectorAll('.btn-edit-lec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lec = schedules.find((s) => s.id === btn.dataset.id);
        if (lec) openLectureForm(lec, data, lec.dayOfWeek);
      });
    });

    container.querySelectorAll('.btn-delete-lec').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirm('حذف المحاضرة', 'هل أنت متأكد من حذف هذه المحاضرة من الجدول؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('schedule', btn.dataset.id);
          toast('تم حذف المحاضرة من الجدول', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  function detectConflict(existingSchedules, candidate) {
    return existingSchedules.filter((s) => {
      if (s.id === candidate.id) return false;
      if (Number(s.dayOfWeek) !== Number(candidate.dayOfWeek)) return false;
      if (!s.startTime || !s.endTime || !candidate.startTime || !candidate.endTime) return false;

      // Check overlap: startA < endB && endA > startB
      return candidate.startTime < s.endTime && candidate.endTime > s.startTime;
    });
  }

  function openLectureForm(lecture, data, preselectedDay) {
    const { subjects, schedules } = data;
    if (subjects.length === 0) {
      confirm(
        'لا توجد مواد دراسية',
        'يجب أولاً إضافة مادة دراسية واحدة على الأقل قبل إضافة محاضرة للجدول.',
        'إضافة مادة الآن',
        'لاحقاً'
      ).then((ok) => {
        if (ok) navigate('/subjects');
      });
      return;
    }

    const isEdit = !!lecture;
    const cur = lecture || {
      subjectId: subjects[0].id,
      dayOfWeek: preselectedDay !== undefined ? preselectedDay : 0,
      startTime: '08:30',
      endTime: '10:30',
      location: '',
      lectureType: 'نظري',
      notes: '',
    };

    const formHTML = `
      <form id="lecture-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">المادة الدراسية *</label>
          <select name="subjectId" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
            ${subjects
              .map(
                (s) => `
              <option value="${s.id}" ${s.id === cur.subjectId ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>
            `
              )
              .join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">اليوم *</label>
            <select name="dayOfWeek" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
              ${DAYS.map(
                (d) => `
                <option value="${d.id}" ${Number(d.id) === Number(cur.dayOfWeek) ? 'selected' : ''}>${d.name}</option>
              `
              ).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">نوع المحاضرة</label>
            <select name="lectureType" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
              <option value="نظري" ${cur.lectureType === 'نظري' ? 'selected' : ''}>نظري</option>
              <option value="عملي" ${cur.lectureType === 'عملي' ? 'selected' : ''}>عملي</option>
              <option value="مختبر" ${cur.lectureType === 'مختبر' ? 'selected' : ''}>مختبر</option>
              <option value="تمارين" ${cur.lectureType === 'تمارين' ? 'selected' : ''}>تمارين</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">وقت البدء *</label>
            <input type="time" name="startTime" value="${cur.startTime || '08:30'}" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">وقت الانتهاء *</label>
            <input type="time" name="endTime" value="${cur.endTime || '10:30'}" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">القاعة أو المختبر (اختياري)</label>
          <input type="text" name="location" value="${sanitizeHTML(cur.location || '')}" placeholder="مثال: قاعة 302 أو مختبر الاتصالات" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">ملاحظات (اختياري)</label>
          <input type="text" name="notes" value="${sanitizeHTML(cur.notes || '')}" placeholder="مثال: إحضار دفتر التجارب" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>
      </form>
    `;

    modal(isEdit ? 'تعديل محاضرة' : 'إضافة محاضرة جديدة', formHTML, [
      {
        text: 'حفظ المحاضرة',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('lecture-form');
          const formData = new FormData(form);

          const payload = {
            subjectId: formData.get('subjectId'),
            dayOfWeek: Number(formData.get('dayOfWeek')),
            lectureType: formData.get('lectureType'),
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            location: formData.get('location')?.trim() || '',
            notes: formData.get('notes')?.trim() || '',
            createdAt: lecture ? lecture.createdAt : Date.now(),
            updatedAt: Date.now(),
          };

          if (isEdit) payload.id = lecture.id;

          // Check conflict
          const conflicts = detectConflict(schedules, payload);
          if (conflicts.length > 0) {
            const conflictSubj = subjects.find((s) => s.id === conflicts[0].subjectId)?.name || 'مادة أخرى';
            const proceed = await confirm(
              '⚠️ تحذير: تعارض زمني',
              `يوجد تعارض في التوقيت مع محاضرة (${conflictSubj}) من ${conflicts[0].startTime} إلى ${conflicts[0].endTime}. هل ترغب في الحفظ على أي حال؟`,
              'متابعة الحفظ',
              'تعديل التوقيت'
            );
            if (!proceed) return;
          }

          if (isEdit) {
            await update('schedule', payload);
            toast('تم تعديل المحاضرة بنجاح', 'success');
          } else {
            await add('schedule', payload);
            toast('تمت إضافة المحاضرة إلى الجدول', 'success');
          }

          closeFn();
          selectedDay = payload.dayOfWeek;
          const updated = await loadData();
          renderView(updated);
        },
      },
    ]);
  }

  // Listen for FAB trigger
  const fabHandler = (e) => {
    if (e.detail?.action === 'add-lecture') {
      loadData().then((d) => openLectureForm(null, d, selectedDay));
    }
  };
  window.addEventListener('fab-action', fabHandler);

  const initialData = await loadData();
  renderView(initialData);

  return () => {
    window.removeEventListener('fab-action', fabHandler);
  };
}
