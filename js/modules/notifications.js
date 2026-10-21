/**
 * notifications.js - مركز التنبيهات والإشعارات
 * In-app notification center, reminder logs, and Web Push guidance.
 * @module modules/notifications
 */

import { getAll, update, remove, clear } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, emptyState, loadingSpinner } from '../utils/ui.js';
import { formatRelativeTime } from '../utils/dates.js';
import { sanitizeHTML } from '../utils/validation.js';

export async function render(container) {
  container.innerHTML = loadingSpinner('جاري تحميل الإشعارات والتنبيهات...');

  async function loadData() {
    const list = (await getAll('notifications')) || [];
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }

  function renderView(notifications) {
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    container.innerHTML = `
      <div class="tasks-container" style="max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">مركز التنبيهات</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">${unreadCount > 0 ? `${unreadCount} تنبيهات غير مقروءة` : 'لا توجد تنبيهات جديدة'}</span>
          </div>
          ${
            notifications.length > 0
              ? `
            <div style="display: flex; gap: 6px;">
              <button id="btn-mark-all-read" class="btn btn-secondary btn-sm">تحديد الكل كمقروء</button>
              <button id="btn-clear-all-notifs" class="btn btn-ghost btn-sm" style="color: var(--color-danger);">${icon('trash', 16)}</button>
            </div>
          `
              : ''
          }
        </div>

        <!-- iOS Push Info Notice -->
        <div class="card" style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; line-height: 1.5; background: var(--color-bg); border-right: 4px solid var(--color-primary);">
          <div style="font-weight: 700; font-size: 13px; color: var(--color-primary);">📢 حول التنبيهات وإشعارات النظام</div>
          <div style="color: var(--color-text);">
            • <b>التنبيهات داخل التطبيق:</b> تعمل تلقائياً وبدقة أثناء تصفحك للتطبيق لتنبيهك بالمحاضرات والمهام المستحقة ومواعيد الكوزات.
          </div>
          <div style="color: var(--color-text-secondary);">
            • <b>إشعارات شاشة القفل على iOS:</b> تتطلب إضافة التطبيق للشاشة الرئيسية (PWA) وإصدار iOS 16.4+ مع اشتراك Web Push مدعوم بخادم خارجي. التطبيق الحالي مصمم ليعمل محلياً بالكامل دون أي خوادم خارجية حفاظاً على خصوصيتك.
          </div>
        </div>

        <!-- Notifications List -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${
            notifications.length === 0
              ? emptyState(
                  'bell',
                  'لا توجد تنبيهات حالياً',
                  'ستصلك تنبيهات هنا عند اقتراب مواعيد الكوزات أو استحقاق الواجبات.',
                  null
                )
              : notifications
                  .map((n) => {
                    return `
                    <div class="card" style="display: flex; align-items: flex-start; gap: 12px; ${!n.isRead ? 'border-right: 4px solid var(--color-primary); background: #ffffff;' : 'opacity: 0.75;'}">
                      <div class="summary-icon-box" style="width: 36px; height: 36px; border-radius: 8px; ${!n.isRead ? 'background: #3657C815; color: var(--color-primary);' : ''}">
                        ${icon(n.type === 'exam' ? 'file-text' : 'bell', 18)}
                      </div>
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                          <span style="font-weight: 700; font-size: 14px; color: var(--color-text);">${sanitizeHTML(n.title)}</span>
                          <span style="font-size: 11px; color: var(--color-text-secondary);">${formatRelativeTime(n.createdAt)}</span>
                        </div>
                        <p style="font-size: 13px; color: var(--color-text-secondary); margin: 4px 0 0; line-height: 1.4;">${sanitizeHTML(n.body)}</p>
                      </div>
                      <button class="btn btn-ghost btn-delete-single-notif" data-id="${n.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">
                        ${icon('trash', 14)}
                      </button>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    const markAllBtn = container.querySelector('#btn-mark-all-read');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        for (const n of notifications) {
          if (!n.isRead) {
            n.isRead = true;
            await update('notifications', n);
          }
        }
        toast('تم تحديد جميع التنبيهات كمقروءة', 'success');
        const updated = await loadData();
        renderView(updated);
      });
    }

    const clearAllBtn = container.querySelector('#btn-clear-all-notifs');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', async () => {
        const ok = await confirm('مسح الإشعارات', 'هل تريد حذف جميع الإشعارات السابقة؟', 'مسح', 'إلغاء');
        if (ok) {
          await clear('notifications');
          toast('تم مسح جميع الإشعارات', 'info');
          renderView([]);
        }
      });
    }

    container.querySelectorAll('.btn-delete-single-notif').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await remove('notifications', btn.dataset.id);
        const updated = await loadData();
        renderView(updated);
      });
    });
  }

  const initialData = await loadData();
  renderView(initialData);
}
