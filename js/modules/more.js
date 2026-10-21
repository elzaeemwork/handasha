/**
 * more.js - قائمة الأدوات الإضافية (المزيد)
 * Central hub for secondary study tools, calculator, pomodoro, notes, mindmaps, backup & settings.
 * @module modules/more
 */

import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';

const TOOLS = [
  {
    id: 'notes',
    title: 'الملاحظات الدراسية',
    desc: 'تدوين الأفكار والشروحات وربطها بالمواد',
    icon: 'note',
    color: '#3657C8',
    route: '/notes',
  },
  {
    id: 'focus-timer',
    title: 'مؤقت التركيز',
    desc: 'تقنية بومودورو للمذاكرة وإحصاء ساعات الدراسة',
    icon: 'timer',
    color: '#D9534F',
    route: '/focus-timer',
  },
  {
    id: 'flashcards',
    title: 'البطاقات التعليمية',
    desc: 'الحفظ والمراجعة النشطة بالقوانين والتعاريف',
    icon: 'cards',
    color: '#24A58A',
    route: '/flashcards',
  },
  {
    id: 'mindmaps',
    title: 'الخرائط الذهنية',
    desc: 'رسم المخططات وتفرع المفاهيم الهندسية',
    icon: 'brain',
    color: '#8b5cf6',
    route: '/mindmaps',
  },
  {
    id: 'quizzes',
    title: 'الاختبارات الذاتية',
    desc: 'اختبارات الاختيار من متعدد والصح والخطأ',
    icon: 'quiz',
    color: '#f59e0b',
    route: '/quizzes',
  },
  {
    id: 'calculator',
    title: 'الحاسبة الهندسية',
    desc: 'حاسبة علمية وتحويلات الاتصالات والوحدات',
    icon: 'calculator',
    color: '#06b6d4',
    route: '/calculator',
  },
  {
    id: 'statistics',
    title: 'الإحصاءات والتقدم',
    desc: 'تحليل ساعات الإنجاز وتوزيع المهام والمواد',
    icon: 'chart',
    color: '#258B68',
    route: '/statistics',
  },
  {
    id: 'notifications',
    title: 'مركز التنبيهات',
    desc: 'التذكيرات الداخلية وإشعارات الكوزات والمهام',
    icon: 'bell',
    color: '#E8A23A',
    route: '/notifications',
  },
  {
    id: 'backup',
    title: 'النسخ الاحتياطي',
    desc: 'تصدير واستيراد بياناتك وملفاتك بأمان محلياً',
    icon: 'backup',
    color: '#3657C8',
    route: '/backup',
  },
  {
    id: 'settings',
    title: 'الإعدادات والمظهر',
    desc: 'الوضع الداكن، إعدادات الجدول، وبيانات التطبيق',
    icon: 'settings',
    color: '#748094',
    route: '/settings',
  },
];

export async function render(container) {
  container.innerHTML = `
    <div class="more-container">
      <div>
        <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الأدوات الدراسية</h2>
        <span style="font-size: 13px; color: var(--color-text-secondary);">مجموعة أدوات هندسية متكاملة تعمل بدون إنترنت</span>
      </div>

      <div class="more-grid">
        ${TOOLS.map(
          (t) => `
          <div class="more-item-card" data-route="${t.route}">
            <div class="more-item-icon" style="background: ${t.color}15; color: ${t.color};">
              ${icon(t.icon, 26)}
            </div>
            <div class="more-item-title">${t.title}</div>
            <div class="more-item-desc">${t.desc}</div>
          </div>
        `
        ).join('')}
      </div>

      <!-- App Branding Footer -->
      <div style="text-align: center; padding: 24px 0 12px; color: var(--color-text-secondary); font-size: 12px; border-top: 1px solid var(--color-border); margin-top: 10px;">
        <div style="font-weight: 700; color: var(--color-primary); font-size: 14px; margin-bottom: 2px;">هندسها | HANDASHA</div>
        <div>رفيقك الدراسي لطلاب الهندسة • إصدار 1.0.0</div>
        <div style="margin-top: 4px; font-size: 11px;">جميع البيانات والملفات محفوظة محلياً داخل جهازك</div>
      </div>
    </div>
  `;

  container.querySelectorAll('.more-item-card').forEach((card) => {
    card.addEventListener('click', () => {
      navigate(card.dataset.route);
    });
  });
}
