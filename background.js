// background.js (v15.3 - Use Configurable Idle Threshold)

console.log('[System] Background script STARTING (v15.3 - Config Idle).');

// --- Storage Keys ---
const STORAGE_KEY_TRACKING_STATE = 'currentTrackingState'; // Stores { timestamp: number, domain: string } | null
const STORAGE_KEY_IDLE_THRESHOLD = 'idleThresholdSeconds'; // NEW Key
const DEFAULT_IDLE_SECONDS = 1800; // Default 30 minutes (used if setting not found)

// --- Core Data Variables (Loaded from storage) ---
let trackedData = {};
let categoryTimeData = {};
let dailyDomainData = {};
let dailyCategoryData = {};
let hourlyData = {};

// --- Configuration (Loaded from storage or JSON defaults) ---
let categories = ['Other'];
let categoryAssignments = {};
let rules = [];
const defaultCategory = 'Other';

// --- Helper: Get current date string ---
function getCurrentDateString() {
  /* ... same ... */ const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Load stored data or fetch defaults ---
async function loadData() {
  /* ... Same logic as v15.2, ensure it doesn't load the idle threshold key here unless needed for other init ... */
  console.log('[System] loadData started.');
  try {
    const result = await browser.storage.local.get([
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
    ]);
    console.log('[System] Data loaded from storage:', result ? 'OK' : 'Empty/Error');
    let needsSave = false;
    let defaults = null;
    const needDefaultCategories = !result.categories || result.categories.length === 0;
    const needDefaultAssignments = !result.categoryAssignments || Object.keys(result.categoryAssignments).length === 0;
    const needDefaultRules = !result.rules;
    if (needDefaultCategories || needDefaultAssignments) {
      try {
        console.log('[System] Fetching defaults...');
        const response = await fetch(browser.runtime.getURL('data/default_config.json'));
        if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
        defaults = await response.json();
        if (!defaults || !Array.isArray(defaults.categories) || typeof defaults.assignments !== 'object') {
          throw new Error('Invalid default config structure.');
        }
        console.log('[System] Successfully fetched defaults.');
      } catch (fetchError) {
        console.error('CRITICAL: Failed to fetch defaults.', fetchError);
        defaults = { categories: ['Other'], assignments: {} };
      }
    }
    categories = !needDefaultCategories ? result.categories : defaults ? [...defaults.categories] : ['Other'];
    if (!categories.includes(defaultCategory)) {
      categories.push(defaultCategory);
      needsSave = true;
    }
    categoryAssignments = !needDefaultAssignments
      ? result.categoryAssignments
      : defaults
      ? { ...defaults.assignments }
      : {};
    let categoriesChanged = false;
    Object.values(categoryAssignments).forEach((catName) => {
      if (!categories.includes(catName)) {
        console.warn(`Assign uses unknown category "${catName}". Adding.`);
        categories.push(catName);
        categoriesChanged = true;
      }
    });
    if (categoriesChanged) needsSave = true;
    if (result.rules && Array.isArray(result.rules)) {
      rules = result.rules;
    } else {
      rules = [];
      if (result.rules) console.warn('[System] Loaded rules invalid, resetting.');
      needsSave = true;
    }
    trackedData = result.trackedData || {};
    categoryTimeData = result.categoryTimeData || {};
    dailyDomainData = result.dailyDomainData || {};
    dailyCategoryData = result.dailyCategoryData || {};
    hourlyData = result.hourlyData || {};
    if (!result.hourlyData) needsSave = true;
    console.log(
      `[System] State loaded: ${categories.length} cats, ${Object.keys(categoryAssignments).length} assigns, ${
        rules.length
      } rules.`
    );
    if (
      needsSave ||
      needDefaultCategories ||
      needDefaultAssignments ||
      needDefaultRules ||
      categoriesChanged ||
      !result.hourlyData
    ) {
      console.log('[System] Saving initial/updated non-tracking state.');
      await saveData();
    }
    await updateTrackingState('loadDataInit');
    console.log('[System] loadData finished.');
  } catch (error) {
    console.error('CRITICAL Error during loadData:', error);
    trackedData = {};
    categoryTimeData = {};
    categories = ['Other'];
    categoryAssignments = {};
    rules = [];
    dailyDomainData = {};
    dailyCategoryData = {};
    hourlyData = {};
    try {
      await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
    } catch (clearError) {
      console.error('Failed to clear tracking state during error handling:', clearError);
    }
  }
}
loadData(); // Initialize on startup

// --- Save Main Data State ---
let isSaving = false;
async function saveData() {
  /* ... same ... */ if (isSaving) return;
  isSaving = true;
  try {
    await browser.storage.local.set({
      trackedData,
      categoryTimeData,
      dailyDomainData,
      dailyCategoryData,
      hourlyData,
      categories,
      categoryAssignments,
      rules,
    });
  } catch (error) {
    console.error('CRITICAL Error during saveData:', error);
  } finally {
    isSaving = false;
  }
}

// --- Get Domain & Category ---
function getDomain(url) {
  /* ... same ... */ if (!url || !(url.startsWith('http:') || url.startsWith('https:'))) {
    return null;
  }
  try {
    const hostname = new URL(url).hostname;
    return hostname;
  } catch (e) {
    console.error(`[Util] Error parsing URL ${url}:`, e);
    return null;
  }
}
function getCategoryForDomain(domain) {
  /* ... same ... */ if (!domain) return null;
  if (categoryAssignments.hasOwnProperty(domain)) {
    return categoryAssignments[domain];
  }
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    const wildcardPattern = '*.' + parentDomain;
    if (categoryAssignments.hasOwnProperty(wildcardPattern)) {
      return categoryAssignments[wildcardPattern];
    }
    if (i > 0 && categoryAssignments.hasOwnProperty(parentDomain)) {
      return categoryAssignments[parentDomain];
    }
  }
  return defaultCategory;
}

// --- Core Time Tracking Logic (MODIFIED updateTrackingState) ---
async function updateTrackingState(context = 'Unknown') {
  // console.log(`[Debug updateTrackingState] Called from context: ${context}`); // Keep logging minimal now
  const now = Date.now();
  let currentDomain = null;
  let isActive = false;
  let finalDomainToRecord = null;

  try {
    // *** 1. Get Idle Threshold Setting ***
    let idleState = 'active'; // Assume active if check is skipped
    let thresholdSeconds = DEFAULT_IDLE_SECONDS; // Default value
    try {
      const settings = await browser.storage.local.get(STORAGE_KEY_IDLE_THRESHOLD);
      const savedValue = settings[STORAGE_KEY_IDLE_THRESHOLD];
      if (savedValue !== undefined && savedValue !== null) {
        thresholdSeconds = parseInt(savedValue, 10); // Ensure it's a number
        if (isNaN(thresholdSeconds)) {
          // Fallback if stored value is invalid
          console.warn(`Invalid idle threshold found in storage (${savedValue}). Using default.`);
          thresholdSeconds = DEFAULT_IDLE_SECONDS;
        }
      }
      // console.log(`[Idle Check] Using threshold: ${thresholdSeconds}s`); // Verbose log
    } catch (err) {
      console.error('Error fetching idle threshold setting:', err);
      // Use default if fetching fails
      thresholdSeconds = DEFAULT_IDLE_SECONDS;
    }

    // *** 2. Check Idle State (Conditional) ***
    if (thresholdSeconds === -1) {
      // -1 means idle checking is disabled
      idleState = 'active'; // Force active state
      // console.log("[Idle Check] Skipped (disabled by setting).");
    } else if (thresholdSeconds >= 1) {
      // Only query if threshold is valid (>= 1 second)
      try {
        idleState = await browser.idle.queryState(thresholdSeconds);
      } catch (idleError) {
        console.error('Error querying idle state:', idleError);
        idleState = 'active'; // Assume active on error? Or inactive? Let's assume active.
      }
    } else {
      console.warn(`Invalid idle threshold (${thresholdSeconds}s), assuming active.`);
      idleState = 'active'; // Treat 0 or negative (other than -1) as active/disabled check
    }
    // console.log(`[Idle Check] Result: ${idleState}`);

    // *** 3. Check Window Focus & Active Tab ***
    let activeTab = null;
    let focusedWindow = null;
    try {
      const windows = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
      focusedWindow = windows.find((w) => w.focused);
      if (focusedWindow) {
        activeTab = focusedWindow.tabs.find((t) => t.active);
      }
    } catch (browserApiError) {
      console.error('Error accessing browser windows/tabs:', browserApiError);
      // Keep isActive = false (default)
    }

    // *** 4. Determine Activity Status ***
    if (idleState === 'active' && focusedWindow && activeTab) {
      const domain = getDomain(activeTab.url);
      if (domain) {
        isActive = true;
        currentDomain = domain;
      } else {
        isActive = false; // Not a trackable URL
      }
    } else {
      isActive = false; // Idle, locked, no focus, or no active tab
    }
    // console.log(`[State Check] isActive=${isActive}, currentDomain=${currentDomain}`);

    // *** 5. Get Previous Tracking State ***
    const storageResult = await browser.storage.local.get(STORAGE_KEY_TRACKING_STATE);
    const previousState = storageResult[STORAGE_KEY_TRACKING_STATE] || null;

    // *** 6. Process State Change / Update Time ***
    let elapsedSeconds = 0;
    if (previousState) {
      elapsedSeconds = Math.round((now - previousState.timestamp) / 1000);
      finalDomainToRecord = previousState.domain;
    }

    if (isActive) {
      // --- Currently Active ---
      if (previousState) {
        // Was Active Before
        if (elapsedSeconds > 0) {
          recordTime(finalDomainToRecord, elapsedSeconds); // Record for previous domain
          await saveData();
        }
        // Update storage with current time and potentially new domain
        const newState = { timestamp: now, domain: currentDomain };
        await browser.storage.local.set({ [STORAGE_KEY_TRACKING_STATE]: newState });
      } else {
        // Was Inactive Before -> Start tracking
        const newState = { timestamp: now, domain: currentDomain };
        await browser.storage.local.set({ [STORAGE_KEY_TRACKING_STATE]: newState });
        console.log(`[Tracking] State started. Now tracking: ${currentDomain}`);
      }
    } else {
      // --- Currently Inactive ---
      if (previousState) {
        // Was Active Before -> Stop tracking
        if (elapsedSeconds > 0) {
          recordTime(finalDomainToRecord, elapsedSeconds); // Record final chunk
          await saveData();
          console.log(`[Tracking] Recorded final ${elapsedSeconds}s for ${finalDomainToRecord}`);
        }
        await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
        console.log(`[Tracking] State stopped (became inactive).`);
      } else {
        // Was Inactive Before -> Still inactive (do nothing unless cleanup needed)
        const check = await browser.storage.local.get(STORAGE_KEY_TRACKING_STATE);
        if (check[STORAGE_KEY_TRACKING_STATE]) {
          console.warn('[State Check] Found lingering tracking state while inactive. Clearing.');
          await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
        }
      }
    }
  } catch (error) {
    console.error('Error in updateTrackingState:', error);
    try {
      await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
      console.error('[Tracking] Cleared tracking state due to error.');
    } catch (clearError) {
      console.error('Failed to clear tracking state during error handling:', clearError);
    }
  }
}

// --- recordTime Helper ---
function recordTime(domain, seconds) {
  /* ... same ... */ if (!domain || seconds <= 0) {
    return;
  }
  const todayStr = getCurrentDateString();
  const currentHourStr = new Date().getHours().toString().padStart(2, '0');
  if (!dailyDomainData[todayStr]) dailyDomainData[todayStr] = {};
  if (!dailyCategoryData[todayStr]) dailyCategoryData[todayStr] = {};
  if (!hourlyData[todayStr]) hourlyData[todayStr] = {};
  if (!hourlyData[todayStr][currentHourStr]) hourlyData[todayStr][currentHourStr] = 0;
  trackedData[domain] = (trackedData[domain] || 0) + seconds;
  dailyDomainData[todayStr][domain] = (dailyDomainData[todayStr][domain] || 0) + seconds;
  hourlyData[todayStr][currentHourStr] = (hourlyData[todayStr][currentHourStr] || 0) + seconds;
  const category = getCategoryForDomain(domain);
  if (category) {
    categoryTimeData[category] = (categoryTimeData[category] || 0) + seconds;
    dailyCategoryData[todayStr][category] = (dailyCategoryData[todayStr][category] || 0) + seconds;
  }
}

// --- Event Handlers ---
browser.tabs.onActivated.addListener(async (activeInfo) => {
  await updateTrackingState('tabs.onActivated');
});
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status) {
    try {
      const windows = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
      const focusedWindow = windows.find((w) => w.focused);
      if (focusedWindow) {
        const activeTab = focusedWindow.tabs.find((t) => t.active);
        if (activeTab && activeTab.id === tabId) {
          await updateTrackingState('tabs.onUpdated (active tab)');
        }
      }
    } catch (e) {
      console.error('[Event] tabs.onUpdated - Error checking active tab:', e);
    }
  }
});
browser.windows.onFocusChanged.addListener(async (windowId) => {
  await updateTrackingState('windows.onFocusChanged');
});
browser.idle.onStateChanged.addListener(async (newState) => {
  await updateTrackingState('idle.onStateChanged');
});

// --- Periodic Save/Check Alarm ---
const ALARM_NAME = 'periodicStateCheck';
const ALARM_PERIOD_MINUTES = 0.25; // 15 seconds
async function setupAlarm() {
  /* ... same ... */ try {
    const alarm = await browser.alarms.get(ALARM_NAME);
    if (!alarm) {
      browser.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      console.log(`[Alarm] Created: ${ALARM_NAME}`);
    } else {
      if (alarm.periodInMinutes !== ALARM_PERIOD_MINUTES) {
        console.warn(`[Alarm] Period mismatch. Recreating.`);
        await browser.alarms.clear(ALARM_NAME);
        browser.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      }
    }
  } catch (error) {
    console.error('[Alarm] Error setting up alarm:', error);
  }
}
setupAlarm();
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await updateTrackingState('Alarm');
  }
});

// --- Message Listener (NO CHANGE NEEDED HERE for idle setting) ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
    console.log(`[System] Reloading config data due to ${request.action} message.`);
    loadData()
      .then(() => {
        sendResponse({ success: true, message: 'Config data reloaded.' });
      })
      .catch((err) => {
        sendResponse({ success: false, message: 'Error reloading.' });
      });
    return true;
  }
  return false;
});

// --- Blocking & Limiting Logic (Unchanged) ---
function urlMatchesPattern(url, pattern) {
  /* ... same ... */ if (!url || !pattern) return false;
  const normalize = (u) => {
    try {
      let hostname = new URL(u).hostname;
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch {
      return pattern
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
    }
  };
  const normalizedUrlHost = normalize(url);
  const normalizedPattern = pattern
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
  if (normalizedPattern.startsWith('*.')) {
    const basePattern = normalizedPattern.substring(2);
    return normalizedUrlHost === basePattern || normalizedUrlHost.endsWith('.' + basePattern);
  } else {
    return normalizedUrlHost === normalizedPattern;
  }
}
function formatTimeBlocking(seconds) {
  /* ... same ... */ if (seconds < 0) seconds = 0;
  if (seconds < 60) return `<1m`;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  if (parts.length === 0 && totalMinutes > 0) return `${totalMinutes}m`;
  if (parts.length === 0) return '<1m';
  return parts.join(' ');
}
function handleBlockingRequest(requestDetails) {
  /* ... same ... */ if (
    requestDetails.type !== 'main_frame' ||
    !requestDetails.url ||
    requestDetails.url.startsWith('moz-extension://') ||
    requestDetails.url.startsWith('about:')
  )
    return {};
  const requestedUrl = requestDetails.url;
  const requestedDomain = getDomain(requestedUrl);
  if (!requestedDomain) return {};
  const todayStr = getCurrentDateString();
  const todaysDomainData = dailyDomainData[todayStr] || {};
  const todaysCategoryData = dailyCategoryData[todayStr] || {};
  const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');
  let determinedCategory = null;
  for (const rule of rules) {
    if (!rule.type || !rule.type.startsWith('limit-') || !rule.value) continue;
    let ruleMatches = false;
    let timeSpentToday = 0;
    let limitSeconds = parseInt(rule.limitSeconds, 10) || 0;
    let targetValue = rule.value;
    if (limitSeconds <= 0) continue;
    try {
      if (rule.type === 'limit-url') {
        if (urlMatchesPattern(requestedUrl, targetValue)) {
          ruleMatches = true;
          timeSpentToday = todaysDomainData[requestedDomain] || 0;
        }
      } else if (rule.type === 'limit-category') {
        if (!determinedCategory) determinedCategory = getCategoryForDomain(requestedDomain);
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
          timeSpentToday = todaysCategoryData[determinedCategory] || 0;
        }
      }
      if (ruleMatches) {
        const limitReached = timeSpentToday >= limitSeconds;
        if (limitReached) {
          console.log(`[Blocking] LIMIT enforced for ${rule.type}='${targetValue}'.`);
          const params = new URLSearchParams();
          params.append('url', requestedUrl);
          params.append('reason', 'limit');
          params.append('type', rule.type);
          params.append('value', targetValue);
          params.append('limit', limitSeconds.toString());
          params.append('spent', timeSpentToday.toString());
          return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
        }
      }
    } catch (e) {
      console.error(`[Blocking] Limit Check Error: ${e}`);
    }
  }
  for (const rule of rules) {
    if (!rule.type || !rule.type.startsWith('block-') || !rule.value) continue;
    let ruleMatches = false;
    let targetValue = rule.value;
    try {
      if (rule.type === 'block-url') {
        if (urlMatchesPattern(requestedUrl, targetValue)) ruleMatches = true;
      } else if (rule.type === 'block-category') {
        if (!determinedCategory) determinedCategory = getCategoryForDomain(requestedDomain);
        if (determinedCategory && determinedCategory === targetValue) ruleMatches = true;
      }
      if (ruleMatches) {
        console.log(`[Blocking] BLOCK enforced for ${rule.type}='${targetValue}'.`);
        const params = new URLSearchParams();
        params.append('url', requestedUrl);
        params.append('reason', 'block');
        params.append('type', rule.type);
        params.append('value', targetValue);
        return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
      }
    } catch (e) {
      console.error(`[Blocking] Block Check Error: ${e}`);
    }
  }
  return {};
}
try {
  if (browser.webRequest && browser.webRequest.onBeforeRequest) {
    browser.webRequest.onBeforeRequest.addListener(
      handleBlockingRequest,
      { urls: ['<all_urls>'], types: ['main_frame'] },
      ['blocking']
    );
    console.log('[System] Request listener registered.');
  } else {
    console.error('[System] browser.webRequest API not available.');
  }
} catch (error) {
  console.error('CRITICAL: Failed to register request listener.', error);
}

console.log('[System] Background script finished loading (v15.3 - Config Idle).');
// --- End of background.js ---
