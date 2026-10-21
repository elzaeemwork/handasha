/**
 * notes.js - الملاحظات الدراسية
 * Clean, fast note-taking with auto-save, tags, subject linkage, and pinning.
 * @module modules/notes
 */

import { add, get, getAll, update, remove } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatDate, formatRelativeTime } from '../utils/dates.js';
import { sanitizeHTML } from '../utils/validation.js';
import { truncateText } from '../utils/formatting.js';
import { navigate } from '../router.js';

export async function render(container, params) {
  const noteId = params?.id;
  if (noteId) {
    await renderNoteEditor(container, noteId);
  } else {
    await renderNotesList(container);
  }
}

async function renderNotesList(container) {
  container.innerHTML = loadingSpinner('جاري تحميل الملاحظات...');

  let searchQuery = '';
  let selectedSubject = 'all';

  async function loadData() {
    const [notes, subjects] = await Promise.all([getAll('notes'), getAll('subjects')]);
    return { notes: notes || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { notes, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));

    let filtered = notes.filter((n) => {
      if (selectedSubject !== 'all' && n.subjectId !== selectedSubject) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (n.title || '').toLowerCase().includes(q);
        const matchContent = (n.content || '').toLowerCase().includes(q);
        const matchTags = (n.tags || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchTags) return false;
      }
      return true;
    });

    // Pinned notes first, then latest updated
    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });

    container.innerHTML = `
      <div class="notes-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الملاحظات الدراسية</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">تدوين الملخصات والأفكار وتثبيت المهم منها</span>
          </div>
          <button id="btn-add-note" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ${icon('plus', 18)}
            <span>ملاحظة جديدة</span>
          </button>
        </div>

        <!-- Search & Filter -->
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1; position: relative;">
            <input type="text" id="note-search-input" value="${sanitizeHTML(searchQuery)}" placeholder="بحث في الملاحظات والوسوم..." 
              style="width: 100%; padding: 10px 36px 10px 12px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 14px;" />
            <span style="position: absolute; right: 10px; top: 10px; color: var(--color-text-secondary);">${icon('search', 18)}</span>
          </div>
          <select id="note-subject-filter" style="padding: 10px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 13px; max-width: 130px;">
            <option value="all">كل المواد</option>
            ${subjects.map((s) => `<option value="${s.id}" ${selectedSubject === s.id ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>`).join('')}
          </select>
        </div>

        <!-- Notes Grid/List -->
        <div id="notes-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${
            filtered.length === 0
              ? emptyState(
                  'note',
                  'لا توجد ملاحظات',
                  searchQuery ? 'لا توجد ملاحظة مطابقة للبحث.' : 'ابدأ بتدوين أول فكرة أو ملخص هندسي الآن.',
                  'تدوين ملاحظة جديدة',
                  () => navigate('/notes/new')
                )
              : filtered
                  .map((n) => {
                    const subj = subjectsMap.get(n.subjectId);
                    const subjName = subj ? subj.name : '';
                    const subjColor = subj ? subj.color : '#3657C8';
                    const tagsList = (n.tags || '')
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean);

                    return `
                    <div class="note-card" data-id="${n.id}">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <span class="note-title">${sanitizeHTML(n.title || 'بدون عنوان')}</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <button class="btn-pin-note" data-id="${n.id}" style="background: none; border: none; cursor: pointer; color: ${n.pinned ? 'var(--color-primary)' : 'var(--color-border)'}; padding: 4px;" title="${n.pinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}">
                            ${icon('pin', 16)}
                          </button>
                          <button class="btn-delete-note" data-id="${n.id}" style="background: none; border: none; cursor: pointer; color: var(--color-danger); padding: 4px;" title="حذف">
                            ${icon('trash', 16)}
                          </button>
                        </div>
                      </div>

                      <div class="note-preview">${sanitizeHTML(n.content || 'لا يوجد نص...')}</div>

                      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--color-text-secondary); margin-top: 6px; border-top: 1px solid var(--color-border); padding-top: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          ${subjName ? `<span class="badge" style="background: ${subjColor}15; color: ${subjColor}; font-weight: 600;">${sanitizeHTML(subjName)}</span>` : ''}
                          ${tagsList.map((t) => `<span class="badge badge-default">#${sanitizeHTML(t)}</span>`).join('')}
                        </div>
                        <span>${formatRelativeTime(n.updatedAt || n.createdAt)}</span>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    // Listeners
    container.querySelector('#btn-add-note').addEventListener('click', () => {
      navigate('/notes/new');
    });

    const sIn = container.querySelector('#note-search-input');
    sIn.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderView(data);
    });

    const sFil = container.querySelector('#note-subject-filter');
    sFil.addEventListener('change', (e) => {
      selectedSubject = e.target.value;
      renderView(data);
    });

    container.querySelectorAll('.note-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-pin-note') || e.target.closest('.btn-delete-note')) return;
        navigate(`/notes/${card.dataset.id}`);
      });
    });

    container.querySelectorAll('.btn-pin-note').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nId = btn.dataset.id;
        const target = notes.find((n) => n.id === nId);
        if (target) {
          target.pinned = !target.pinned;
          target.updatedAt = Date.now();
          await update('notes', target);
          renderView(data);
        }
      });
    });

    container.querySelectorAll('.btn-delete-note').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirm('حذف الملاحظة', 'هل أنت متأكد من حذف هذه الملاحظة نهائياً؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('notes', btn.dataset.id);
          toast('تم حذف الملاحظة', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  // FAB Listener
  const fabHandler = (e) => {
    if (e.detail?.action === 'add-note') {
      navigate('/notes/new');
    }
  };
  window.addEventListener('fab-action', fabHandler);

  const initialData = await loadData();
  renderView(initialData);
}

async function renderNoteEditor(container, noteId) {
  const isNew = noteId === 'new';
  let note = null;
  const subjects = (await getAll('subjects')) || [];

  if (!isNew) {
    note = await get('notes', noteId);
    if (!note) {
      toast('الملاحظة غير موجودة', 'error');
      navigate('/notes');
      return;
    }
  } else {
    note = {
      title: '',
      content: '',
      subjectId: '',
      tags: '',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  let saveTimeout = null;
  let saveStatus = 'saved'; // saving, saved, unsaved

  container.innerHTML = `
    <div class="note-editor-container">
      <!-- Top Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
        <button id="editor-back" class="btn btn-ghost" style="padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
          ${icon('chevron-right', 20)}
          <span>الملاحظات</span>
        </button>

        <div style="display: flex; align-items: center; gap: 12px;">
          <span id="save-indicator" style="font-size: 12px; color: var(--color-text-secondary);">
            ${isNew ? 'مسودة جديدة' : 'محفوظة'}
          </span>
          <button id="btn-pin-toggle" class="btn btn-ghost" style="padding: 6px; color: ${note.pinned ? 'var(--color-primary)' : 'var(--color-border)'};" title="تثبيت">
            ${icon('pin', 18)}
          </button>
          <button id="btn-delete-this-note" class="btn btn-ghost" style="padding: 6px; color: var(--color-danger);" title="حذف">
            ${icon('trash', 18)}
          </button>
        </div>
      </div>

      <!-- Subject & Tags selector -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
        <select id="editor-subject" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 13px;">
          <option value="">بدون مادة محددة</option>
          ${subjects.map((s) => `<option value="${s.id}" ${s.id === note.subjectId ? 'selected' : ''}>${sanitizeHTML(s.name)}</option>`).join('')}
        </select>
        <input type="text" id="editor-tags" value="${sanitizeHTML(note.tags || '')}" placeholder="وسوم مفصولة بفاصلة (مثال: معادلات, هام)" 
          style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 13px;" />
      </div>

      <!-- Title Input -->
      <input type="text" id="editor-title" class="note-title-input" value="${sanitizeHTML(note.title || '')}" placeholder="عنوان الملاحظة..." />

      <!-- Body Textarea -->
      <textarea id="editor-body" class="note-body-textarea" placeholder="ابدأ بكتابة الملاحظات الهندسية هنا...">${sanitizeHTML(note.content || '')}</textarea>

      <!-- Word / Char Count Footer -->
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary); border-top: 1px solid var(--color-border); padding-top: 8px;">
        <span id="editor-stats">٠ كلمة • ٠ حرف</span>
        <span id="editor-modified">${formatDate(note.updatedAt || Date.now())}</span>
      </div>
    </div>
  `;

  const titleIn = container.querySelector('#editor-title');
  const bodyIn = container.querySelector('#editor-body');
  const subjSel = container.querySelector('#editor-subject');
  const tagsIn = container.querySelector('#editor-tags');
  const pinBtn = container.querySelector('#btn-pin-toggle');
  const delBtn = container.querySelector('#btn-delete-this-note');
  const saveInd = container.querySelector('#save-indicator');
  const statsSpan = container.querySelector('#editor-stats');

  function updateStats() {
    const text = bodyIn.value.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).length : 0;
    statsSpan.textContent = `${words} كلمة • ${chars} حرف`;
  }
  updateStats();

  async function performSave() {
    saveInd.textContent = 'جاري الحفظ...';
    note.title = titleIn.value.trim() || 'ملاحظة بدون عنوان';
    note.content = bodyIn.value;
    note.subjectId = subjSel.value;
    note.tags = tagsIn.value.trim();
    note.updatedAt = Date.now();

    if (isNew && !note.id) {
      const newId = await add('notes', note);
      note.id = newId;
      window.location.hash = `#/notes/${newId}`;
    } else {
      await update('notes', note);
    }

    saveInd.textContent = 'تم الحفظ تلقائياً ✓';
  }

  function queueSave() {
    saveInd.textContent = 'تعديلات غير محفوظة...';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(performSave, 1500);
    updateStats();
  }

  titleIn.addEventListener('input', queueSave);
  bodyIn.addEventListener('input', queueSave);
  subjSel.addEventListener('change', queueSave);
  tagsIn.addEventListener('input', queueSave);

  pinBtn.addEventListener('click', () => {
    note.pinned = !note.pinned;
    pinBtn.style.color = note.pinned ? 'var(--color-primary)' : 'var(--color-border)';
    queueSave();
  });

  delBtn.addEventListener('click', async () => {
    const ok = await confirm('حذف الملاحظة', 'هل أنت متأكد من حذف هذه الملاحظة نهائياً؟', 'حذف', 'إلغاء', true);
    if (ok) {
      if (note.id) await remove('notes', note.id);
      toast('تم حذف الملاحظة', 'success');
      navigate('/notes');
    }
  });

  container.querySelector('#editor-back').addEventListener('click', async () => {
    clearTimeout(saveTimeout);
    if (titleIn.value.trim() || bodyIn.value.trim()) {
      await performSave();
    }
    navigate('/notes');
  });
}
