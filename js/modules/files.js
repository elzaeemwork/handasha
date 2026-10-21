/**
 * files.js - مكتبة المحاضرات والملفات
 * Local file management with IndexedDB binary Blob/ArrayBuffer storage.
 * @module modules/files
 */

import { add, get, update, remove, getAllFromIndex } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, bottomSheet, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatDate } from '../utils/dates.js';
import { sanitizeHTML } from '../utils/validation.js';
import { formatFileSize, truncateText } from '../utils/formatting.js';
import { navigate } from '../router.js';

const CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'lecture', label: 'محاضرات' },
  { id: 'lab', label: 'مختبرات' },
  { id: 'summary', label: 'ملخصات' },
  { id: 'assignment', label: 'واجبات' },
  { id: 'exam', label: 'امتحانات' },
  { id: 'source', label: 'مصادر' },
  { id: 'media', label: 'تسجيلات' },
];

export async function render(container, params) {
  const subjectId = params?.subjectId;
  if (!subjectId) {
    navigate('/subjects');
    return;
  }

  container.innerHTML = loadingSpinner('جاري فتح مكتبة الملفات...');

  const subject = await get('subjects', subjectId);
  if (!subject) {
    container.innerHTML = emptyState(
      'book',
      'المادة غير موجودة',
      'تعذر العثور على المادة المحددة.',
      'العودة للمواد',
      () => navigate('/subjects')
    );
    return;
  }

  let activeCategory = 'all';
  let searchQuery = '';
  let sortBy = 'date_desc';

  async function loadFiles() {
    const all = await getAllFromIndex('files', 'subjectId', subjectId);
    return all || [];
  }

  function getFileIcon(type, name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (type.includes('pdf') || ext === 'pdf') return 'file-pdf';
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'file-image';
    if (type.includes('audio') || ['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return 'file-audio';
    if (type.includes('video') || ['mp4', 'mov', 'mkv', 'webm'].includes(ext)) return 'file-video';
    return 'file-text';
  }

  function renderView(files) {
    // Filter
    let filtered = files.filter((f) => {
      const matchCat = activeCategory === 'all' || f.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        (f.name && f.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.notes && f.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date_desc') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === 'date_asc') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ar');
      if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
      return 0;
    });

    const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

    container.innerHTML = `
      <div class="files-container" style="--subject-color: ${subject.color || '#3657C8'};">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-back" class="btn btn-ghost" style="padding: 8px;" aria-label="رجوع">${icon('chevron-right', 22)}</button>
            <div>
              <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text); margin: 0;">مكتبة الملفات</h2>
              <span style="font-size: 13px; color: var(--color-text-secondary);">${sanitizeHTML(subject.name)}</span>
            </div>
          </div>
          <label class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; margin: 0;">
            ${icon('upload', 18)}
            <span>رفع ملف</span>
            <input type="file" id="file-uploader" multiple style="display: none;" />
          </label>
        </div>

        <!-- Search & Filter Controls -->
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1; position: relative;">
            <input type="text" id="file-search-input" value="${sanitizeHTML(searchQuery)}" placeholder="بحث في الملفات..." 
              style="width: 100%; padding: 10px 36px 10px 12px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 14px;" />
            <span style="position: absolute; right: 10px; top: 10px; color: var(--color-text-secondary);">${icon('search', 18)}</span>
          </div>
          <select id="file-sort-select" style="padding: 10px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-card); font-size: 13px;">
            <option value="date_desc" ${sortBy === 'date_desc' ? 'selected' : ''}>الأحدث</option>
            <option value="date_asc" ${sortBy === 'date_asc' ? 'selected' : ''}>الأقدم</option>
            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>الاسم</option>
            <option value="size" ${sortBy === 'size' ? 'selected' : ''}>الحجم</option>
          </select>
        </div>

        <!-- Categories Tabs -->
        <div class="file-categories">
          ${CATEGORIES.map(
            (cat) => `
            <button class="subject-tab-btn ${activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
              ${cat.label}
            </button>
          `
          ).join('')}
        </div>

        <!-- Files List -->
        <div id="files-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${
            filtered.length === 0
              ? emptyState(
                  'folder',
                  'لا توجد ملفات هنا',
                  searchQuery ? 'لا توجد نتائج مطابقة لبحثك.' : 'اضغط على "رفع ملف" لإضافة أول محاضرة أو ملخص للمادة.',
                  null
                )
              : filtered
                  .map((f) => {
                    const iconName = getFileIcon(f.type || '', f.name);
                    const catObj = CATEGORIES.find((c) => c.id === f.category);
                    const catLabel = catObj ? catObj.label : 'ملف';
                    let statusBadge = '';
                    if (f.studyStatus === 'completed') {
                      statusBadge = `<span class="badge badge-success" style="font-size: 10px;">مكتمل</span>`;
                    } else if (f.studyStatus === 'studying') {
                      statusBadge = `<span class="badge badge-warning" style="font-size: 10px;">قيد الدراسة</span>`;
                    }

                    return `
                    <div class="file-card" data-id="${f.id}">
                      <div class="file-icon-box">${icon(iconName, 24)}</div>
                      <div class="file-details">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                          <span class="file-name" title="${sanitizeHTML(f.name)}">${sanitizeHTML(f.name)}</span>
                          <button class="btn-fav" data-id="${f.id}" style="background: none; border: none; cursor: pointer; color: ${f.favorite ? '#f59e0b' : 'var(--color-border)'}; padding: 2px;">
                            ${icon(f.favorite ? 'star-filled' : 'star', 18)}
                          </button>
                        </div>
                        <div class="file-sub">
                          <span>${formatFileSize(f.size || 0)}</span>
                          <span>•</span>
                          <span>${catLabel}</span>
                          ${f.createdAt ? `<span>•</span><span>${formatDate(f.createdAt)}</span>` : ''}
                          ${statusBadge}
                        </div>
                        ${f.notes ? `<div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">📝 ${sanitizeHTML(truncateText(f.notes, 40))}</div>` : ''}
                      </div>
                      <button class="btn btn-ghost btn-file-options" data-id="${f.id}" style="padding: 6px;" aria-label="خيارات">
                        ${icon('more-horizontal', 20)}
                      </button>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>

        <!-- Storage info box -->
        <div class="storage-bar-box">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>المساحة المستخدمة لهذه المادة</span>
            <span style="font-weight: 700;">${formatFileSize(totalBytes)} (${files.length} ملفات)</span>
          </div>
          <div style="font-size: 11px; color: var(--color-text-secondary);">
            الملفات مخزنة بأمان داخل متصفح جهازك لتعمل دون إنترنت.
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    container.querySelector('#btn-back').addEventListener('click', () => {
      navigate(`/subjects/${subjectId}`);
    });

    const fileInput = container.querySelector('#file-uploader');
    fileInput.addEventListener('change', async (e) => {
      const selected = Array.from(e.target.files);
      if (!selected.length) return;

      toast(`جاري حفظ ${selected.length} ملفات محلياً...`, 'info', 2000);

      for (const fl of selected) {
        try {
          const buffer = await fl.arrayBuffer();
          await add('files', {
            subjectId,
            name: fl.name,
            type: fl.type || 'application/octet-stream',
            size: fl.size,
            category: activeCategory !== 'all' ? activeCategory : 'lecture',
            studyStatus: 'new',
            favorite: false,
            notes: '',
            data: buffer,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } catch (err) {
          console.error('File save error:', err);
          toast(`فشل حفظ الملف ${fl.name}: مساحة التخزين قد تكون ممتلئة.`, 'error');
        }
      }

      toast('تم حفظ الملفات بنجاح في مكتبة المادة!', 'success');
      const updatedFiles = await loadFiles();
      renderView(updatedFiles);
    });

    const searchInput = container.querySelector('#file-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderView(files);
    });

    const sortSelect = container.querySelector('#file-sort-select');
    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      renderView(files);
    });

    container.querySelectorAll('.subject-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        renderView(files);
      });
    });

    // Star toggle
    container.querySelectorAll('.btn-fav').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fId = btn.dataset.id;
        const target = files.find((f) => f.id === fId);
        if (target) {
          target.favorite = !target.favorite;
          target.updatedAt = Date.now();
          await update('files', target);
          renderView(files);
        }
      });
    });

    // File card click -> open preview/download
    container.querySelectorAll('.file-card').forEach((card) => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-fav') || e.target.closest('.btn-file-options')) return;
        const fId = card.dataset.id;
        const target = files.find((f) => f.id === fId);
        if (target) openFilePreview(target);
      });
    });

    // File options menu
    container.querySelectorAll('.btn-file-options').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fId = btn.dataset.id;
        const target = files.find((f) => f.id === fId);
        if (target) showFileActions(target, files);
      });
    });
  }

  function openFilePreview(file) {
    if (!file.data) {
      toast('محتوى الملف غير متوفر.', 'error');
      return;
    }

    const blob = new Blob([file.data], { type: file.type || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);

    if (file.type && file.type.startsWith('image/')) {
      modal(
        file.name,
        `<div style="text-align: center; max-height: 70vh; overflow: auto;">
          <img src="${blobUrl}" style="max-width: 100%; height: auto; border-radius: 8px;" />
         </div>`,
        [{ text: 'تنزيل', className: 'btn btn-primary', onClick: () => downloadBlob(blobUrl, file.name) }]
      );
    } else if (file.type && file.type.includes('pdf')) {
      modal(
        file.name,
        `<div style="height: 65vh; width: 100%;">
          <iframe src="${blobUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>
         </div>`,
        [{ text: 'فتح في تبويب جديد', className: 'btn btn-primary', onClick: () => window.open(blobUrl, '_blank') }]
      );
    } else if (file.type && file.type.startsWith('audio/')) {
      modal(
        file.name,
        `<div style="padding: 20px; text-align: center;">
          <audio controls autoplay style="width: 100%;" src="${blobUrl}"></audio>
         </div>`,
        [{ text: 'تنزيل', className: 'btn btn-primary', onClick: () => downloadBlob(blobUrl, file.name) }]
      );
    } else if (file.type && file.type.startsWith('video/')) {
      modal(
        file.name,
        `<div style="padding: 10px; text-align: center;">
          <video controls autoplay style="max-width: 100%; border-radius: 8px;" src="${blobUrl}"></video>
         </div>`,
        [{ text: 'تنزيل', className: 'btn btn-primary', onClick: () => downloadBlob(blobUrl, file.name) }]
      );
    } else {
      // Direct download
      downloadBlob(blobUrl, file.name);
      toast(`تم بدء تنزيل ${file.name}`, 'success');
    }
  }

  function downloadBlob(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  async function showFileActions(file, allFiles) {
    const options = [
      { id: 'preview', label: 'فتح أو معاينة', icon: 'file' },
      { id: 'download', label: 'تنزيل الملف', icon: 'download' },
      { id: 'status', label: 'تغيير حالة الدراسة', icon: 'check-circle' },
      { id: 'category', label: 'تغيير التصنيف', icon: 'tag' },
      { id: 'notes', label: 'تعديل الملاحظات', icon: 'note' },
      { id: 'rename', label: 'إعادة التسمية', icon: 'edit' },
      { id: 'delete', label: 'حذف الملف', icon: 'trash', danger: true },
    ];

    const action = await bottomSheet(file.name, options);
    if (!action) return;

    if (action === 'preview') {
      openFilePreview(file);
    } else if (action === 'download') {
      const blob = new Blob([file.data], { type: file.type || 'application/octet-stream' });
      downloadBlob(URL.createObjectURL(blob), file.name);
    } else if (action === 'status') {
      const nextStatus =
        file.studyStatus === 'new' ? 'studying' : file.studyStatus === 'studying' ? 'completed' : 'new';
      file.studyStatus = nextStatus;
      file.updatedAt = Date.now();
      await update('files', file);
      toast('تم تحديث حالة الدراسة', 'success');
      renderView(allFiles);
    } else if (action === 'category') {
      const catOptions = CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({
        id: c.id,
        label: c.label,
      }));
      const chosenCat = await bottomSheet('اختر تصنيف الملف', catOptions);
      if (chosenCat) {
        file.category = chosenCat;
        file.updatedAt = Date.now();
        await update('files', file);
        toast('تم تغيير التصنيف بنجاح', 'success');
        renderView(allFiles);
      }
    } else if (action === 'notes') {
      const m = modal(
        'ملاحظات الملف',
        `<div>
          <textarea id="modal-file-notes" style="width: 100%; min-height: 100px; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 14px; direction: rtl;">${sanitizeHTML(file.notes || '')}</textarea>
        </div>`,
        [
          {
            text: 'حفظ',
            className: 'btn btn-primary',
            onClick: async (closeFn) => {
              const notesVal = document.getElementById('modal-file-notes').value.trim();
              file.notes = notesVal;
              file.updatedAt = Date.now();
              await update('files', file);
              toast('تم حفظ الملاحظات', 'success');
              closeFn();
              renderView(allFiles);
            },
          },
        ]
      );
    } else if (action === 'rename') {
      const m = modal(
        'إعادة تسمية الملف',
        `<div>
          <input type="text" id="modal-file-name" value="${sanitizeHTML(file.name)}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 14px; direction: ltr; text-align: right;" />
        </div>`,
        [
          {
            text: 'حفظ',
            className: 'btn btn-primary',
            onClick: async (closeFn) => {
              const newName = document.getElementById('modal-file-name').value.trim();
              if (!newName) return;
              file.name = newName;
              file.updatedAt = Date.now();
              await update('files', file);
              toast('تمت إعادة التسمية', 'success');
              closeFn();
              renderView(allFiles);
            },
          },
        ]
      );
    } else if (action === 'delete') {
      const ok = await confirm('تأكيد الحذف', `هل أنت متأكد من حذف الملف "${file.name}" نهائياً من جهازك؟`, 'حذف', 'إلغاء', true);
      if (ok) {
        await remove('files', file.id);
        toast('تم حذف الملف', 'success');
        const updated = await loadFiles();
        renderView(updated);
      }
    }
  }

  const initialFiles = await loadFiles();
  renderView(initialFiles);
}
