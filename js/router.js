/**
 * router.js - Hash-based SPA Router for HANDASHA App
 * Provides client-side routing with lazy module loading and page transitions.
 * @module router
 */

/**
 * Route definition: maps a URL pattern to a lazy-loaded module.
 * @typedef {Object} RouteDefinition
 * @property {string} pattern - URL pattern with :param placeholders
 * @property {RegExp} regex - Compiled regex for matching
 * @property {string[]} paramNames - Extracted parameter names
 * @property {function(): Promise<{render: function}>} loader - Dynamic import function
 */

/**
 * Compile a route pattern into a regex and extract param names.
 * @param {string} pattern - e.g., "/subjects/:id"
 * @returns {{ regex: RegExp, paramNames: string[] }}
 */
function compilePattern(pattern) {
  const paramNames = [];
  const regexStr = pattern.replace(/:([a-zA-Z]+)/g, (_match, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

/**
 * All registered route definitions.
 * Each route lazy-loads its page module on first navigation.
 * @type {RouteDefinition[]}
 */
const routes = [
  {
    pattern: '/home',
    loader: () => import('./modules/dashboard.js'),
  },
  {
    pattern: '/subjects',
    loader: () => import('./modules/subjects.js'),
  },
  {
    pattern: '/subjects/:id',
    loader: () => import('./modules/subjects.js'),
  },
  {
    pattern: '/files/:subjectId',
    loader: () => import('./modules/files.js'),
  },
  {
    pattern: '/schedule',
    loader: () => import('./modules/schedule.js'),
  },
  {
    pattern: '/tasks',
    loader: () => import('./modules/tasks.js'),
  },
  {
    pattern: '/exams',
    loader: () => import('./modules/exams.js'),
  },
  {
    pattern: '/calendar',
    loader: () => import('./modules/calendar.js'),
  },
  {
    pattern: '/more',
    loader: () => import('./modules/more.js'),
  },
  {
    pattern: '/notes',
    loader: () => import('./modules/notes.js'),
  },
  {
    pattern: '/notes/:id',
    loader: () => import('./modules/notes.js'),
  },
  {
    pattern: '/focus-timer',
    loader: () => import('./modules/focus-timer.js'),
  },
  {
    pattern: '/flashcards',
    loader: () => import('./modules/flashcards.js'),
  },
  {
    pattern: '/flashcards/:deckId',
    loader: () => import('./modules/flashcards.js'),
  },
  {
    pattern: '/quizzes',
    loader: () => import('./modules/quizzes.js'),
  },
  {
    pattern: '/quizzes/:id',
    loader: () => import('./modules/quizzes.js'),
  },
  {
    pattern: '/mindmaps',
    loader: () => import('./modules/mindmaps.js'),
  },
  {
    pattern: '/mindmaps/:id',
    loader: () => import('./modules/mindmaps.js'),
  },
  {
    pattern: '/calculator',
    loader: () => import('./modules/calculator.js'),
  },
  {
    pattern: '/statistics',
    loader: () => import('./modules/statistics.js'),
  },
  {
    pattern: '/backup',
    loader: () => import('./modules/backup.js'),
  },
  {
    pattern: '/settings',
    loader: () => import('./modules/settings.js'),
  },
  {
    pattern: '/notifications',
    loader: () => import('./modules/notifications.js'),
  },
  {
    pattern: '/onboarding',
    loader: () => import('./modules/onboarding.js'),
  },
].map((route) => {
  const { regex, paramNames } = compilePattern(route.pattern);
  return { ...route, regex, paramNames };
});

/** Default route path */
const DEFAULT_ROUTE = '/home';

/** Currently active route path */
let currentPath = '';

/** Navigation history stack */
const history = [];

/** Module cache to avoid re-importing */
const moduleCache = new Map();

/** Lifecycle cleanup function from current page */
let currentCleanup = null;

/**
 * Get the main content container element.
 * @returns {HTMLElement}
 */
function getContainer() {
  const el = document.getElementById('app-content');
  if (!el) {
    throw new Error('عنصر #app-content غير موجود في الصفحة.');
  }
  return el;
}

/**
 * Match a path against all route definitions.
 * @param {string} path - Path to match (e.g., "/subjects/abc123")
 * @returns {{ route: RouteDefinition, params: Object } | null}
 */
function matchRoute(path) {
  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return { route, params };
    }
  }
  return null;
}

/**
 * Perform a simple fade-out/fade-in page transition.
 * @param {HTMLElement} container
 * @param {function(): Promise<void>} renderFn - Function that renders new content
 */
async function transitionPage(container, renderFn) {
  // Fade out
  container.style.opacity = '0';
  container.style.transition = 'opacity 0.15s ease-out';

  await new Promise((resolve) => setTimeout(resolve, 150));

  // Render new content
  await renderFn();

  // Fade in
  container.style.opacity = '1';
  container.style.transition = 'opacity 0.2s ease-in';
}

/**
 * Show a loading state in the container.
 * @param {HTMLElement} container
 */
function showLoading(container) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;opacity:0.5;">
      <div class="loading-spinner"></div>
    </div>
  `;
}

/**
 * Show a 404 not-found page.
 * @param {HTMLElement} container
 * @param {string} path
 */
function showNotFound(container, path) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem;">
      <div style="font-size:4rem;margin-bottom:1rem;">🔍</div>
      <h2 style="margin:0 0 0.5rem;color:var(--color-text);">الصفحة غير موجودة</h2>
      <p style="color:var(--color-text-secondary);margin:0 0 1.5rem;">المسار "${path}" غير موجود.</p>
      <button onclick="location.hash='#/home'" style="
        background:var(--color-primary);color:#fff;border:none;padding:0.75rem 2rem;
        border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;">
        العودة للرئيسية
      </button>
    </div>
  `;
}

/**
 * Show an error page when module loading fails.
 * @param {HTMLElement} container
 * @param {Error} error
 */
function showError(container, error) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem;">
      <div style="font-size:4rem;margin-bottom:1rem;">⚠️</div>
      <h2 style="margin:0 0 0.5rem;color:var(--color-text);">حدث خطأ</h2>
      <p style="color:var(--color-text-secondary);margin:0 0 1.5rem;">${error.message || 'خطأ غير متوقع أثناء تحميل الصفحة.'}</p>
      <button onclick="location.reload()" style="
        background:var(--color-primary);color:#fff;border:none;padding:0.75rem 2rem;
        border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;">
        إعادة تحميل
      </button>
    </div>
  `;
}

/**
 * Handle a route change: match the path, load the module, render the page.
 * @param {string} path - New path to navigate to
 * @param {boolean} [addToHistory=true] - Whether to add to history stack
 */
async function handleRoute(path, addToHistory = true) {
  console.log('[ROUTER] handleRoute called with path:', path);
  // Normalize path
  if (!path || path === '/') {
    path = DEFAULT_ROUTE;
  }

  // Don't re-render if same path
  if (path === currentPath) return;

  const container = getContainer();

  // Clean up previous page if it had a cleanup function
  if (typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (err) {
      console.warn('خطأ في تنظيف الصفحة السابقة:', err);
    }
    currentCleanup = null;
  }

  // Add current path to history before navigating
  if (addToHistory && currentPath) {
    history.push(currentPath);
    // Limit history size
    if (history.length > 50) {
      history.shift();
    }
  }

  const previousPath = currentPath;
  currentPath = path;

  // Match route
  const matched = matchRoute(path);

  if (!matched) {
    await transitionPage(container, async () => {
      showNotFound(container, path);
    });
    dispatchRouteEvent(path, previousPath);
    return;
  }

  const { route, params } = matched;

  await transitionPage(container, async () => {
    showLoading(container);

    try {
      // Load module (with caching)
      let module;
      if (moduleCache.has(route.pattern)) {
        module = moduleCache.get(route.pattern);
      } else {
        module = await route.loader();
        moduleCache.set(route.pattern, module);
      }

      // Verify the module exports a render function
      if (typeof module.render !== 'function') {
        throw new Error(`الوحدة "${route.pattern}" لا تصدّر دالة render().`);
      }

      // Render the page
      const result = module.render(container, params);

      // If render returns a cleanup function, store it
      if (result && typeof result === 'function') {
        currentCleanup = result;
      } else if (result && typeof result.then === 'function') {
        // Handle async render
        const asyncResult = await result;
        if (typeof asyncResult === 'function') {
          currentCleanup = asyncResult;
        }
      }
    } catch (err) {
      console.error('خطأ في تحميل الصفحة:', err);
      showError(container, err);
    }
  });

  dispatchRouteEvent(path, previousPath);
}

/**
 * Dispatch a custom event when the route changes.
 * @param {string} newPath
 * @param {string} oldPath
 */
function dispatchRouteEvent(newPath, oldPath) {
  window.dispatchEvent(
    new CustomEvent('route-changed', {
      detail: { path: newPath, previousPath: oldPath },
    })
  );
}

/**
 * Navigate to a new path programmatically.
 * @param {string} path - Target path (e.g., "/subjects/abc123")
 */
export function navigate(path) {
  // Normalize: ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  window.location.hash = '#' + path;
}

export const navigateTo = navigate;

/**
 * Go back to the previous route in the app history.
 * Falls back to the default route if history is empty.
 */
export function goBack() {
  if (history.length > 0) {
    const prevPath = history.pop();
    window.location.hash = '#' + prevPath;
    // We pass false to not double-add to history
    handleRoute(prevPath, false);
  } else {
    navigate(DEFAULT_ROUTE);
  }
}

/**
 * Get the currently active route path.
 * @returns {string}
 */
export function getCurrentRoute() {
  return currentPath;
}

/**
 * Get the navigation history stack.
 * @returns {string[]}
 */
export function getHistory() {
  return [...history];
}

/**
 * Extract the path from the current URL hash.
 * @returns {string}
 */
function getPathFromHash() {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') {
    return DEFAULT_ROUTE;
  }
  // Remove the leading '#'
  return hash.slice(1);
}

/**
 * Initialize the router. Listen for hash changes and load the initial route.
 * Call this once when the app starts.
 */
export function initRouter() {
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const path = getPathFromHash();
    handleRoute(path);
  });

  // Handle initial load
  const initialPath = getPathFromHash();

  // Set the hash if not present
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    window.location.hash = '#' + DEFAULT_ROUTE;
  }
  handleRoute(initialPath);
}

/**
 * Check if a given path is currently active (for nav highlighting).
 * @param {string} path - Path to check
 * @returns {boolean}
 */
export function isActive(path) {
  if (path === currentPath) return true;
  // Also match parent paths (e.g., /subjects is active when on /subjects/123)
  if (path !== '/' && currentPath.startsWith(path + '/')) return true;
  return false;
}
