/**
 * formatting.js - Formatting Utilities for HANDASHA App
 * Arabic-first display formatters for files, durations, and numbers.
 * @module utils/formatting
 */

/** Eastern Arabic numerals mapping (optional) */
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Format a number or numeric string.
 * Uses standard numerals (0, 1, 2, 3...) for clear readability in engineering and academic contexts.
 * @param {number|string} num
 * @param {boolean} [useEastern=false]
 * @returns {string}
 */
export function formatNumber(num, useEastern = false) {
  if (num === null || num === undefined) return '';
  if (useEastern) {
    return String(num).replace(/[0-9]/g, (d) => ARABIC_DIGITS[parseInt(d, 10)]);
  }
  return String(num);
}

/**
 * Format a byte count into a human-readable Arabic file size.
 * @param {number} bytes - File size in bytes
 * @returns {string} e.g., "٢.٥ م.ب", "٣٤٠ ك.ب"
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return formatNumber('0') + ' بايت';

  const units = [
    { threshold: 1024 * 1024 * 1024, label: 'غ.ب' },  // GB
    { threshold: 1024 * 1024, label: 'م.ب' },          // MB
    { threshold: 1024, label: 'ك.ب' },                 // KB
  ];

  for (const unit of units) {
    if (bytes >= unit.threshold) {
      const value = bytes / unit.threshold;
      // Show one decimal if not a round number
      const formatted = value % 1 === 0
        ? formatNumber(value)
        : formatNumber(value.toFixed(1));
      return `${formatted} ${unit.label}`;
    }
  }

  return `${formatNumber(bytes)} بايت`;
}

/**
 * Format a duration in seconds to MM:SS or HH:MM:SS with Arabic numerals.
 * @param {number} totalSeconds - Duration in seconds
 * @returns {string} e.g., "٢٥:٠٠" or "١:٣٠:٠٠"
 */
export function formatDuration(totalSeconds) {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
    return formatNumber('00:00');
  }

  const seconds = Math.floor(totalSeconds);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hrs > 0) {
    return formatNumber(`${hrs}:${pad(mins)}:${pad(secs)}`);
  }

  return formatNumber(`${pad(mins)}:${pad(secs)}`);
}

/**
 * Format a short duration for display (minutes only).
 * @param {number} totalSeconds
 * @returns {string} e.g., "٢٥ دقيقة"
 */
export function formatDurationText(totalSeconds) {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '٠ دقيقة';

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const parts = [];

  if (hours > 0) {
    if (hours === 1) parts.push('ساعة');
    else if (hours === 2) parts.push('ساعتين');
    else if (hours <= 10) parts.push(`${formatNumber(hours)} ساعات`);
    else parts.push(`${formatNumber(hours)} ساعة`);
  }

  if (minutes > 0 || parts.length === 0) {
    if (minutes === 1) parts.push('دقيقة');
    else if (minutes === 2) parts.push('دقيقتين');
    else if (minutes <= 10) parts.push(`${formatNumber(minutes)} دقائق`);
    else parts.push(`${formatNumber(minutes)} دقيقة`);
  }

  return parts.join(' و ');
}

/**
 * Truncate text to a maximum length, appending ellipsis if truncated.
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum character count
 * @returns {string}
 */
export function truncateText(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Arabic-aware pluralization.
 * Arabic has special forms for 1, 2, 3-10, and 11+.
 *
 * @param {number} count - The number
 * @param {string} singular - Form for 1 (e.g., "مادة")
 * @param {string} dual - Form for 2 (e.g., "مادتان")
 * @param {string} plural - Form for 3-10 (e.g., "مواد")
 * @param {string} [pluralAbove10] - Form for 11+ (e.g., "مادة"), defaults to singular
 * @returns {string} e.g., "٣ مواد"
 */
export function pluralize(count, singular, dual, plural, pluralAbove10) {
  const arabicCount = formatNumber(count);

  if (count === 0) return `لا ${plural}`;
  if (count === 1) return `${singular} واحدة` === singular ? singular : singular;
  if (count === 2) return `${dual}`;
  if (count >= 3 && count <= 10) return `${arabicCount} ${plural}`;

  // For 11 and above, Arabic uses the singular accusative (tamyiz)
  const aboveTen = pluralAbove10 || singular;
  return `${arabicCount} ${aboveTen}`;
}

/**
 * Format a percentage with Arabic numerals.
 * @param {number} value - Percentage value (0-100)
 * @returns {string} e.g., "٧٥٪"
 */
export function formatPercentage(value) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return `${formatNumber(clamped)}٪`;
}

/**
 * Format a grade/score display.
 * @param {number} score - Achieved score
 * @param {number} total - Total possible score
 * @returns {string} e.g., "٨٥ / ١٠٠"
 */
export function formatScore(score, total) {
  return `${formatNumber(score)} / ${formatNumber(total)}`;
}
