// blocked/blocked.js

// Helper function to format time (similar to options.js)
function formatTimeBlocked(seconds) {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  if (hours === 0 && remainingSeconds > 0) parts.push(`${remainingSeconds}s`); // Show seconds if under 1h
  if (parts.length === 0) return '0s'; // Handle 0 case
  return parts.join(' ');
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Block page loaded');
  const params = new URLSearchParams(window.location.search);

  const reason = params.get('reason'); // "limit" or "block"
  const type = params.get('type'); // e.g., "limit-url", "block-category"
  const value = params.get('value'); // e.g., "reddit.com", "Social Media"
  const url = params.get('url'); // The specific URL that was blocked
  const limit = params.get('limit'); // Limit in seconds (if reason=limit)
  const spent = params.get('spent'); // Spent time in seconds (if reason=limit)

  // Get elements to display info
  const urlEl = document.getElementById('display-url');
  const reasonEl = document.getElementById('display-reason');
  const ruleEl = document.getElementById('display-rule');
  const limitInfoEl = document.getElementById('limit-info');
  const spentEl = document.getElementById('display-spent');
  const limitEl = document.getElementById('display-limit');

  if (urlEl) {
    urlEl.textContent = url || 'N/A';
  }

  let reasonText = 'Permanent Block';
  let ruleText = '';

  if (reason === 'limit') {
    reasonText = 'Daily Time Limit Reached';
    if (limitInfoEl && spentEl && limitEl && limit && spent) {
      spentEl.textContent = formatTimeBlocked(parseInt(spent, 10));
      limitEl.textContent = formatTimeBlocked(parseInt(limit, 10));
      limitInfoEl.style.display = 'block'; // Show the time info
    }
  }

  if (type && value) {
    if (type.includes('-url')) {
      ruleText = `URL pattern "${value}"`;
    } else if (type.includes('-category')) {
      ruleText = `Category "${value}"`;
    } else {
      ruleText = `Unknown rule type "${type}"`;
    }
  } else {
    ruleText = 'Unknown rule';
  }

  if (reasonEl) {
    reasonEl.textContent = reasonText;
  }
  if (ruleEl) {
    ruleEl.textContent = ruleText;
  }

  // Button functionality
  const goBackButton = document.getElementById('goBackButton');
  if (goBackButton) {
    goBackButton.addEventListener('click', () => {
      history.back();
    });
  } else {
    console.error('Go back button not found');
  }
});
