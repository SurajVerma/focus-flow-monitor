// blocked/blocked.js (v0.7.1 - Consolidated Utils)

// --- Consolidated Helper Functions ---

/**
 * Formats seconds into a human-readable string (h, m, s).
 * Consistent across popup, options, and blocked pages.
 *
 * @param {number} seconds - The total seconds to format.
 * @param {boolean} [includeSeconds=true] - Whether to include seconds for times < 1 hour.
 * @param {boolean} [forceHMS=false] - Whether to force HH:MM:SS format.
 * @returns {string} Formatted time string. Returns '<1m' if seconds < 60 and includeSeconds is false. Returns '0s' for 0 seconds. Returns '--h --m' for negative input.
 */
function formatTime(seconds, includeSeconds = true, forceHMS = false) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) seconds = 0;

  // Note: blocked page doesn't need the '--h --m' error case, default to 0s
  if (seconds < 0) seconds = 0;

  if (forceHMS) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  if (seconds === 0) return '0s'; // Explicit 0s

  // Handle '<1m' case specifically for blocked page display where seconds might be omitted
  if (seconds < 60 && !includeSeconds) return '<1m';

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const remainingSeconds = Math.floor(seconds % 60);
  let parts = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);

  // Include seconds only if:
  // 1) includeSeconds is true AND duration is less than 1 hour
  // OR
  // 2) It's the only unit left (i.e., duration is < 1 minute)
  if ((includeSeconds && hours === 0) || (hours === 0 && remainingMinutes === 0)) {
    if (remainingSeconds > 0) {
      parts.push(`${remainingSeconds}s`);
    }
  }
  // Handle cases like 60s showing as '1m' if includeSeconds is false.
  if (parts.length === 0) {
    if (totalMinutes > 0) {
      parts.push(`${totalMinutes}m`);
    } else if (remainingSeconds > 0) {
      parts.push(`${remainingSeconds}s`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : '0s'; // Default to '0s'
}
// --- END Consolidated ---

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  const reason = params.get('reason') || 'unknown';
  const type = params.get('type') || 'unknown';
  const value = params.get('value') || 'N/A';
  const url = params.get('url') || 'N/A';
  const limit = params.get('limit');
  const spent = params.get('spent');

  const urlEl = document.getElementById('display-url');
  const reasonEl = document.getElementById('display-reason');
  const ruleEl = document.getElementById('display-rule');
  const limitInfoEl = document.getElementById('limit-info');
  const spentEl = document.getElementById('display-spent');
  const limitEl = document.getElementById('display-limit');
  const goBackButton = document.getElementById('goBackButton');

  if (urlEl) urlEl.textContent = url;

  let reasonText = 'Access Blocked';
  let ruleText = 'Unknown Rule';

  if (reason === 'limit') {
    reasonText = 'Daily Time Limit Reached';
    if (limitInfoEl && spentEl && limitEl && limit !== null && spent !== null) {
      const limitSec = parseInt(limit, 10);
      const spentSec = parseInt(spent, 10);
      if (!isNaN(limitSec) && !isNaN(spentSec)) {
        // *** Use consolidated formatTime ***
        spentEl.textContent = formatTime(spentSec, false); // Don't show seconds
        limitEl.textContent = formatTime(limitSec, false); // Don't show seconds
        limitInfoEl.style.display = 'block';
      } else {
        limitInfoEl.style.display = 'none';
      }
    } else if (limitInfoEl) {
      limitInfoEl.style.display = 'none';
    }
  }

  if (type !== 'unknown' && value !== 'N/A') {
    if (type.includes('-url')) {
      ruleText = `URL Pattern: "${value}"`;
    } else if (type.includes('-category')) {
      ruleText = `Category: "${value}"`;
    } else {
      ruleText = `Rule Type: "${type}"`;
    }
  }

  if (reasonEl) reasonEl.textContent = reasonText;
  if (ruleEl) ruleEl.textContent = ruleText;

  if (goBackButton) {
    goBackButton.addEventListener('click', () => {
      if (history.length > 1) {
        history.back();
      } else {
        goBackButton.textContent = 'Cannot Go Back';
        goBackButton.disabled = true;
      }
    });
  } else {
    console.error('[Blocked Page] Go back button not found');
  }
});
