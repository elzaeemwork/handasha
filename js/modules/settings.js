/**
 * settings.js - إعدادات التطبيق والمظهر
 * Theme switching (Light/Dark), timer defaults, iOS installation guide, and privacy info.
 * @module modules/settings
 */

import { icon } from '../utils/icons.js';
import { toast, confirm } from '../utils/ui.js';
import { applyTheme, getTheme } from '../utils/theme.js';
import { navigate } from '../router.js';

export async function render(container) {
  const currentTheme = getTheme();
  const studyMin = Number(localStorage.getItem('pomodoro_study')) || 25;
  const breakMin = Number(localStorage.getItem('pomodoro_short_break')) || 5;
  const longBreakMin = Number(localStorage.getItem('pomodoro_long_break')) || 15;

  container.innerHTML = `
    <div class="tasks-container" style="max-width: 600px; margin: 0 auto;">
      <!-- Header -->
      <div>
        <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الإعدادات</h2>
        <span style="font-size: 13px; color: var(--color-text-secondary);">تخصيص المظهر، مؤقت المذاكرة، وتثبيت التطبيق</span>
      </div>

      <!-- Appearance Card -->
      <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">المظهر والسمة</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button id="btn-theme-light" class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'}" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px;">
            ${icon('sun', 18)}
            <span>الوضع الفاتح</span>
          </button>
          <button id="btn-theme-dark" class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'}" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px;">
            ${icon('moon', 18)}
            <span>الوضع الداكن</span>
          </button>
        </div>
      </div>

      <!-- Focus Timer Preferences -->
      <div class="card" style="display: flex; flex-direction: column; gap: 14px;">
        <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">إعدادات مؤقت التركيز (بالدقائق)</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">جلسة المذاكرة</label>
            <input type="number" id="setting-study-min" value="${studyMin}" min="5" max="120" 
              style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; text-align: center;" />
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">استراحة قصيرة</label>
            <input type="number" id="setting-break-min" value="${breakMin}" min="1" max="30" 
              style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; text-align: center;" />
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">استراحة طويلة</label>
            <input type="number" id="setting-long-break-min" value="${longBreakMin}" min="5" max="60" 
              style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; text-align: center;" />
          </div>
        </div>

        <button id="btn-save-timer-settings" class="btn btn-primary btn-sm" style="align-self: flex-start;">
          حفظ أوقات المؤقت
        </button>
      </div>

      <!-- iOS Installation Guide Card -->
      <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
        <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text); margin: 0;">تثبيت التطبيق على iPhone (PWA)</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0; line-height: 1.5;">
          يعمل التطبيق كتطبيق أصلي على شاشة هاتفك دون الحاجة لمتجر App Store:
        </p>
        <ol style="margin: 0; padding-right: 20px; font-size: 13px; color: var(--color-text); line-height: 1.6;">
          <li>افتح الرابط في متصفح <b>Safari</b> على جهاز iPhone.</li>
          <li>اضغط على زر المشاركة (<b>Share</b>) في أسفل الشاشة.</li>
          <li>اختر <b>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</b>.</li>
          <li>اضغط <b>إضافة (Add)</b> في الزاوية العلوية.</li>
        </ol>
      </div>

      <!-- Backup Link Shortcut -->
      <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 15px; font-weight: 700; color: var(--color-text);">النسخ الاحتياطي والبيانات</div>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">تصدير واستعادة ملفاتك وبياناتك الدراسية</div>
        </div>
        <button id="btn-goto-backup" class="btn btn-secondary btn-sm">فتح النسخ</button>
      </div>

      <!-- Privacy & Offline Info -->
      <div class="card" style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.6;">
        <div style="font-size: 14px; font-weight: 700; color: var(--color-text);">🔒 الخصوصية والعمل دون إنترنت</div>
        <div>• جميع المواد والملاحظات والملفات تُحفظ محلياً 100٪ داخل ذاكرة هاتفك.</div>
        <div>• لا يتم إرسال أي معلومة أو ملف دراسي إلى خادم خارجي.</div>
        <div>• التطبيق يعمل بشكل كامل وبسرعة قصوى دون الحاجة لاتصال بالإنترنت بعد أول تحميل.</div>
      </div>

      <!-- App Credits -->
      <div style="text-align: center; padding: 16px 0; font-size: 12px; color: var(--color-text-secondary);">
        <div style="font-weight: 700; color: var(--color-primary); font-size: 14px;">هندسها | HANDASHA</div>
        <div>إصدار 1.0.0 • مصمم لطلاب الهندسة</div>
      </div>
    </div>
  `;

  // Event Listeners
  container.querySelector('#btn-theme-light').addEventListener('click', () => {
    applyTheme('light');
    render(container);
    toast('تم تفعيل الوضع الفاتح', 'info', 1500);
  });

  container.querySelector('#btn-theme-dark').addEventListener('click', () => {
    applyTheme('dark');
    render(container);
    toast('تم تفعيل الوضع الداكن', 'info', 1500);
  });

  container.querySelector('#btn-save-timer-settings').addEventListener('click', () => {
    const sVal = Math.max(1, Number(container.querySelector('#setting-study-min').value) || 25);
    const bVal = Math.max(1, Number(container.querySelector('#setting-break-min').value) || 5);
    const lVal = Math.max(1, Number(container.querySelector('#setting-long-break-min').value) || 15);

    localStorage.setItem('pomodoro_study', sVal);
    localStorage.setItem('pomodoro_short_break', bVal);
    localStorage.setItem('pomodoro_long_break', lVal);

    toast('تم حفظ أوقات مؤقت التركيز بنجاح', 'success');
  });

  container.querySelector('#btn-goto-backup').addEventListener('click', () => {
    navigate('/backup');
  });
}
