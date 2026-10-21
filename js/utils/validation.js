/**
 * validation.js - Input Validation Utilities for HANDASHA App
 * Returns {valid: boolean, error?: string} objects for every check.
 * All error messages are in Arabic.
 * @module utils/validation
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message (only if invalid)
 */

/**
 * Check that a value is not empty/null/undefined.
 * @param {*} value - Value to check
 * @param {string} fieldName - Arabic field name for error message
 * @returns {ValidationResult}
 */
export function validateRequired(value, fieldName) {
  if (value === undefined || value === null) {
    return { valid: false, error: `حقل "${fieldName}" مطلوب.` };
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return { valid: false, error: `حقل "${fieldName}" لا يمكن أن يكون فارغاً.` };
  }
  return { valid: true };
}

/**
 * Validate string length is within bounds.
 * @param {string} value - String to check
 * @param {number} min - Minimum length (inclusive)
 * @param {number} max - Maximum length (inclusive)
 * @param {string} fieldName - Arabic field name for error message
 * @returns {ValidationResult}
 */
export function validateLength(value, min, max, fieldName) {
  if (typeof value !== 'string') {
    return { valid: false, error: `حقل "${fieldName}" يجب أن يكون نصاً.` };
  }

  const len = value.trim().length;

  if (len < min) {
    return {
      valid: false,
      error: `حقل "${fieldName}" يجب أن يكون ${min} حرف على الأقل.`,
    };
  }

  if (len > max) {
    return {
      valid: false,
      error: `حقل "${fieldName}" يجب ألّا يتجاوز ${max} حرف.`,
    };
  }

  return { valid: true };
}

/**
 * Validate that a value is a valid date.
 * Accepts Date objects, ISO strings, and timestamps.
 * @param {*} value - Value to validate
 * @returns {ValidationResult}
 */
export function validateDate(value) {
  if (!value) {
    return { valid: false, error: 'يجب تحديد تاريخ صالح.' };
  }

  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'التاريخ المُدخل غير صالح.' };
  }

  return { valid: true };
}

/**
 * Validate that a value is a valid time string (HH:MM format).
 * @param {string} value - Time string to validate
 * @returns {ValidationResult}
 */
export function validateTime(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'يجب تحديد وقت صالح.' };
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(value.trim())) {
    return { valid: false, error: 'الوقت يجب أن يكون بصيغة HH:MM (مثال: ١٤:٣٠).' };
  }

  return { valid: true };
}

/**
 * Validate file size against a maximum in megabytes.
 * @param {number} sizeBytes - File size in bytes
 * @param {number} maxMB - Maximum allowed size in MB
 * @returns {ValidationResult}
 */
export function validateFileSize(sizeBytes, maxMB) {
  if (typeof sizeBytes !== 'number' || sizeBytes < 0) {
    return { valid: false, error: 'حجم الملف غير صالح.' };
  }

  const maxBytes = maxMB * 1024 * 1024;

  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `حجم الملف يتجاوز الحد المسموح (${maxMB} م.ب).`,
    };
  }

  return { valid: true };
}

/**
 * Validate file MIME type against a list of allowed types.
 * @param {string} type - MIME type of the file
 * @param {string[]} allowedTypes - Array of allowed MIME types or type prefixes
 *   (e.g., ['image/', 'application/pdf', 'audio/'])
 * @returns {ValidationResult}
 */
export function validateFileType(type, allowedTypes) {
  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'نوع الملف غير معروف.' };
  }

  const isAllowed = allowedTypes.some((allowed) => {
    // Support prefix matching (e.g., 'image/' matches 'image/png')
    if (allowed.endsWith('/')) {
      return type.startsWith(allowed);
    }
    return type === allowed;
  });

  if (!isAllowed) {
    return {
      valid: false,
      error: `نوع الملف "${type}" غير مدعوم. الأنواع المسموحة: ${allowedTypes.join('، ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize a string by escaping HTML entities to prevent XSS.
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for innerHTML
 */
export function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';

  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  };

  return str.replace(/[&<>"'/`]/g, (char) => escapeMap[char]);
}

/**
 * Run multiple validators and return the first failure or a success result.
 * @param {ValidationResult[]} results - Array of validation results
 * @returns {ValidationResult}
 */
export function combineValidations(...results) {
  for (const result of results) {
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}
