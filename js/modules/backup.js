/**
 * backup.js - النسخ الاحتياطي وإدارة البيانات المحلية
 * JSON export/import of all IndexedDB stores, file binary backup, and storage quota monitoring.
 * @module modules/backup
 */

import { getAll, add, update, clear } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, loadingSpinner } from '../utils/ui.js';
import { formatFileSize, formatNumber } from '../utils/formatting.js';
import { formatDate } from '../utils/dates.js';

const ALL_STORES = [
  'subjects',
  'schedule',
  'tasks',
  'exams',
  'reminders',
  'notes',
  'flashcardDecks',
  'flashcards',
  'quizzes',
  'quizQuestions',
  'mindmaps',
  'focusSessions',
  'settings',
  'notifications',
];

export async function render(container) {
  container.innerHTML = loadingSpinner('جاري فحص مساحة التخزين والبيانات...');

  // Estimate storage
  let storageInfo = { usage: 0, quota: 0 };
  if (navigator.storage && navigator.storage.estimate) {
    try {
      storageInfo = await navigator.storage.estimate();
    } catch (e) {
      console.warn('Storage estimate failed:', e);
    }
  }

  async function getCounts() {
    const counts = {};
    for (const store of ALL_STORES) {
      const records = (await getAll(store)) || [];
      counts[store] = records.length;
    }
    const files = (await getAll('files')) || [];
    counts.files = files.length;
    counts.filesBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
    return counts;
  }

  const counts = await getCounts();

  function renderView() {
    container.innerHTML = `
      <div class="tasks-container" style="max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div>
          <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">النسخ الاحتياطي وإدارة البيانات</h2>
          <span style="font-size: 13px; color: var(--color-text-secondary);">حفظ وتصدير بياناتك الدراسية واستعادتها دون اتصال</span>
        </div>

        <!-- Storage Card -->
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">حالة التخزين على الجهاز</h3>
          
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>المساحة المستخدمة تقريباً:</span>
            <b>${formatFileSize(storageInfo.usage || counts.filesBytes)}</b>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>حجم ملفات المحاضرات:</span>
            <b>${formatFileSize(counts.filesBytes)} (${counts.files} ملفات)</b>
          </div>

          <!-- iOS Notice Box -->
          <div style="background: var(--color-bg); padding: 10px 12px; border-radius: 8px; font-size: 11px; color: var(--color-text-secondary); line-height: 1.5; border-right: 3px solid var(--color-warning);">
            ⚠️ <b>تنبيه لمستخدمي iPhone:</b> لحماية بياناتك من مسح Safari التلقائي في حال قلة مساحة الهاتف، ننصح بتثبيت التطبيق على الشاشة الرئيسية (Add to Home Screen) وتصدير نسخة احتياطية بشكل دوري.
          </div>
        </div>

        <!-- Export Actions -->
        <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">تصدير نسخة احتياطية</h3>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">
            يتم إنشاء ملف JSON يحمل جميع المواد، الجداول، الملاحظات، والمهام. يمكنك نقله لحاسوبك أو الاحتفاظ به على iCloud / Google Drive.
          </p>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <button id="btn-export-data" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px;">
              ${icon('download', 18)}
              <span>تصدير البيانات الدراسية (ملف خفيف JSON)</span>
            </button>

            <button id="btn-export-full" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px;">
              ${icon('backup', 18)}
              <span>تصدير شامل مع ملفات المحاضرات الثنائية</span>
            </button>
          </div>
        </div>

        <!-- Import Action -->
        <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">استعادة نسخة احتياطية</h3>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">
            اختر ملف نسخة احتياطية سبق تصديره من تطبيق «هندسها» لاستعادة موادك ومهامك.
          </p>

          <label class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; cursor: pointer; margin: 0;">
            ${icon('upload', 18)}
            <span>اختيار ملف النسخة الاحتياطية (.json)</span>
            <input type="file" id="input-backup-file" accept=".json,application/json" style="display: none;" />
          </label>
        </div>

        <!-- Danger Zone: Reset -->
        <div class="card" style="border: 1px solid rgba(217, 83, 79, 0.3); display: flex; flex-direction: column; gap: 10px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--color-danger); margin: 0;">إعادة ضبط التطبيق ومسح البيانات</h3>
          <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0;">
            حذف جميع المواد والملفات والمهام المحلية نهائياً من هذا الجهاز. لا يمكن التراجع عن هذا الإجراء إلا بوجود نسخة احتياطية.
          </p>
          <button id="btn-wipe-data" class="btn btn-danger" style="align-self: flex-start; padding: 8px 16px;">
            مسح جميع البيانات المحلية
          </button>
        </div>
      </div>
    `;

    // 1. Export Data Only (lightweight)
    container.querySelector('#btn-export-data').addEventListener('click', async () => {
      toast('جاري تجهيز النسخة الاحتياطية...', 'info');
      const backupObj = {
        app: 'HANDASHA',
        schemaVersion: 1,
        exportDate: new Date().toISOString(),
        stores: {},
      };

      for (const s of ALL_STORES) {
        backupObj.stores[s] = (await getAll(s)) || [];
      }

      // Include files metadata only (without binary buffer)
      const files = (await getAll('files')) || [];
      backupObj.stores.files = files.map((f) => ({
        id: f.id,
        subjectId: f.subjectId,
        name: f.name,
        type: f.type,
        size: f.size,
        category: f.category,
        lectureNumber: f.lectureNumber,
        notes: f.notes,
        studyStatus: f.studyStatus,
        favorite: f.favorite,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      }));

      const jsonStr = JSON.stringify(backupObj, null, 2);
      downloadJSON(jsonStr, `handasha-backup-${new Date().toISOString().split('T')[0]}.json`);
      toast('تم تحميل ملف النسخة الاحتياطية بنجاح ✓', 'success');
    });

    // 2. Export Full with Binaries
    container.querySelector('#btn-export-full').addEventListener('click', async () => {
      const ok = await confirm(
        'تصدير شامل مع الملفات',
        'سيتم تضمين محتويات جميع ملفات المحاضرات داخل النسخة، قد يستغرق ذلك وقتاً وحجم ملف كبير. هل تود المتابعة؟',
        'متابعة التصدير',
        'إلغاء'
      );
      if (!ok) return;

      toast('جاري تشفير الملفات وتحزيم النسخة الكاملة...', 'info', 4000);

      const backupObj = {
        app: 'HANDASHA',
        schemaVersion: 1,
        exportDate: new Date().toISOString(),
        stores: {},
      };

      for (const s of ALL_STORES) {
        backupObj.stores[s] = (await getAll(s)) || [];
      }

      const files = (await getAll('files')) || [];
      backupObj.stores.files = [];

      for (const f of files) {
        let base64Data = null;
        if (f.data) {
          base64Data = await arrayBufferToBase64(f.data);
        }
        backupObj.stores.files.push({
          ...f,
          data: base64Data,
        });
      }

      const jsonStr = JSON.stringify(backupObj);
      downloadJSON(jsonStr, `handasha-full-backup-${new Date().toISOString().split('T')[0]}.json`);
      toast('تم تصدير النسخة الكاملة بنجاح ✓', 'success');
    });

    // 3. Import File
    const fileInput = container.querySelector('#input-backup-file');
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed.app || parsed.app !== 'HANDASHA' || !parsed.stores) {
          toast('الملف المحدد ليس نسخة احتياطية صالحة لتطبيق هندسها.', 'error');
          return;
        }

        // Preview counts
        const previewCounts = [];
        if (parsed.stores.subjects) previewCounts.push(`${parsed.stores.subjects.length} مواد`);
        if (parsed.stores.tasks) previewCounts.push(`${parsed.stores.tasks.length} مهام`);
        if (parsed.stores.schedule) previewCounts.push(`${parsed.stores.schedule.length} محاضرات`);
        if (parsed.stores.exams) previewCounts.push(`${parsed.stores.exams.length} امتحانات`);
        if (parsed.stores.notes) previewCounts.push(`${parsed.stores.notes.length} ملاحظات`);
        if (parsed.stores.files) previewCounts.push(`${parsed.stores.files.length} ملفات`);

        const proceed = await confirm(
          'تأكيد استعادة النسخة الاحتياطية',
          `تتضمن هذه النسخة (${previewCounts.join('، ')}). هل تريد استبدال بيانات التطبيق الحالية بهذه النسخة؟`,
          'استعادة واستبدال',
          'إلغاء'
        );

        if (!proceed) return;

        toast('جاري استعادة البيانات إلى قاعدة البيانات...', 'info', 3000);

        // Clear and restore
        for (const storeName of ALL_STORES) {
          await clear(storeName);
          const records = parsed.stores[storeName] || [];
          for (const item of records) {
            await add(storeName, item);
          }
        }

        // Handle files store
        if (parsed.stores.files) {
          await clear('files');
          for (const f of parsed.stores.files) {
            let bufferData = null;
            if (f.data && typeof f.data === 'string') {
              bufferData = base64ToArrayBuffer(f.data);
            }
            await add('files', {
              ...f,
              data: bufferData,
            });
          }
        }

        toast('🎉 تم استعادة جميع البيانات والملفات بنجاح!', 'success', 4000);
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        console.error('Import error:', err);
        toast('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.', 'error');
      }
    });

    // 4. Wipe Data
    container.querySelector('#btn-wipe-data').addEventListener('click', async () => {
      const step1 = await confirm(
        '⚠️ تحذير شديد',
        'هل أنت متأكد تماماً من رغبتك في مسح جميع المواد والملاحظات والملفات المخزنة في جهازك؟',
        'نعم، تابع المسح',
        'إلغاء',
        true
      );
      if (!step1) return;

      const step2 = await confirm(
        'تأكيد نهائي',
        'سيتم تصفير جميع بيانات التطبيق تماماً ولا يمكن التراجع. هل تريد المتابعة؟',
        'مسح نهائي',
        'تراجع',
        true
      );
      if (!step2) return;

      for (const s of ALL_STORES) {
        await clear(s);
      }
      await clear('files');
      localStorage.clear();

      toast('تم مسح جميع البيانات المحلية بنجاح.', 'success');
      setTimeout(() => location.reload(), 1000);
    });
  }

  function downloadJSON(content, filename) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  function arrayBufferToBase64(buffer) {
    return new Promise((resolve) => {
      const blob = new Blob([buffer]);
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  }

  function base64ToArrayBuffer(base64DataUrl) {
    const base64 = base64DataUrl.split(',')[1] || base64DataUrl;
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes.buffer;
  }

  renderView();
}
