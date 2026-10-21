/**
 * هندسها | HANDASHA - Main Application Entry Point
 * PWA initialization, routing, service worker, navigation tabs & FAB.
 * @module app
 */

import { initRouter, navigate, getCurrentRoute } from './router.js';
import { getDB, getAll, update } from './db/database.js';
import { toast, bottomSheet } from './utils/ui.js';
import { icon } from './utils/icons.js';
import { applyTheme } from './utils/theme.js';

// Global application state
export const appState = {
  initialized: false,
  currentTab: 'home',
  dbReady: false,
  swRegistered: false,
  reminderInterval: null,
};

/**
 * Register Service Worker for offline PWA functionality.
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[HANDASHA] Service Workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './',
    });
    appState.swRegistered = true;
    console.log('[HANDASHA] Service Worker active:', registration.scope);

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          toast('تتوفر نسخة جديدة من التطبيق. أعد التحميل لتطبيقها.', 'info', 5000);
        }
      });
    });
  } catch (err) {
    console.error('[HANDASHA] SW registration error:', err);
  }
}

/**
 * Sync bottom navigation bar with current route.
 */
function syncBottomNav(path) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const tabs = nav.querySelectorAll('.nav-tab');
  let activeTab = 'home';

  if (path.startsWith('/subjects') || path.startsWith('/files')) {
    activeTab = 'subjects';
  } else if (path.startsWith('/calendar')) {
    activeTab = 'calendar';
  } else if (
    path.startsWith('/more') ||
    path.startsWith('/notes') ||
    path.startsWith('/focus-timer') ||
    path.startsWith('/flashcards') ||
    path.startsWith('/quizzes') ||
    path.startsWith('/mindmaps') ||
    path.startsWith('/calculator') ||
    path.startsWith('/statistics') ||
    path.startsWith('/backup') ||
    path.startsWith('/settings') ||
    path.startsWith('/notifications')
  ) {
    activeTab = 'more';
  }

  tabs.forEach((tab) => {
    if (tab.dataset.tab === activeTab) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.classList.remove('active');
      tab.removeAttribute('aria-current');
    }
  });

  appState.currentTab = activeTab;
}

/**
 * Setup bottom navigation event listeners.
 */
function setupBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const tabs = nav.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target === 'home') navigate('/home');
      else if (target === 'subjects') navigate('/subjects');
      else if (target === 'calendar') navigate('/calendar');
      else if (target === 'more') navigate('/more');
    });
  });

  // Listen to hash changes to keep nav in sync
  window.addEventListener('hashchange', () => {
    const route = getCurrentRoute();
    syncBottomNav(route);
  });
}

/**
 * Setup FAB (Floating Action Button).
 */
function setupFAB() {
  const fab = document.getElementById('fab');
  if (!fab) return;

  fab.addEventListener('click', async () => {
    const options = [
      { id: 'add-subject', label: 'إضافة مادة دراسية', icon: 'book' },
      { id: 'add-task', label: 'إضافة واجب أو مهمة', icon: 'check-square' },
      { id: 'add-lecture', label: 'إضافة محاضرة للجدول', icon: 'calendar' },
      { id: 'add-exam', label: 'إضافة كوز أو امتحان', icon: 'file-text' },
      { id: 'add-note', label: 'تدوين ملاحظة سريعة', icon: 'note' },
      { id: 'add-reminder', label: 'إضافة تذكير', icon: 'bell' },
    ];

    const choice = await bottomSheet('إضافة سريع', options);
    if (!choice) return;

    if (choice === 'add-subject') {
      navigate('/subjects');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fab-action', { detail: { action: 'add-subject' } })), 200);
    } else if (choice === 'add-task') {
      navigate('/tasks');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fab-action', { detail: { action: 'add-task' } })), 200);
    } else if (choice === 'add-lecture') {
      navigate('/schedule');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fab-action', { detail: { action: 'add-lecture' } })), 200);
    } else if (choice === 'add-exam') {
      navigate('/exams');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fab-action', { detail: { action: 'add-exam' } })), 200);
    } else if (choice === 'add-note') {
      navigate('/notes');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fab-action', { detail: { action: 'add-note' } })), 200);
    } else if (choice === 'add-reminder') {
      navigate('/calendar');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fab-action', { detail: { action: 'add-reminder' } })), 200);
    }
  });
}

/**
 * In-app reminder checker (checks due reminders every 60 seconds).
 */
async function checkDueReminders() {
  try {
    const reminders = await getAll('reminders');
    if (!reminders || !reminders.length) return;

    const now = Date.now();
    for (const r of reminders) {
      if (!r.isFired && r.remindAt && r.remindAt <= now) {
        r.isFired = true;
        await update('reminders', r);

        // Notify user via in-app toast
        toast(`⏰ تذكير: ${r.title || 'موعد مهم'}`, 'info', 6000);

        // Also add to notifications store
        try {
          const { add } = await import('./db/database.js');
          await add('notifications', {
            title: r.title || 'تذكير',
            body: `حان موعد التذكير المحدد: ${new Date(r.remindAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
            type: 'reminder',
            eventId: r.id,
            isRead: false,
            createdAt: now,
          });
        } catch (e) {
          console.warn('Failed to save notification record:', e);
        }
      }
    }
  } catch (err) {
    console.warn('Error checking reminders:', err);
  }
}

/**
 * Initialize app.
 */
async function init() {
  // 1. Apply theme early
  applyTheme();

  // 2. Setup Navigation & FAB
  setupBottomNav();
  setupFAB();

  // 3. Connect to IndexedDB
  try {
    await getDB();
    appState.dbReady = true;
  } catch (err) {
    console.error('[HANDASHA] Database initialization error:', err);
    toast('تعذر تهيئة قاعدة البيانات المحلية.', 'error');
  }

  // 4. Register Service Worker
  registerServiceWorker();

  // 5. Start reminder loop
  checkDueReminders();
  appState.reminderInterval = setInterval(checkDueReminders, 60000);

  // 6. Initialize SPA Router
  initRouter();
  syncBottomNav(getCurrentRoute());

  appState.initialized = true;
}

// Start app once DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
