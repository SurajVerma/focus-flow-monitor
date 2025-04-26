// options/options-utils.js

// --- Time Formatting ---
/**
 * Formats seconds into a human-readable string (h, m, s).
 * Consistent across popup, options, and blocked pages.
 * @param {number} seconds - The total seconds to format.
 * @param {boolean} [includeSeconds=true] - Whether to include seconds for times < 1 hour.
 * @param {boolean} [forceHMS=false] - Whether to force HH:MM:SS format.
 * @returns {string} Formatted time string. Returns '<1m' if seconds < 60 and includeSeconds is false. Returns '0s' for 0 seconds.
 */
function formatTime(seconds, includeSeconds = true, forceHMS = false) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) seconds = 0;
  if (seconds < 0) seconds = 0; // Treat negative as 0 for options/popup/blocked display

  if (forceHMS) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  if (seconds === 0) return '0s';
  if (seconds < 60 && !includeSeconds) return '<1m';

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const remainingSeconds = Math.floor(seconds % 60);
  let parts = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);

  if ((includeSeconds && hours === 0) || (hours === 0 && remainingMinutes === 0)) {
    if (remainingSeconds > 0) {
      parts.push(`${remainingSeconds}s`);
    }
  }
  if (parts.length === 0) {
    if (totalMinutes > 0) parts.push(`${totalMinutes}m`);
    else if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);
  }
  return parts.length > 0 ? parts.join(' ') : '0s';
}

// --- Category Colors ---
const categoryColors = {
  'Work/Productivity': 'rgba(54, 162, 235, 0.8)',
  'Social Media': 'rgba(255, 99, 132, 0.8)',
  'News & Info': 'rgba(255, 159, 64, 0.8)',
  Entertainment: 'rgba(153, 102, 255, 0.8)',
  Shopping: 'rgba(255, 205, 86, 0.8)',
  'Reference & Learning': 'rgba(75, 192, 192, 0.8)',
  Technology: 'rgba(100, 255, 64, 0.8)',
  Finance: 'rgba(40, 100, 120, 0.8)',
  Other: 'rgba(201, 203, 207, 0.8)',
};
const defaultCategoryColor = categoryColors['Other'];

function getCategoryColor(category) {
  return categoryColors[category] || defaultCategoryColor;
}

// --- Date Formatting (for UI display) ---
function formatDate(date) {
  if (!(date instanceof Date)) {
    try {
      date = new Date(date);
    } catch (e) {
      return null;
    }
  }
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentDateString() {
  // Needed for default selected date in options
  return formatDate(new Date());
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Date';
  try {
    // Use T00:00:00 to avoid timezone issues when creating the Date object
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr; // Return original string if invalid
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(navigator.language || 'en-US', options);
  } catch (e) {
    console.warn('Error formatting display date:', e);
    return dateStr; // Fallback to original string
  }
}

// --- CSV Helper ---
function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // Quote if value contains comma, double-quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape existing double-quotes by doubling them
    const escapedValue = stringValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }
  return stringValue;
}

console.log('[System] options-utils.js loaded');
