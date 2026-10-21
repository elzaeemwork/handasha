/**
 * ui.js - Shared UI Components & Helpers for HANDASHA App
 * Accessible, mobile-first iOS-style UI interactions.
 * @module utils/ui
 */

import { icon } from './icons.js';
import { sanitizeHTML } from './validation.js';

/**
 * Display a toast notification.
 * @param {string} message - Message text
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Toast category
 * @param {number} [duration=3000] - Duration in ms
 */
export function toast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.setAttribute('role', 'alert');

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  else if (type === 'warning') iconName = 'warning';
  else if (type === 'error') iconName = 'x-circle';

  toastEl.innerHTML = `
    <span class="toast-icon">${icon(iconName, 20)}</span>
    <span class="toast-message">${sanitizeHTML(message)}</span>
  `;

  container.appendChild(toastEl);

  // Trigger animation
  requestAnimationFrame(() => {
    toastEl.classList.add('visible');
  });

  setTimeout(() => {
    toastEl.classList.remove('visible');
    setTimeout(() => {
      toastEl.remove();
    }, 300);
  }, duration);
}

/**
 * Custom confirmation dialog matching iOS / modern design.
 * @param {string} title - Dialog title
 * @param {string} message - Message / description
 * @param {string} [confirmText='تأكيد'] - Label for confirm button
 * @param {string} [cancelText='إلغاء'] - Label for cancel button
 * @param {boolean} [isDanger=false] - If true, confirm button is red
 * @returns {Promise<boolean>}
 */
export function confirm(title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', isDanger = false) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-card';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    dialog.innerHTML = `
      <div class="dialog-header">
        <h3 class="dialog-title">${sanitizeHTML(title)}</h3>
      </div>
      <div class="dialog-body">
        <p>${sanitizeHTML(message)}</p>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary cancel-btn">${sanitizeHTML(cancelText)}</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} confirm-btn">${sanitizeHTML(confirmText)}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('visible'));

    const cleanup = (result) => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('.cancel-btn').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.confirm-btn').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

/**
 * Generic Modal Dialog.
 * @param {string} title - Modal title
 * @param {string|HTMLElement} content - Content string or node
 * @param {Array<{text: string, className?: string, onClick?: Function}>} [actions=[]]
 * @returns {{close: Function, element: HTMLElement}}
 */
export function modal(title, content, actions = []) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay modal-overlay-wrapper';

  const modalEl = document.createElement('div');
  modalEl.className = 'modal-card';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h3 class="modal-title">${sanitizeHTML(title)}</h3>
    <button class="modal-close-btn" aria-label="إغلاق">${icon('x', 20)}</button>
  `;

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  actions.forEach((act) => {
    const btn = document.createElement('button');
    btn.className = act.className || 'btn btn-primary';
    btn.textContent = act.text;
    btn.addEventListener('click', () => {
      if (act.onClick) act.onClick(close);
    });
    footer.appendChild(btn);
  });

  modalEl.appendChild(header);
  modalEl.appendChild(body);
  if (actions.length > 0) modalEl.appendChild(footer);
  overlay.appendChild(modalEl);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  function close() {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 250);
  }

  header.querySelector('.modal-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { close, element: modalEl };
}

/**
 * Slide-up Bottom Sheet (Action Sheet).
 * @param {string} title - Sheet title
 * @param {Array<{id: string, label: string, icon?: string, danger?: boolean}>} options
 * @returns {Promise<string|null>} Resolves to selected option id or null if dismissed
 */
export function bottomSheet(title, options) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';

    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet';

    let optionsHTML = options
      .map(
        (opt) => `
        <button class="sheet-item ${opt.danger ? 'sheet-item-danger' : ''}" data-id="${opt.id}">
          ${opt.icon ? `<span class="sheet-item-icon">${icon(opt.icon, 20)}</span>` : ''}
          <span class="sheet-item-text">${sanitizeHTML(opt.label)}</span>
        </button>
      `
      )
      .join('');

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3 class="sheet-title">${sanitizeHTML(title)}</h3>
      </div>
      <div class="sheet-body">
        ${optionsHTML}
      </div>
      <div class="sheet-footer">
        <button class="btn btn-secondary btn-block sheet-cancel">إلغاء</button>
      </div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      sheet.classList.add('visible');
    });

    const cleanup = (selectedId) => {
      overlay.classList.remove('visible');
      sheet.classList.remove('visible');
      setTimeout(() => overlay.remove(), 250);
      resolve(selectedId);
    };

    sheet.querySelectorAll('.sheet-item').forEach((item) => {
      item.addEventListener('click', () => {
        cleanup(item.dataset.id);
      });
    });

    sheet.querySelector('.sheet-cancel').addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });
  });
}

/**
 * Render empty state markup.
 * @param {string} iconName - Icon identifier
 * @param {string} title - Title
 * @param {string} description - Details
 * @param {string} [actionText] - Action button text
 * @param {Function} [actionFn] - Action button callback
 * @returns {string|HTMLElement}
 */
export function emptyState(iconName, title, description, actionText, actionFn) {
  const container = document.createElement('div');
  container.className = 'empty-state';

  let iconMarkup = '';
  if (typeof iconName === 'string') {
    if (iconName.trim().startsWith('<svg')) {
      iconMarkup = iconName;
    } else {
      let resolvedIcon = iconName;
      if (iconName === 'alert') resolvedIcon = 'warning';
      else if (iconName === 'task') resolvedIcon = 'check-square';
      else if (iconName === 'exam') resolvedIcon = 'file-text';
      iconMarkup = icon(resolvedIcon, 48);
    }
  } else {
    iconMarkup = icon('info', 48);
  }

  container.innerHTML = `
    <div class="empty-state-icon">${iconMarkup}</div>
    <h3 class="empty-state-title">${sanitizeHTML(title || '')}</h3>
    <p class="empty-state-desc">${sanitizeHTML(description || '')}</p>
    ${actionText ? `<button class="btn btn-primary empty-state-btn">${sanitizeHTML(actionText)}</button>` : ''}
  `;

  if (actionText && actionFn) {
    const btn = container.querySelector('.empty-state-btn');
    if (btn) btn.addEventListener('click', actionFn);
  }

  container.toString = function () {
    return this.outerHTML;
  };

  return container;
}

/**
 * Render loading spinner markup. Supports both DOM Node (appendChild) and HTML string (innerHTML).
 * @param {string} [text='جاري التحميل...']
 * @returns {HTMLElement}
 */
export function loadingSpinner(text = 'جاري التحميل...') {
  const container = document.createElement('div');
  container.className = 'loading-container';
  container.innerHTML = `
    <div class="spinner"></div>
    <p class="loading-text">${sanitizeHTML(text)}</p>
  `;
  container.toString = function () {
    return this.outerHTML;
  };
  return container;
}

/**
 * Render a search bar.
 * @param {string} placeholder - Placeholder text
 * @param {function(string): void} onSearch - Debounced callback
 * @returns {HTMLElement}
 */
export function searchBar(placeholder, onSearch) {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-bar';

  wrapper.innerHTML = `
    <span class="search-icon">${icon('search', 18)}</span>
    <input type="text" class="search-input" placeholder="${sanitizeHTML(placeholder)}" dir="rtl" />
    <button class="search-clear" style="display:none;" aria-label="مسح">${icon('x', 16)}</button>
  `;

  const input = wrapper.querySelector('.search-input');
  const clearBtn = wrapper.querySelector('.search-clear');
  let timeout;

  input.addEventListener('input', () => {
    clearBtn.style.display = input.value ? 'flex' : 'none';
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      onSearch(input.value.trim());
    }, 250);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
    onSearch('');
  });

  return wrapper;
}

/**
 * Return badge markup.
 * @param {string} text
 * @param {'default'|'primary'|'success'|'warning'|'danger'} [type='default']
 * @returns {string}
 */
export function badge(text, type = 'default') {
  return `<span class="badge badge-${type}">${sanitizeHTML(text)}</span>`;
}

/**
 * Return progress bar markup.
 * @param {number} value
 * @param {number} [max=100]
 * @param {string} [color]
 * @returns {string}
 */
export function progressBar(value, max = 100, color = 'var(--color-primary)') {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100))) || 0;
  return `
    <div class="progress-bar-container" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${color};"></div>
    </div>
  `;
}

/**
 * Formats task/exam status into an Arabic badge.
 * @param {string} status
 * @returns {string}
 */
export function formatStatusBadge(status) {
  switch (status) {
    case 'notStarted':
      return badge('لم تبدأ', 'default');
    case 'inProgress':
      return badge('قيد التنفيذ', 'warning');
    case 'completed':
      return badge('مكتملة', 'success');
    case 'overdue':
      return badge('متأخرة', 'danger');
    case 'ready':
      return badge('جاهز', 'success');
    case 'reviewing':
      return badge('أراجع', 'warning');
    default:
      return badge(status, 'default');
  }
}
