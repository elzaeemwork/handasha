/**
 * subjects.js - المواد
 * Subject management module with list, detail, and CRUD operations
 */
import { add, get, getAll, update, remove, query } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, bottomSheet, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatDate, formatRelativeTime } from '../utils/dates.js';
import { validateRequired, sanitizeHTML } from '../utils/validation.js';
import { truncateText, formatNumber } from '../utils/formatting.js';

const PRESET_COLORS = [
  '#3657C8', '#ef4444', '#f59e0b', '#22c55e',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
];

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Cascading delete for a subject and ALL its related records (files, tasks, lectures, exams, notes, mindmaps, quizzes, flashcards, focusSessions).
 * @param {string} subjectId
 * @param {string} [subjectName='المادة']
 * @returns {Promise<boolean>}
 */
async function deleteSubjectCascade(subjectId, subjectName = 'المادة') {
  const [files, tasks, lectures, exams, notes, decks, quizzes, mindmaps, sessions] = await Promise.all([
    getAll('files').catch(() => []),
    getAll('tasks').catch(() => []),
    getAll('schedule').catch(() => []),
    getAll('exams').catch(() => []),
    getAll('notes').catch(() => []),
    getAll('flashcardDecks').catch(() => []),
    getAll('quizzes').catch(() => []),
    getAll('mindmaps').catch(() => []),
    getAll('focusSessions').catch(() => [])
  ]);

  const relatedFiles = files.filter(f => f.subjectId === subjectId);
  const relatedTasks = tasks.filter(t => t.subjectId === subjectId);

  const confirmed = await confirm(
    'حذف المادة نهائياً؟',
    `هل أنت متأكد من رغبتك في حذف «${subjectName}»؟ سيتم حذف جميع المحاضرات والملفات والمهام والاختبارات والبطاقات والملاحظات التابعة لها بشكل دائم.`,
    'حذف نهائي',
    'إلغاء',
    true
  );

  if (!confirmed) return false;

  try {
    // 1. Files, Tasks, Schedule, Exams, Notes, Mindmaps, Sessions
    for (const f of relatedFiles) await remove('files', f.id).catch(() => {});
    for (const t of relatedTasks) await remove('tasks', t.id).catch(() => {});
    for (const l of lectures.filter(l => l.subjectId === subjectId)) await remove('schedule', l.id).catch(() => {});
    for (const e of exams.filter(e => e.subjectId === subjectId)) await remove('exams', e.id).catch(() => {});
    for (const n of notes.filter(n => n.subjectId === subjectId)) await remove('notes', n.id).catch(() => {});
    for (const m of mindmaps.filter(m => m.subjectId === subjectId)) await remove('mindmaps', m.id).catch(() => {});
    for (const s of sessions.filter(s => s.subjectId === subjectId)) await remove('focusSessions', s.id).catch(() => {});

    // 2. Flashcard decks & their individual cards
    const targetDecks = decks.filter(d => d.subjectId === subjectId);
    const allCards = await getAll('flashcards').catch(() => []);
    for (const d of targetDecks) {
      for (const c of allCards.filter(c => c.deckId === d.id)) await remove('flashcards', c.id).catch(() => {});
      await remove('flashcardDecks', d.id).catch(() => {});
    }

    // 3. Quizzes & their questions
    const targetQuizzes = quizzes.filter(q => q.subjectId === subjectId);
    const allQuestions = await getAll('quizQuestions').catch(() => []);
    for (const q of targetQuizzes) {
      for (const qu of allQuestions.filter(qu => qu.quizId === q.id)) await remove('quizQuestions', qu.id).catch(() => {});
      await remove('quizzes', q.id).catch(() => {});
    }

    // 4. Finally delete the subject
    await remove('subjects', subjectId);

    toast('تم حذف المادة وكافة بياناتها التابعة بنجاح', 'success');
    return true;
  } catch (err) {
    console.error('Error deleting subject cascade:', err);
    toast('حدث خطأ أثناء حذف المادة', 'error');
    return false;
  }
}

/**
 * Show add/edit subject form
 */
function showSubjectForm(existingSubject, onSave) {
  const isEdit = !!existingSubject;
  const subj = existingSubject || {};

  const content = document.createElement('div');
  content.innerHTML = `
    <form id="subject-form" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
          اسم المادة <span style="color: #ef4444;">*</span>
        </label>
        <input type="text" name="name" class="form-input" value="${sanitizeHTML(subj.name || '')}" placeholder="مثال: الرياضيات الهندسية" />
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
          اسم المدرّس
        </label>
        <input type="text" name="instructor" class="form-input" value="${sanitizeHTML(subj.instructor || '')}" placeholder="اسم التدريسي" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
            المرحلة
          </label>
          <select name="stage" class="form-select">
            <option value="">— اختر —</option>
            <option value="1" ${subj.stage === '1' ? 'selected' : ''}>الأولى</option>
            <option value="2" ${subj.stage === '2' ? 'selected' : ''}>الثانية</option>
            <option value="3" ${subj.stage === '3' ? 'selected' : ''}>الثالثة</option>
            <option value="4" ${subj.stage === '4' ? 'selected' : ''}>الرابعة</option>
            <option value="5" ${subj.stage === '5' ? 'selected' : ''}>الخامسة</option>
          </select>
        </div>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
            الفصل
          </label>
          <select name="semester" class="form-select">
            <option value="">— اختر —</option>
            <option value="1" ${subj.semester === '1' ? 'selected' : ''}>الأول</option>
            <option value="2" ${subj.semester === '2' ? 'selected' : ''}>الثاني</option>
            <option value="summer" ${subj.semester === 'summer' ? 'selected' : ''}>الصيفي</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 8px;">
          اللون المميز
        </label>
        <div id="color-picker" style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${PRESET_COLORS.map(c => `
            <div data-color="${c}" class="color-opt" style="width: 36px; height: 36px; border-radius: 50%;
              background: ${c}; cursor: pointer; border: 3px solid ${(subj.color || PRESET_COLORS[0]) === c ? 'var(--color-text)' : 'transparent'};
              transition: border-color 0.15s ease;"></div>
          `).join('')}
        </div>
        <input type="hidden" name="color" value="${subj.color || PRESET_COLORS[0]}" />
      </div>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="display: block; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px;">
          الوصف
        </label>
        <textarea name="description" class="form-textarea" rows="3" placeholder="ملاحظات عن المادة...">${sanitizeHTML(subj.description || '')}</textarea>
      </div>
    </form>
  `;

  // Color picker logic
  const colorPicker = content.querySelector('#color-picker');
  const colorInput = content.querySelector('input[name="color"]');
  colorPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.color-opt');
    if (!opt) return;
    colorInput.value = opt.dataset.color;
    colorPicker.querySelectorAll('.color-opt').forEach(el => {
      el.style.borderColor = el.dataset.color === opt.dataset.color ? 'var(--color-text)' : 'transparent';
    });
  });

  const actions = [
    {
      text: 'إلغاء',
      className: 'btn btn-secondary',
      onClick: (closeFn) => closeFn()
    }
  ];

  if (isEdit) {
    actions.push({
      text: 'حذف المادة',
      className: 'btn btn-danger',
      onClick: async (closeFn) => {
        const deleted = await deleteSubjectCascade(subj.id, subj.name);
        if (deleted) {
          closeFn();
          window.location.hash = '#/subjects';
          if (onSave) onSave();
        }
      }
    });
  }

  actions.push({
    text: isEdit ? 'حفظ التعديلات' : 'إضافة المادة',
    className: 'btn btn-primary',
    onClick: async (closeFn) => {
      const form = content.querySelector('#subject-form');
      const name = form.querySelector('[name="name"]').value.trim();
      const instructor = form.querySelector('[name="instructor"]').value.trim();
      const stage = form.querySelector('[name="stage"]').value;
      const semester = form.querySelector('[name="semester"]').value;
      const color = form.querySelector('[name="color"]').value;
      const description = form.querySelector('[name="description"]').value.trim();

      const nameCheck = validateRequired(name, 'اسم المادة');
      if (!nameCheck.valid) {
        toast(nameCheck.error, 'warning');
        return;
      }

      const data = {
        name, instructor, stage, semester, color, description,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        await update('subjects', { ...subj, ...data });
        toast('تم تعديل المادة بنجاح', 'success');
      } else {
        data.id = generateId();
        data.createdAt = new Date().toISOString();
        data.archived = false;
        await add('subjects', data);
        toast('تمت إضافة المادة بنجاح', 'success');
      }

      closeFn();
      if (onSave) onSave();
    }
  });

  modal({
    title: isEdit ? 'تعديل المادة' : 'إضافة مادة جديدة',
    content,
    actions
  });
}

/**
 * Render subject list view
 */
async function renderSubjectList(container) {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'padding: 16px 16px 100px; max-width: 600px; margin: 0 auto;';
  wrapper.appendChild(loadingSpinner());
  container.appendChild(wrapper);

  try {
    const [subjects, files, tasks] = await Promise.all([
      getAll('subjects').catch(() => []),
      getAll('files').catch(() => []),
      getAll('tasks').catch(() => [])
    ]);

    wrapper.innerHTML = '';

    // State
    let showArchived = false;
    let searchTerm = '';
    let sortBy = 'name';

    function getFilteredSubjects() {
      let list = subjects.filter(s => showArchived ? s.archived : !s.archived);
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(s =>
          (s.name || '').toLowerCase().includes(term) ||
          (s.instructor || '').toLowerCase().includes(term)
        );
      }
      list.sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ar');
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      return list;
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 16px;';
    header.innerHTML = `
      <h1 style="font-size: 24px; font-weight: 800; color: var(--color-text, #1a1a2e); margin: 0 0 4px;">
        ${icon('book')} المواد الدراسية
      </h1>
    `;
    wrapper.appendChild(header);

    // Search and controls
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px; align-items: center;';
    controls.innerHTML = `
      <div style="flex: 1; position: relative;">
        <input type="text" id="subject-search" placeholder="بحث في المواد..."
          style="width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--color-border, #e8ecf2);
                 font-size: 14px; background: var(--color-surface, #fff); box-sizing: border-box; direction: rtl;" />
      </div>
      <button id="sort-btn" style="padding: 10px 12px; border-radius: 12px; border: 1px solid var(--color-border, #e8ecf2);
              background: var(--color-surface, #fff); cursor: pointer; font-size: 16px;" title="ترتيب">
        ${icon('sort')}
      </button>
      <button id="archive-toggle" style="padding: 10px 12px; border-radius: 12px; border: 1px solid var(--color-border, #e8ecf2);
              background: var(--color-surface, #fff); cursor: pointer; font-size: 16px;" title="الأرشيف">
        ${icon('archive')}
      </button>
    `;
    wrapper.appendChild(controls);

    // Grid container
    const grid = document.createElement('div');
    grid.id = 'subjects-grid';
    wrapper.appendChild(grid);

    // Add subject button
    const addBtn = document.createElement('button');
    addBtn.style.cssText = `
      width: 100%; padding: 14px; border-radius: 16px; border: 2px dashed var(--color-border, #e8ecf2);
      background: transparent; color: var(--color-primary, #3657C8); font-size: 15px; font-weight: 600;
      cursor: pointer; margin-top: 12px; font-family: inherit;
    `;
    addBtn.textContent = '+ إضافة مادة جديدة';
    addBtn.addEventListener('click', () => {
      showSubjectForm(null, () => renderSubjectList(container));
    });
    wrapper.appendChild(addBtn);

    function renderGrid() {
      const filtered = getFilteredSubjects();
      grid.innerHTML = '';

      if (filtered.length === 0) {
        const msg = showArchived ? 'لا توجد مواد في الأرشيف' : (searchTerm ? 'لا توجد نتائج' : 'لم تضف أي مادة بعد');
        const sub = showArchived ? '' : 'أضف موادك الدراسية لتبدأ بتنظيم دراستك';
        grid.appendChild(emptyState(icon('book'), msg, sub));
        return;
      }

      grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;';

      filtered.forEach(subj => {
        const fileCount = files.filter(f => f.subjectId === subj.id).length;
        const taskCount = tasks.filter(t => t.subjectId === subj.id && t.status !== 'completed').length;

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.style.cssText = `
          background: var(--color-surface, #fff); border-radius: 16px; padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid var(--color-border, #e8ecf2);
          border-top: 4px solid ${subj.color || '#3657C8'}; cursor: pointer;
          transition: transform 0.15s ease; position: relative;
          ${subj.archived ? 'opacity: 0.6;' : ''}
        `;
        card.addEventListener('click', () => {
          window.location.hash = `#/subjects/${subj.id}`;
        });
        card.addEventListener('pointerdown', () => { card.style.transform = 'scale(0.97)'; });
        card.addEventListener('pointerup', () => { card.style.transform = ''; });
        card.addEventListener('pointerleave', () => { card.style.transform = ''; });

        card.innerHTML = `
          <div style="font-size: 16px; font-weight: 700; color: var(--color-text, #1a1a2e); margin-bottom: 6px;
                      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 28px;">
            ${sanitizeHTML(subj.name)}
          </div>
          ${subj.instructor ? `<div style="font-size: 12px; color: var(--color-text-secondary, #6b7280); margin-bottom: 12px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${sanitizeHTML(subj.instructor)}</div>` : '<div style="margin-bottom: 12px;"></div>'}
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary, #6b7280);">
            <span>${icon('file')} ${formatNumber(fileCount)}</span>
            <span>${icon('task')} ${formatNumber(taskCount)}</span>
          </div>
          ${subj.archived ? `<div style="position: absolute; top: 8px; left: 8px; font-size: 10px; padding: 2px 6px;
            border-radius: 6px; background: #6b728020; color: #6b7280;">أرشيف</div>` : ''}
        `;

        const optionsBtn = document.createElement('button');
        optionsBtn.className = 'subject-card-options-btn';
        optionsBtn.style.cssText = `
          position: absolute; top: 10px; left: 10px; width: 28px; height: 28px;
          border-radius: 50%; border: none; background: transparent; cursor: pointer;
          color: var(--color-text-secondary, #6b7280); display: flex; align-items: center;
          justify-content: center; padding: 0; z-index: 2;
        `;
        optionsBtn.innerHTML = icon('more-vertical', 16);
        optionsBtn.title = 'خيارات المادة';
        optionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          bottomSheet({
            title: subj.name,
            items: [
              {
                icon: 'edit',
                label: 'تعديل المادة',
                onClick: () => {
                  showSubjectForm(subj, () => renderSubjectList(container));
                }
              },
              {
                icon: 'archive',
                label: subj.archived ? 'إلغاء الأرشفة' : 'أرشفة المادة',
                onClick: async () => {
                  await update('subjects', { ...subj, archived: !subj.archived, updatedAt: new Date().toISOString() });
                  toast(subj.archived ? 'تم إلغاء الأرشفة' : 'تمت أرشفة المادة', 'success');
                  renderSubjectList(container);
                }
              },
              {
                icon: 'trash',
                label: 'حذف المادة نهائياً',
                danger: true,
                onClick: async () => {
                  const deleted = await deleteSubjectCascade(subj.id, subj.name);
                  if (deleted) renderSubjectList(container);
                }
              }
            ]
          });
        });
        card.appendChild(optionsBtn);
        grid.appendChild(card);
      });
    }

    renderGrid();

    // Search handler
    controls.querySelector('#subject-search').addEventListener('input', (e) => {
      searchTerm = e.target.value.trim();
      renderGrid();
    });

    // Sort handler
    controls.querySelector('#sort-btn').addEventListener('click', () => {
      const items = [
        { label: 'ترتيب بالاسم', value: 'name', icon: icon('sort') },
        { label: 'ترتيب بالتاريخ', value: 'date', icon: icon('calendar') }
      ];
      bottomSheet({
        title: 'ترتيب المواد',
        items: items.map(item => ({
          label: `${item.icon} ${item.label}`,
          onClick: () => {
            sortBy = item.value;
            renderGrid();
          }
        }))
      });
    });

    // Archive toggle
    controls.querySelector('#archive-toggle').addEventListener('click', () => {
      showArchived = !showArchived;
      const btn = controls.querySelector('#archive-toggle');
      btn.style.background = showArchived ? 'var(--color-primary, #3657C8)' : 'var(--color-surface, #fff)';
      btn.style.color = showArchived ? '#fff' : '';
      renderGrid();
    });

  } catch (err) {
    console.error('Subjects render error:', err);
    wrapper.innerHTML = '';
    wrapper.appendChild(emptyState(icon('alert'), 'حدث خطأ في تحميل المواد', 'حاول مرة أخرى'));
  }
}

/**
 * Render subject detail view
 */
async function renderSubjectDetail(container, subjectId) {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'padding: 16px 16px 100px; max-width: 600px; margin: 0 auto;';
  wrapper.appendChild(loadingSpinner());
  container.appendChild(wrapper);

  try {
    const subj = await get('subjects', subjectId);
    if (!subj) {
      wrapper.innerHTML = '';
      wrapper.appendChild(emptyState(icon('alert'), 'المادة غير موجودة', ''));
      const backBtn = document.createElement('button');
      backBtn.textContent = 'العودة للمواد';
      backBtn.style.cssText = `display: block; margin: 16px auto; padding: 12px 24px; border-radius: 12px;
        background: var(--color-primary, #3657C8); color: #fff; border: none; font-size: 14px; cursor: pointer; font-family: inherit;`;
      backBtn.addEventListener('click', () => { window.location.hash = '#/subjects'; });
      wrapper.appendChild(backBtn);
      return;
    }

    // Save last opened
    try {
      const settingsData = { id: 'lastOpenedSubjectId', key: 'lastOpenedSubjectId', value: subjectId };
      await add('settings', settingsData).catch(() => update('settings', settingsData));
    } catch (_) { /* ignore */ }

    const [files, tasks, lectures, exams] = await Promise.all([
      getAll('files').then(f => f.filter(x => x.subjectId === subjectId)).catch(() => []),
      getAll('tasks').then(t => t.filter(x => x.subjectId === subjectId)).catch(() => []),
      getAll('schedule').then(l => l.filter(x => x.subjectId === subjectId)).catch(() => []),
      getAll('exams').then(e => e.filter(x => x.subjectId === subjectId)).catch(() => [])
    ]);

    wrapper.innerHTML = '';
    const color = subj.color || '#3657C8';

    // Back button
    const backRow = document.createElement('div');
    backRow.style.cssText = 'margin-bottom: 12px;';
    backRow.innerHTML = `
      <a href="#/subjects" style="color: var(--color-primary, #3657C8); text-decoration: none; font-size: 14px; display: inline-flex; align-items: center; gap: 4px;">
        ${icon('back')} المواد
      </a>
    `;
    wrapper.appendChild(backRow);

    // Subject header
    const headerCard = document.createElement('div');
    headerCard.style.cssText = `
      background: linear-gradient(135deg, ${color}, ${color}BB);
      border-radius: 20px; padding: 24px; margin-bottom: 20px;
      color: #fff; position: relative; overflow: hidden;
    `;
    headerCard.innerHTML = `
      <div style="position: relative; z-index: 1;">
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">${sanitizeHTML(subj.name)}</h1>
        ${subj.instructor ? `<p style="margin: 0 0 4px; opacity: 0.9; font-size: 14px;">${icon('user')} ${sanitizeHTML(subj.instructor)}</p>` : ''}
        ${subj.stage ? `<p style="margin: 0; opacity: 0.7; font-size: 13px;">المرحلة ${sanitizeHTML(subj.stage)}${subj.semester ? ` — الفصل ${sanitizeHTML(subj.semester)}` : ''}</p>` : ''}
        <div style="display: flex; gap: 16px; margin-top: 16px; font-size: 13px; opacity: 0.85;">
          <span>${icon('file')} ${formatNumber(files.length)} ملف</span>
          <span>${icon('task')} ${formatNumber(tasks.length)} مهمة</span>
          <span>${icon('calendar')} ${formatNumber(lectures.length)} محاضرة</span>
        </div>
      </div>
      <div style="position: absolute; top: -20px; left: -20px; width: 120px; height: 120px;
                  border-radius: 50%; background: rgba(255,255,255,0.08);"></div>
    `;

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; margin-top: 12px; position: relative; z-index: 1;';

    const editBtn = document.createElement('button');
    editBtn.style.cssText = 'padding: 8px 16px; border-radius: 10px; background: rgba(255,255,255,0.2); color: #fff; border: none; font-size: 13px; cursor: pointer; font-family: inherit;';
    editBtn.textContent = 'تعديل';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSubjectForm(subj, () => renderSubjectDetail(container, subjectId));
    });

    const moreBtn = document.createElement('button');
    moreBtn.style.cssText = 'padding: 8px 16px; border-radius: 10px; background: rgba(255,255,255,0.2); color: #fff; border: none; font-size: 13px; cursor: pointer; font-family: inherit;';
    moreBtn.textContent = 'المزيد';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bottomSheet({
        title: subj.name,
        items: [
          {
            icon: 'archive',
            label: subj.archived ? 'إلغاء الأرشفة' : 'أرشفة المادة',
            onClick: async () => {
              const yes = await confirm(subj.archived ? 'إلغاء أرشفة المادة؟' : 'أرشفة المادة؟', subj.archived ? 'سيتم إعادة المادة إلى القائمة الرئيسية' : 'سيتم نقل المادة إلى الأرشيف');
              if (yes) {
                await update('subjects', { ...subj, archived: !subj.archived, updatedAt: new Date().toISOString() });
                toast(subj.archived ? 'تم إلغاء الأرشفة' : 'تمت أرشفة المادة', 'success');
                window.location.hash = '#/subjects';
              }
            }
          },
          {
            icon: 'trash',
            label: 'حذف المادة نهائياً',
            danger: true,
            onClick: async () => {
              const deleted = await deleteSubjectCascade(subjectId, subj.name);
              if (deleted) {
                window.location.hash = '#/subjects';
              }
            }
          }
        ]
      });
    });

    actions.appendChild(editBtn);
    actions.appendChild(moreBtn);
    headerCard.appendChild(actions);
    wrapper.appendChild(headerCard);

    // Description
    if (subj.description) {
      const descCard = document.createElement('div');
      descCard.style.cssText = `
        background: var(--color-surface, #fff); border-radius: 16px; padding: 16px;
        margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        border: 1px solid var(--color-border, #e8ecf2);
      `;
      descCard.innerHTML = `
        <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary, #6b7280); line-height: 1.6;">
          ${sanitizeHTML(subj.description)}
        </p>
      `;
      wrapper.appendChild(descCard);
    }

    // Tabs
    const tabs = ['ملفات', 'جدول', 'مهام', 'امتحانات'];
    const tabCounts = [files.length, lectures.length, tasks.length, exams.length];
    let activeTab = 0;

    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
      display: flex; gap: 4px; margin-bottom: 16px; background: var(--color-surface, #fff);
      border-radius: 14px; padding: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      border: 1px solid var(--color-border, #e8ecf2);
    `;

    const tabContent = document.createElement('div');
    tabContent.id = 'tab-content';

    function renderTabContent() {
      tabContent.innerHTML = '';
      if (activeTab === 0) {
        // Files tab
        if (files.length === 0) {
          tabContent.appendChild(emptyState(icon('file'), 'لا توجد ملفات', ''));
          const goFilesBtn = document.createElement('a');
          goFilesBtn.href = `#/files/${subjectId}`;
          goFilesBtn.style.cssText = 'display: block; text-align: center; color: var(--color-primary, #3657C8); font-size: 14px; margin-top: 8px; text-decoration: none;';
          goFilesBtn.textContent = 'إدارة الملفات →';
          tabContent.appendChild(goFilesBtn);
        } else {
          const fileList = document.createElement('div');
          fileList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
          files.slice(0, 5).forEach(f => {
            const item = document.createElement('div');
            item.style.cssText = `
              background: var(--color-surface, #fff); border-radius: 12px; padding: 12px 14px;
              display: flex; align-items: center; gap: 10px; cursor: pointer;
              box-shadow: 0 1px 2px rgba(0,0,0,0.04); border: 1px solid var(--color-border, #e8ecf2);
            `;
            item.innerHTML = `
              <span style="font-size: 20px;">${icon('file')}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${sanitizeHTML(f.name || 'بدون اسم')}
                </div>
                <div style="font-size: 11px; color: var(--color-text-secondary, #6b7280);">
                  ${f.category ? sanitizeHTML(f.category) : ''} ${f.createdAt ? '· ' + formatRelativeTime(f.createdAt) : ''}
                </div>
              </div>
            `;
            item.addEventListener('click', () => { window.location.hash = `#/files/${subjectId}`; });
            fileList.appendChild(item);
          });
          tabContent.appendChild(fileList);
          if (files.length > 5) {
            const moreLink = document.createElement('a');
            moreLink.href = `#/files/${subjectId}`;
            moreLink.style.cssText = 'display: block; text-align: center; color: var(--color-primary, #3657C8); font-size: 13px; margin-top: 12px; text-decoration: none;';
            moreLink.textContent = `عرض الكل (${formatNumber(files.length)}) →`;
            tabContent.appendChild(moreLink);
          }
        }
      } else if (activeTab === 1) {
        // Schedule tab
        if (lectures.length === 0) {
          tabContent.appendChild(emptyState(icon('calendar'), 'لا توجد محاضرات', 'أضف جدولك من قسم الجدول'));
        } else {
          const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          const lecList = document.createElement('div');
          lecList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
          const sortedLecs = [...lectures].sort((a, b) => (a.day || 0) - (b.day || 0) || (a.startTime || '').localeCompare(b.startTime || ''));
          sortedLecs.forEach(l => {
            const item = document.createElement('div');
            item.style.cssText = `
              background: var(--color-surface, #fff); border-radius: 12px; padding: 12px 14px;
              border: 1px solid var(--color-border, #e8ecf2); box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              border-right: 3px solid ${color};
            `;
            item.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 600;">${dayNames[l.day] || ''}</span>
                <span style="font-size: 13px; color: var(--color-text-secondary, #6b7280);">${sanitizeHTML(l.startTime || '')} - ${sanitizeHTML(l.endTime || '')}</span>
              </div>
              <div style="font-size: 12px; color: var(--color-text-secondary, #6b7280); margin-top: 4px;">
                ${l.location ? `${icon('location')} ${sanitizeHTML(l.location)}` : ''} ${l.type ? `· ${sanitizeHTML(l.type)}` : ''}
              </div>
            `;
            lecList.appendChild(item);
          });
          tabContent.appendChild(lecList);
        }
      } else if (activeTab === 2) {
        // Tasks tab
        if (tasks.length === 0) {
          tabContent.appendChild(emptyState(icon('task'), 'لا توجد مهام', ''));
        } else {
          const taskList = document.createElement('div');
          taskList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
          const sortedTasks = [...tasks].sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));
          sortedTasks.forEach(t => {
            const isOverdue = t.deadline && t.status !== 'completed' && new Date(t.deadline) < new Date();
            const statusLabels = { 'not-started': 'لم تبدأ', 'in-progress': 'قيد التنفيذ', 'completed': 'مكتملة' };
            const statusColors = { 'not-started': '#6b7280', 'in-progress': '#f59e0b', 'completed': '#22c55e' };
            const item = document.createElement('div');
            item.style.cssText = `
              background: var(--color-surface, #fff); border-radius: 12px; padding: 12px 14px;
              border: 1px solid ${isOverdue ? '#ef444430' : 'var(--color-border, #e8ecf2)'};
              box-shadow: 0 1px 2px rgba(0,0,0,0.04); cursor: pointer;
            `;
            item.addEventListener('click', () => { window.location.hash = '#/tasks'; });
            item.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 500; ${t.status === 'completed' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                  ${sanitizeHTML(t.title || '')}
                </span>
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 8px;
                  background: ${statusColors[t.status] || '#6b7280'}15; color: ${statusColors[t.status] || '#6b7280'};">
                  ${isOverdue ? 'متأخرة' : sanitizeHTML(statusLabels[t.status] || t.status || '')}
                </span>
              </div>
              ${t.deadline ? `<div style="font-size: 12px; color: var(--color-text-secondary, #6b7280); margin-top: 4px;">
                ${icon('calendar')} ${formatRelativeTime(t.deadline)}</div>` : ''}
            `;
            taskList.appendChild(item);
          });
          tabContent.appendChild(taskList);
        }
      } else if (activeTab === 3) {
        // Exams tab
        if (exams.length === 0) {
          tabContent.appendChild(emptyState(icon('exam'), 'لا توجد امتحانات', ''));
        } else {
          const examList = document.createElement('div');
          examList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
          const sortedExams = [...exams].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
          sortedExams.forEach(ex => {
            const remaining = daysRemaining(ex.date);
            const isPast = remaining !== null && remaining < 0;
            const item = document.createElement('div');
            item.style.cssText = `
              background: var(--color-surface, #fff); border-radius: 12px; padding: 12px 14px;
              border: 1px solid var(--color-border, #e8ecf2); box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              ${isPast ? 'opacity: 0.6;' : ''}
            `;
            item.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 600;">${sanitizeHTML(ex.type || 'امتحان')}</span>
                ${!isPast && remaining !== null ? `<span style="font-size: 12px; font-weight: 700; color: ${remaining <= 3 ? '#ef4444' : 'var(--color-primary, #3657C8)'};">
                  بعد ${remaining} يوم</span>` : ''}
              </div>
              <div style="font-size: 12px; color: var(--color-text-secondary, #6b7280); margin-top: 4px;">
                ${ex.date ? formatDate(new Date(ex.date)) : ''} ${ex.time ? `· ${sanitizeHTML(ex.time)}` : ''}
                ${ex.location ? `· ${sanitizeHTML(ex.location)}` : ''}
              </div>
            `;
            examList.appendChild(item);
          });
          tabContent.appendChild(examList);
        }
      }
    }

    tabs.forEach((tab, i) => {
      const tabBtn = document.createElement('button');
      tabBtn.style.cssText = `
        flex: 1; padding: 10px 8px; border-radius: 10px; border: none; font-size: 13px;
        font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-family: inherit;
        background: ${i === activeTab ? color : 'transparent'};
        color: ${i === activeTab ? '#fff' : 'var(--color-text-secondary, #6b7280)'};
      `;
      tabBtn.textContent = `${tab} (${tabCounts[i]})`;
      tabBtn.addEventListener('click', () => {
        activeTab = i;
        tabBar.querySelectorAll('button').forEach((b, j) => {
          b.style.background = j === i ? color : 'transparent';
          b.style.color = j === i ? '#fff' : 'var(--color-text-secondary, #6b7280)';
        });
        renderTabContent();
      });
      tabBar.appendChild(tabBtn);
    });

    wrapper.appendChild(tabBar);
    wrapper.appendChild(tabContent);
    renderTabContent();

  } catch (err) {
    console.error('Subject detail error:', err);
    wrapper.innerHTML = '';
    wrapper.appendChild(emptyState(icon('alert'), 'حدث خطأ', 'تعذر تحميل بيانات المادة'));
  }
}

/**
 * Main render function
 */
export async function render(container, params) {
  const subjectId = params?.id;

  const fabHandler = (e) => {
    if (e.detail?.action === 'add-subject') {
      showSubjectForm(null, () => renderSubjectList(container));
    }
  };
  window.addEventListener('fab-action', fabHandler);

  if (subjectId) {
    await renderSubjectDetail(container, subjectId);
  } else {
    await renderSubjectList(container);
  }

  return () => {
    window.removeEventListener('fab-action', fabHandler);
  };
}
