/**
 * theme.js - Theme (Light / Dark) Manager for HANDASHA App
 * @module utils/theme
 */

export function getTheme() {
  const saved = localStorage.getItem('handasha_theme');
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme) {
  const effectiveTheme = theme || getTheme();
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  localStorage.setItem('handasha_theme', effectiveTheme);

  // Update theme-color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', effectiveTheme === 'dark' ? '#121824' : '#3657C8');
  }
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
