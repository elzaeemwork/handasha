/**
 * onboarding.js - شاشات الإرشاد والترحيب بالطلاب الجدد
 * Introductory walkthrough explaining offline storage, subjects, schedule, and tools.
 * @module modules/onboarding
 */

import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';

const SLIDES = [
  {
    icon: 'book',
    title: 'أهلاً بك في تطبيق «هندسها» 👋',
    desc: 'رفيقك الدراسي الجامعي المتكامل، صُمم خصيصاً لطلاب الهندسة ليجمع كل ما تحتاجه في تطبيق واحد سريع وبسيط.',
    color: '#3657C8',
  },
  {
    icon: 'folder',
    title: 'ملفاتك ومحاضراتك بدون إنترنت 📚',
    desc: 'احفظ ملفات الـ PDF، ملخصات المواد، والتسجيلات مباشرة في هاتفك، وافتحها في أي وقت دون الحاجة لشبكة أو باقة إنترنت.',
    color: '#24A58A',
  },
  {
    icon: 'calendar',
    title: 'تنظيم الجدول والكوزات والواجبات ⏰',
    desc: 'لا تفوت موعد تسليم شيت أو كوز مفاجئ. جدول أسبوعي مرن، تنبيهات، وعد تنازلي دقيق للامتحانات.',
    color: '#E8A23A',
  },
  {
    icon: 'calculator',
    title: 'أدوات هندسية متطورة ⚙️',
    desc: 'حاسبة علمية متقدمة، مؤقت تركيز بومودورو، بطاقات تعليمية للمراجعة النشطة، وخرائط ذهنية للمفاهيم المعقدة.',
    color: '#8b5cf6',
  },
];

export async function render(container) {
  let step = 0;

  function renderSlide() {
    const cur = SLIDES[step];
    const isLast = step === SLIDES.length - 1;

    container.innerHTML = `
      <div style="min-height: calc(100vh - 120px); display: flex; flex-direction: column; justify-content: space-between; padding: 24px 16px; max-width: 480px; margin: 0 auto; text-align: center;">
        <!-- Top Skip Button -->
        <div style="display: flex; justify-content: flex-end;">
          <button id="btn-skip-onboarding" class="btn btn-ghost" style="color: var(--color-text-secondary); font-size: 13px;">
            تخطي
          </button>
        </div>

        <!-- Center Slide Content -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px 0;">
          <div style="width: 90px; height: 90px; border-radius: 24px; background: ${cur.color}15; color: ${cur.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px ${cur.color}20;">
            ${icon(cur.icon, 48)}
          </div>

          <h2 style="font-size: 22px; font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.3;">
            ${cur.title}
          </h2>

          <p style="font-size: 15px; color: var(--color-text-secondary); margin: 0; line-height: 1.6; max-width: 340px;">
            ${cur.desc}
          </p>

          <!-- Step Indicators -->
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            ${SLIDES.map(
              (_, i) => `
              <div style="width: ${i === step ? '24px' : '8px'}; height: 8px; border-radius: 4px; background: ${i === step ? 'var(--color-primary)' : 'var(--color-border)'}; transition: all 0.3s ease;"></div>
            `
            ).join('')}
          </div>
        </div>

        <!-- Bottom Navigation -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-next-onboarding" class="btn btn-primary" style="padding: 14px; font-size: 16px; font-weight: 700;">
            ${isLast ? 'ابدأ دراستك الآن 🚀' : 'التالي ➔'}
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btn-skip-onboarding').addEventListener('click', finish);
    container.querySelector('#btn-next-onboarding').addEventListener('click', () => {
      if (isLast) {
        finish();
      } else {
        step++;
        renderSlide();
      }
    });
  }

  function finish() {
    localStorage.setItem('handasha_onboarded', 'true');
    navigate('/home');
  }

  renderSlide();
}
