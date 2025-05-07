// blocked/blocked.js (v0.7.3 - Apply Customizations)

// Storage keys for block page customization (mirrored from options-state.js for clarity)
const STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING = 'blockPage_customHeading';
const STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE = 'blockPage_customMessage';
const STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT = 'blockPage_customButtonText';
const STORAGE_KEY_BLOCK_PAGE_SHOW_URL = 'blockPage_showUrl';
const STORAGE_KEY_BLOCK_PAGE_SHOW_REASON = 'blockPage_showReason';
const STORAGE_KEY_BLOCK_PAGE_SHOW_RULE = 'blockPage_showRule';
const STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO = 'blockPage_showLimitInfo';
const STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO = 'blockPage_showScheduleInfo';
const STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE = 'blockPage_showQuote';
const STORAGE_KEY_BLOCK_PAGE_USER_QUOTES = 'blockPage_userQuotes';

// Default motivational quotes
const DEFAULT_MOTIVATIONAL_QUOTES = [
  'The secret of getting ahead is getting started. – Mark Twain',
  "Don't watch the clock; do what it does. Keep going. – Sam Levenson",
  'The only way to do great work is to love what you do. – Steve Jobs',
  'It does not matter how slowly you go as long as you do not stop. – Confucius',
  "Your limitation—it's only your imagination.",
  'Push yourself, because no one else is going to do it for you.',
  'Great things never come from comfort zones.',
  'Dream it. Wish it. Do it.',
  'Success doesn’t just find you. You have to go out and get it.',
];

document.addEventListener('DOMContentLoaded', async () => {
  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const reasonParam = params.get('reason') || 'unknown';
  const typeParam = params.get('type') || 'unknown';
  const valueParam = params.get('value') || 'N/A';
  const urlParam = params.get('url') || 'N/A';
  const limitParam = params.get('limit');
  const spentParam = params.get('spent');
  const scheduleStartParam = params.get('schedule_start');
  const scheduleEndParam = params.get('schedule_end');
  const scheduleDaysParam = params.get('schedule_days');

  // Get references to HTML elements
  const mainHeadingEl = document.getElementById('main-heading');
  const subHeadingEl = document.getElementById('sub-heading');
  const customMessagePlaceholderEl = document.getElementById('custom-message-placeholder');

  const urlContainerEl = document.getElementById('blocked-url-container');
  const reasonContainerEl = document.getElementById('blocked-reason-container');
  const ruleContainerEl = document.getElementById('blocked-rule-container');

  const displayUrlEl = document.getElementById('display-url');
  const displayReasonEl = document.getElementById('display-reason');
  const displayRuleEl = document.getElementById('display-rule');

  const limitInfoEl = document.getElementById('limit-info');
  const spentEl = document.getElementById('display-spent');
  const limitEl = document.getElementById('display-limit');

  const scheduleInfoEl = document.getElementById('schedule-info');
  const scheduleTimeDetailsEl = document.getElementById('schedule-time-details');
  const scheduleStartEl = document.getElementById('display-schedule-start');
  const scheduleTimeSeparatorEl = document.getElementById('display-schedule-time-separator');
  const scheduleEndEl = document.getElementById('display-schedule-end');
  const scheduleDaysEl = document.getElementById('display-schedule-days');

  const motivationalQuoteContainerEl = document.getElementById('motivational-quote-container');
  const quoteTextEl = document.getElementById('quote-text');
  const goBackButton = document.getElementById('goBackButton');

  // --- Load Customization Settings ---
  let settings = {};
  try {
    settings = await browser.storage.local.get([
      STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
      STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
      STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
      STORAGE_KEY_BLOCK_PAGE_SHOW_URL,
      STORAGE_KEY_BLOCK_PAGE_SHOW_REASON,
      STORAGE_KEY_BLOCK_PAGE_SHOW_RULE,
      STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
      STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
      STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE,
      STORAGE_KEY_BLOCK_PAGE_USER_QUOTES,
    ]);
  } catch (err) {
    console.warn('Could not load block page customization settings:', err);
  }

  // --- Apply Customizations ---
  if (mainHeadingEl && settings[STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING]) {
    mainHeadingEl.textContent = settings[STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING];
  }
  // Sub-heading is not directly customizable by user in this iteration, but could be.
  // For now, it remains as is unless custom message replaces it.

  if (customMessagePlaceholderEl && settings[STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE]) {
    customMessagePlaceholderEl.textContent = settings[STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE];
    customMessagePlaceholderEl.style.display = 'block';
    if (subHeadingEl) subHeadingEl.style.display = 'none'; // Hide default sub-heading if custom message exists
  } else {
    if (subHeadingEl) subHeadingEl.style.display = 'block'; // Show default if no custom message
  }

  if (goBackButton && settings[STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT]) {
    goBackButton.textContent = settings[STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT];
  }

  // Show/hide detail elements based on settings
  if (urlContainerEl) {
    urlContainerEl.style.display = settings[STORAGE_KEY_BLOCK_PAGE_SHOW_URL] !== false ? 'block' : 'none';
  }
  if (reasonContainerEl) {
    reasonContainerEl.style.display = settings[STORAGE_KEY_BLOCK_PAGE_SHOW_REASON] !== false ? 'block' : 'none';
  }
  if (ruleContainerEl) {
    ruleContainerEl.style.display = settings[STORAGE_KEY_BLOCK_PAGE_SHOW_RULE] !== false ? 'block' : 'none';
  }
  // Note: limitInfoEl and scheduleInfoEl visibility is also controlled by whether their data exists.
  // The settings will provide an additional layer of control.

  // --- Populate Dynamic Content (URL, Reason, Rule, etc.) ---
  if (displayUrlEl) displayUrlEl.textContent = urlParam;

  let reasonText = 'Access Blocked by Rule'; // Default
  let ruleText = 'Unknown Rule';

  if (reasonParam === 'limit') {
    reasonText = 'Daily Time Limit Reached';
    if (limitInfoEl && spentEl && limitEl && limitParam !== null && spentParam !== null) {
      const limitSec = parseInt(limitParam, 10);
      const spentSec = parseInt(spentParam, 10);
      if (!isNaN(limitSec) && !isNaN(spentSec)) {
        spentEl.textContent = formatTime(spentSec, false);
        limitEl.textContent = formatTime(limitSec, false);
        // Visibility controlled by both data presence and setting
        limitInfoEl.style.display = settings[STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO] !== false ? 'block' : 'none';
      } else if (limitInfoEl) {
        limitInfoEl.style.display = 'none';
      }
    } else if (limitInfoEl) {
      limitInfoEl.style.display = 'none';
    }
  } else if (reasonParam === 'block' && scheduleStartParam && scheduleStartParam !== 'N/A') {
    reasonText = 'Access Restricted by Schedule';
    if (
      scheduleInfoEl &&
      scheduleTimeDetailsEl &&
      scheduleStartEl &&
      scheduleTimeSeparatorEl &&
      scheduleEndEl &&
      scheduleDaysEl
    ) {
      if (scheduleStartParam && scheduleStartParam !== 'N/A' && scheduleEndParam && scheduleEndParam !== 'N/A') {
        scheduleStartEl.textContent = formatTimeToAMPM(scheduleStartParam);
        scheduleTimeSeparatorEl.textContent = ' - ';
        scheduleEndEl.textContent = formatTimeToAMPM(scheduleEndParam);
        scheduleTimeDetailsEl.style.display = '';
      } else {
        scheduleStartEl.textContent = 'All day';
        scheduleTimeSeparatorEl.textContent = '';
        scheduleEndEl.textContent = '';
      }
      scheduleDaysEl.textContent =
        scheduleDaysParam && scheduleDaysParam !== 'All' ? scheduleDaysParam.split(',').join(', ') : 'All days';
      // Visibility controlled by both data presence and setting
      scheduleInfoEl.style.display = settings[STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO] !== false ? 'block' : 'none';
    }
  } else {
    // Default block or other reasons
    if (limitInfoEl) limitInfoEl.style.display = 'none';
    if (scheduleInfoEl) scheduleInfoEl.style.display = 'none';
  }

  if (typeParam !== 'unknown' && valueParam !== 'N/A') {
    if (typeParam.includes('-url')) {
      ruleText = `URL Pattern: "${valueParam}"`;
    } else if (typeParam.includes('-category')) {
      ruleText = `Category: "${valueParam}"`;
    }
  }

  if (displayReasonEl) displayReasonEl.textContent = reasonText;
  if (displayRuleEl) displayRuleEl.textContent = ruleText;

  // --- Motivational Quote ---
  if (settings[STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE] && motivationalQuoteContainerEl && quoteTextEl) {
    const userQuotes = settings[STORAGE_KEY_BLOCK_PAGE_USER_QUOTES] || [];
    const quotesToShow = userQuotes.length > 0 ? userQuotes : DEFAULT_MOTIVATIONAL_QUOTES;
    if (quotesToShow.length > 0) {
      const randomIndex = Math.floor(Math.random() * quotesToShow.length);
      quoteTextEl.textContent = quotesToShow[randomIndex];
      motivationalQuoteContainerEl.style.display = 'block';
    }
  }

  // --- Go Back Button Logic ---
  if (goBackButton) {
    goBackButton.addEventListener('click', () => {
      if (history.length > 1) {
        history.back();
      } else {
        // If no history, provide alternative (e.g., close tab, or disable button)
        // For now, disable and change text
        goBackButton.textContent = 'Cannot Go Back';
        goBackButton.disabled = true;
        // Consider: window.close(); // but this might be blocked by browser for non-script opened windows
      }
    });
  } else {
    console.error('[Blocked Page] Go back button not found');
  }
});
