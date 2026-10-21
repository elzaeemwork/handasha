/**
 * dates.js - Arabic Date Utilities for HANDASHA App
 * All date formatting uses Arabic locale and local timezone.
 * @module utils/dates
 */

/** Arabic day names (Sunday=0 … Saturday=6) */
const DAY_NAMES = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

/** Arabic month names (January=0 … December=11) */
const MONTH_NAMES = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
];

/** Eastern Arabic numerals mapping */
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Convert a number (or numeric string) to Eastern Arabic numerals.
 * @param {number|string} num
 * @returns {string}
 */
export function toArabicNumerals(num) {
  return String(num).replace(/[0-9]/g, (d) => ARABIC_DIGITS[parseInt(d, 10)]);
}

/**
 * Ensure a value is a Date object.
 * @param {Date|string|number} value
 * @returns {Date}
 */
function ensureDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error('تاريخ غير صالح');
  }
  return d;
}

/**
 * Get the Arabic name of a day.
 * @param {Date|string|number} date
 * @returns {string} e.g., "الأربعاء"
 */
export function getDayName(date) {
  const d = ensureDate(date);
  return DAY_NAMES[d.getDay()];
}

/**
 * Get the Arabic name of a month.
 * @param {Date|string|number} date
 * @returns {string} e.g., "تشرين الأول"
 */
export function getMonthName(date) {
  const d = ensureDate(date);
  return MONTH_NAMES[d.getMonth()];
}

/**
 * Format a full date in Arabic.
 * @param {Date|string|number} date
 * @returns {string} e.g., "الأربعاء، ٢١ تشرين الأول ٢٠٢٦"
 */
export function formatDate(date) {
  const d = ensureDate(date);
  const dayName = getDayName(d);
  const day = toArabicNumerals(d.getDate());
  const month = getMonthName(d);
  const year = toArabicNumerals(d.getFullYear());
  return `${dayName}، ${day} ${month} ${year}`;
}

/**
 * Format a short date (without day name).
 * @param {Date|string|number} date
 * @returns {string} e.g., "٢١ تشرين الأول ٢٠٢٦"
 */
export function formatShortDate(date) {
  const d = ensureDate(date);
  const day = toArabicNumerals(d.getDate());
  const month = getMonthName(d);
  const year = toArabicNumerals(d.getFullYear());
  return `${day} ${month} ${year}`;
}

/**
 * Format time in HH:MM format with Arabic numerals.
 * @param {Date|string|number} date
 * @returns {string} e.g., "١٤:٣٠"
 */
export function formatTime(date) {
  const d = ensureDate(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return toArabicNumerals(`${hours}:${minutes}`);
}

/**
 * Format time in 12-hour format with Arabic AM/PM.
 * @param {Date|string|number} date
 * @returns {string} e.g., "٠٢:٣٠ م"
 */
export function formatTime12(date) {
  const d = ensureDate(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12 || 12;
  return `${toArabicNumerals(String(hours).padStart(2, '0'))}:${toArabicNumerals(minutes)} ${period}`;
}

/**
 * Check if a date is today (local timezone).
 * @param {Date|string|number} date
 * @returns {boolean}
 */
export function isToday(date) {
  const d = ensureDate(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Check if a date is tomorrow.
 * @param {Date|string|number} date
 * @returns {boolean}
 */
export function isTomorrow(date) {
  const d = ensureDate(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

/**
 * Check if a date is yesterday.
 * @param {Date|string|number} date
 * @returns {boolean}
 */
export function isYesterday(date) {
  const d = ensureDate(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

/**
 * Calculate the number of calendar days remaining until a target date.
 * Negative values mean the date has passed.
 * @param {Date|string|number} targetDate
 * @returns {number}
 */
export function daysRemaining(targetDate) {
  const target = ensureDate(targetDate);
  const now = new Date();
  // Reset time portions to compare dates only
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = targetDay.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format relative time from now in Arabic.
 * @param {Date|string|number} date
 * @returns {string} e.g., "اليوم", "أمس", "غداً", "بعد ٣ أيام", "منذ ٥ أيام"
 */
export function formatRelativeTime(date) {
  const days = daysRemaining(date);

  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === -1) return 'أمس';

  if (days > 1 && days <= 2) return `بعد يومين`;
  if (days > 2 && days <= 10) return `بعد ${toArabicNumerals(days)} أيام`;
  if (days > 10 && days <= 30) return `بعد ${toArabicNumerals(days)} يوماً`;
  if (days > 30) {
    const months = Math.floor(days / 30);
    if (months === 1) return 'بعد شهر';
    if (months === 2) return 'بعد شهرين';
    if (months <= 10) return `بعد ${toArabicNumerals(months)} أشهر`;
    return `بعد ${toArabicNumerals(months)} شهراً`;
  }

  // Past dates
  const absDays = Math.abs(days);
  if (absDays <= 2) return `منذ يومين`;
  if (absDays <= 10) return `منذ ${toArabicNumerals(absDays)} أيام`;
  if (absDays <= 30) return `منذ ${toArabicNumerals(absDays)} يوماً`;
  const months = Math.floor(absDays / 30);
  if (months === 1) return 'منذ شهر';
  if (months === 2) return 'منذ شهرين';
  if (months <= 10) return `منذ ${toArabicNumerals(months)} أشهر`;
  return `منذ ${toArabicNumerals(months)} شهراً`;
}

/**
 * Format a countdown string: "X يوم و Y ساعة".
 * @param {Date|string|number} targetDate
 * @returns {string} e.g., "٣ أيام و ٥ ساعات"
 */
export function formatCountdown(targetDate) {
  const target = ensureDate(targetDate);
  const now = new Date();
  let diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return 'انتهى الوقت';

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  const parts = [];

  if (days > 0) {
    if (days === 1) parts.push('يوم');
    else if (days === 2) parts.push('يومين');
    else if (days <= 10) parts.push(`${toArabicNumerals(days)} أيام`);
    else parts.push(`${toArabicNumerals(days)} يوماً`);
  }

  if (hours > 0) {
    if (hours === 1) parts.push('ساعة');
    else if (hours === 2) parts.push('ساعتين');
    else if (hours <= 10) parts.push(`${toArabicNumerals(hours)} ساعات`);
    else parts.push(`${toArabicNumerals(hours)} ساعة`);
  }

  if (parts.length === 0) {
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes <= 1) return 'أقل من دقيقة';
    if (minutes === 2) return 'دقيقتين';
    if (minutes <= 10) return `${toArabicNumerals(minutes)} دقائق`;
    return `${toArabicNumerals(minutes)} دقيقة`;
  }

  return parts.join(' و ');
}

/**
 * Get the start date (Saturday) of the week containing the given date.
 * Week starts on Saturday for Arabic locale.
 * @param {Date|string|number} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  const d = ensureDate(date);
  const result = new Date(d);
  // Saturday = 6. Adjust so Saturday is day 0.
  const day = d.getDay();
  const diff = day === 6 ? 0 : day + 1;
  result.setDate(d.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end date (Friday) of the week containing the given date.
 * @param {Date|string|number} date
 * @returns {Date}
 */
export function getWeekEnd(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Generate a 6-week × 7-day calendar grid for a given month.
 * Each cell is a Date object. Weeks start on Saturday.
 * @param {number} year
 * @param {number} month - 0-indexed (0=January)
 * @returns {Date[][]} 6 arrays of 7 Date objects each
 */
export function getMonthCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startDate = getWeekStart(firstDay);

  const grid = [];
  const current = new Date(startDate);

  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let day = 0; day < 7; day++) {
      row.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Check if two dates are the same calendar day.
 * @param {Date|string|number} date1
 * @param {Date|string|number} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  const a = ensureDate(date1);
  const b = ensureDate(date2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Get an ISO date string (YYYY-MM-DD) in local timezone.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function toLocalISODate(date) {
  const d = ensureDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
