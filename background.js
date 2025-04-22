// background.js (v15.2 - Added Detailed Logging in updateTrackingState)

console.log('[System] Background script STARTING (v15.2 - Detailed Logging).');

// --- Storage Keys ---
const STORAGE_KEY_TRACKING_STATE = 'currentTrackingState'; // Stores { timestamp: number, domain: string } | null

// --- Core Data Variables (Loaded from storage) ---
let trackedData = {}; // All-time domain totals {'domain.com': totalSeconds}
let categoryTimeData = {}; // All-time category totals {'Category': totalSeconds}
let dailyDomainData = {}; // Daily domain data {'YYYY-MM-DD': {'domain.com': secs, ...}}
let dailyCategoryData = {}; // Daily category data {'YYYY-MM-DD': {'Category': secs, ...}}
let hourlyData = {}; // Hourly totals {'YYYY-MM-DD': {'HH': totalSeconds, ...}}

// --- Configuration (Loaded from storage or JSON defaults) ---
let categories = ['Other'];
let categoryAssignments = {};
let rules = [];
const defaultCategory = 'Other';

// --- Helper: Get current date string ---
function getCurrentDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`; //<y_bin_46>-MM-DD format
}

// --- Load stored data or fetch defaults ---
async function loadData() {
  console.log('[System] loadData started.');
  try {
    // Load all persistent data EXCEPT the tracking state which is managed separately
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

    let needsSave = false; // Flag if defaults were loaded and need saving
    let defaults = null; // To store defaults loaded from JSON

    // Determine if defaults are needed
    const needDefaultCategories = !result.categories || result.categories.length === 0;
    const needDefaultAssignments = !result.categoryAssignments || Object.keys(result.categoryAssignments).length === 0;
    const needDefaultRules = !result.rules;

    // Fetch defaults ONLY if categories/assignments are missing
    if (needDefaultCategories || needDefaultAssignments) {
      try {
        console.log('[System] Fetching defaults from data/default_config.json...');
        const response = await fetch(browser.runtime.getURL('data/default_config.json'));
        if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
        defaults = await response.json();
        if (!defaults || !Array.isArray(defaults.categories) || typeof defaults.assignments !== 'object') {
          throw new Error('Invalid default config structure.');
        }
        console.log('[System] Successfully fetched defaults from JSON.');
      } catch (fetchError) {
        console.error('CRITICAL: Failed to fetch or parse defaults. Using minimal fallback.', fetchError);
        defaults = { categories: ['Other'], assignments: {} }; // Fallback
      }
    }

    // Assign categories & assignments
    categories = !needDefaultCategories ? result.categories : defaults ? [...defaults.categories] : ['Other'];
    if (!categories.includes(defaultCategory)) {
      categories.push(defaultCategory);
      needsSave = true; // Mark for saving if modified
    }

    categoryAssignments = !needDefaultAssignments
      ? result.categoryAssignments
      : defaults
      ? { ...defaults.assignments }
      : {};

    // Ensure all assigned categories exist
    let categoriesChanged = false;
    Object.values(categoryAssignments).forEach((catName) => {
      if (!categories.includes(catName)) {
        console.warn(`Assignment uses category "${catName}" which is not in list. Adding.`);
        categories.push(catName);
        categoriesChanged = true;
      }
    });
    if (categoriesChanged) needsSave = true;

    // Load Rules
    if (result.rules && Array.isArray(result.rules)) {
      rules = result.rules;
    } else {
      rules = [];
      if (result.rules) console.warn('[System] Loaded rules invalid, resetting.');
      needsSave = true;
    }

    // Load Tracking Data
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

    // Save if defaults were needed or structures were missing/invalid
    if (
      needsSave ||
      needDefaultCategories ||
      needDefaultAssignments ||
      needDefaultRules ||
      categoriesChanged ||
      !result.hourlyData
    ) {
      console.log('[System] Saving initial/updated non-tracking state to storage.');
      // Note: saveData now only saves the main data, not the tracking state
      await saveData();
    }

    // Initialize tracking state if necessary (e.g., after browser restart)
    // We check the actual browser state rather than assuming based on stored data
    await updateTrackingState('loadDataInit'); // Add context for logging

    console.log('[System] loadData finished.');
  } catch (error) {
    console.error('CRITICAL Error during loadData:', error);
    // Reset to prevent inconsistent state
    trackedData = {};
    categoryTimeData = {};
    categories = ['Other'];
    categoryAssignments = {};
    rules = [];
    dailyDomainData = {};
    dailyCategoryData = {};
    hourlyData = {};
    // Attempt to clear potentially corrupted tracking state
    try {
      await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
    } catch (clearError) {
      console.error('Failed to clear tracking state during error handling:', clearError);
    }
  }
}
// Initialize on startup
loadData();

// --- Save Main Data State (excluding tracking state) ---
let isSaving = false;
async function saveData() {
  if (isSaving) return;
  isSaving = true;
  // console.log('[Save Check] Saving main data...'); // Verbose
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
    // console.log("[System] saveData Succeeded."); // Verbose
  } catch (error) {
    console.error('CRITICAL Error during saveData:', error);
  } finally {
    isSaving = false;
    // console.log('[Save Check] Main data save finished.'); // Verbose
  }
}

// --- Get Domain & Category ---
function getDomain(url) {
  // Added logging within getDomain
  // console.log(`[Debug getDomain] Input URL: ${url}`);
  if (!url || !(url.startsWith('http:') || url.startsWith('https:'))) {
    // console.log(`[Debug getDomain] Invalid scheme or null URL.`);
    return null; // Only track http/https
  }
  try {
    const hostname = new URL(url).hostname;
    // console.log(`[Debug getDomain] Extracted hostname: ${hostname}`);
    return hostname;
  } catch (e) {
    console.error(`[Util] Error parsing URL ${url}:`, e);
    return null;
  }
}

function getCategoryForDomain(domain) {
  if (!domain) return null;
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

// --- Core Time Tracking Logic (State Machine driven by events/alarms) ---

/**
 * Determines the current intended tracking state based on browser status
 * and updates the stored state in browser.storage.local.
 * Calculates and saves time difference if the state changes from active to inactive
 * or if the active domain changes.
 * @param {string} [context="Unknown"] - Optional context for logging (e.g., "Alarm", "onActivated").
 */
async function updateTrackingState(context = 'Unknown') {
  console.log(`[Debug updateTrackingState] Called from context: ${context}`); // LOG: Entry point
  const now = Date.now();
  let currentDomain = null;
  let isActive = false; // Assume inactive initially
  let finalDomainToRecord = null; // Domain for which time might be recorded

  try {
    // 1. Check Idle State
    const idleState = await browser.idle.queryState(1800); // 30 minutes * 60 seconds/min
    console.log(`[Debug updateTrackingState] Idle state: ${idleState}`); // LOG: Idle state result

    // 2. Check Window Focus & Active Tab
    let activeTab = null;
    let focusedWindow = null;
    let windowInfo = null; // Use this for logging later
    try {
      const windows = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
      focusedWindow = windows.find((w) => w.focused); // Assign to the outer scope variable

      if (focusedWindow) {
        windowInfo = { id: focusedWindow.id, focused: focusedWindow.focused }; // Log basic info
        activeTab = focusedWindow.tabs.find((t) => t.active);
      }
      console.log(
        `[Debug updateTrackingState] Focused window: ${windowInfo ? windowInfo.id : 'None'}, Active tab: ${
          activeTab ? activeTab.id : 'None'
        }`
      ); // LOG: Window/Tab result
    } catch (browserApiError) {
      console.error('[Debug updateTrackingState] Error accessing browser windows/tabs:', browserApiError);
      // Keep isActive = false if we can't query state
    }

    // 3. Determine Activity Status based on checks
    if (idleState === 'active' && focusedWindow && activeTab) {
      // Requires 'active', not 'idle' or 'locked'
      const domain = getDomain(activeTab.url); // Call getDomain
      console.log(`[Debug updateTrackingState] Domain from active tab URL (${activeTab.url}): ${domain}`); // LOG: Domain result
      if (domain) {
        isActive = true;
        currentDomain = domain; // This is the domain if we are active NOW
      } else {
        // Active tab is not a trackable URL
        console.log(`[Debug updateTrackingState] Domain is null, setting isActive=false.`);
        isActive = false;
      }
    } else {
      // Not active for other reasons
      console.log(
        `[Debug updateTrackingState] Conditions not met for active state (idle=${idleState}, focused=${!!focusedWindow}, activeTab=${!!activeTab}). Setting isActive=false.`
      );
      isActive = false;
    }
    console.log(
      `[Debug updateTrackingState] Final isActive determination: ${isActive}, Current Domain (if active): ${currentDomain}`
    ); // LOG: Final isActive

    // 4. Get Previous Tracking State from Storage
    const storageResult = await browser.storage.local.get(STORAGE_KEY_TRACKING_STATE);
    const previousState = storageResult[STORAGE_KEY_TRACKING_STATE] || null; // { timestamp: number, domain: string } | null
    console.log(`[Debug updateTrackingState] Previous tracking state from storage:`, previousState); // LOG: Previous state

    // 5. Process State Change / Update Time
    let elapsedSeconds = 0;
    if (previousState) {
      elapsedSeconds = Math.round((now - previousState.timestamp) / 1000);
      finalDomainToRecord = previousState.domain; // The domain we *were* tracking
      console.log(
        `[Debug updateTrackingState] Calculated elapsed: ${elapsedSeconds}s for previous domain: ${finalDomainToRecord}`
      ); // LOG: Elapsed time calc
    }

    if (isActive) {
      console.log(`[Debug updateTrackingState] Branch: Currently Active (isActive=true)`); // LOG: Branch taken
      // --- Currently Active ---
      if (previousState) {
        // --- Was Active Before ---
        console.log(`[Debug updateTrackingState] Sub-Branch: Was Active Before (previousState exists)`);
        if (elapsedSeconds > 0) {
          // Record time for the domain we *were* on (previousState.domain)
          console.log(
            `[Debug updateTrackingState] Calling recordTime for ${finalDomainToRecord} with ${elapsedSeconds}s`
          );
          recordTime(finalDomainToRecord, elapsedSeconds);
          await saveData(); // Save cumulative totals
        } else {
          console.log(`[Debug updateTrackingState] Elapsed seconds <= 0, not recording time.`);
        }
        // Update storage with current time and potentially new domain
        const newState = { timestamp: now, domain: currentDomain };
        console.log(`[Debug updateTrackingState] Setting NEW tracking state in storage:`, newState);
        await browser.storage.local.set({ [STORAGE_KEY_TRACKING_STATE]: newState });
      } else {
        // --- Was Inactive Before ---
        console.log(`[Debug updateTrackingState] Sub-Branch: Was Inactive Before (previousState is null)`);
        // Start tracking the new domain
        const newState = { timestamp: now, domain: currentDomain };
        console.log(`[Debug updateTrackingState] Setting INITIAL tracking state in storage:`, newState);
        await browser.storage.local.set({ [STORAGE_KEY_TRACKING_STATE]: newState });
        // Log explicit start message only when transitioning from inactive
        console.log(`[Tracking] State started. Now tracking: ${currentDomain} (Timestamp: ${now})`);
      }
    } else {
      console.log(`[Debug updateTrackingState] Branch: Currently Inactive (isActive=false)`); // LOG: Branch taken
      // --- Currently Inactive ---
      if (previousState) {
        // --- Was Active Before ---
        console.log(`[Debug updateTrackingState] Sub-Branch: Was Active Before (previousState exists)`);
        // Record final time chunk for the domain that *was* active
        if (elapsedSeconds > 0) {
          console.log(
            `[Debug updateTrackingState] Calling recordTime for final chunk on ${finalDomainToRecord} with ${elapsedSeconds}s`
          );
          recordTime(finalDomainToRecord, elapsedSeconds);
          await saveData(); // Save cumulative totals
          // Log explicit stop message only when transitioning from active
          console.log(`[Tracking] Recorded final ${elapsedSeconds}s for ${finalDomainToRecord} (became inactive)`);
        } else {
          console.log(`[Debug updateTrackingState] Elapsed seconds <= 0, not recording final time.`);
        }
        // Clear the tracking state from storage
        console.log(`[Debug updateTrackingState] Removing tracking state from storage.`);
        await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
        // Log explicit stop message only when transitioning from active
        console.log(`[Tracking] State stopped (became inactive).`);
      } else {
        // --- Was Inactive Before ---
        console.log(
          `[Debug updateTrackingState] Sub-Branch: Was Inactive Before (previousState is null) - Doing nothing.`
        );
        // Do nothing, already inactive. Double-check clarity.
        const check = await browser.storage.local.get(STORAGE_KEY_TRACKING_STATE);
        if (check[STORAGE_KEY_TRACKING_STATE]) {
          console.warn('[Debug updateTrackingState] Found lingering tracking state while inactive. Clearing.');
          await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
        }
      }
    }
    console.log(`[Debug updateTrackingState] Finished processing.`); // LOG: Exit point
  } catch (error) {
    console.error('[Debug updateTrackingState] Error during execution:', error);
    // Attempt to clear tracking state on error to prevent inconsistent counts
    try {
      await browser.storage.local.remove(STORAGE_KEY_TRACKING_STATE);
      console.error('[Tracking] Cleared tracking state due to error in updateTrackingState.');
    } catch (clearError) {
      console.error('Failed to clear tracking state during error handling:', clearError);
    }
  }
}

/**
 * Helper function to add elapsed seconds to the tracked data structures.
 * @param {string} domain The domain to record time for.
 * @param {number} seconds The number of seconds to add.
 */
function recordTime(domain, seconds) {
  // console.log(`[Debug recordTime] Input: domain=${domain}, seconds=${seconds}`); // LOG: recordTime entry
  if (!domain || seconds <= 0) {
    console.warn(`[Debug recordTime] Invalid input, skipping.`);
    return;
  }

  const todayStr = getCurrentDateString();
  const currentHourStr = new Date().getHours().toString().padStart(2, '0'); // Get hour when recording

  // Ensure data structures exist
  if (!dailyDomainData[todayStr]) dailyDomainData[todayStr] = {};
  if (!dailyCategoryData[todayStr]) dailyCategoryData[todayStr] = {};
  if (!hourlyData[todayStr]) hourlyData[todayStr] = {};
  if (!hourlyData[todayStr][currentHourStr]) hourlyData[todayStr][currentHourStr] = 0;

  // Increment times
  // console.log(`[Debug recordTime] Before: trackedData[${domain}]=${trackedData[domain]||0}, dailyDomainData[${todayStr}][${domain}]=${(dailyDomainData[todayStr]||{})[domain]||0}`); // LOG: Before increment
  trackedData[domain] = (trackedData[domain] || 0) + seconds;
  dailyDomainData[todayStr][domain] = (dailyDomainData[todayStr][domain] || 0) + seconds;
  hourlyData[todayStr][currentHourStr] = (hourlyData[todayStr][currentHourStr] || 0) + seconds;
  // console.log(`[Debug recordTime] After: trackedData[${domain}]=${trackedData[domain]||0}, dailyDomainData[${todayStr}][${domain}]=${(dailyDomainData[todayStr]||{})[domain]||0}`); // LOG: After increment

  // Category Tracking
  const category = getCategoryForDomain(domain);
  if (category) {
    // console.log(`[Debug recordTime] Category: ${category}. Before: categoryTimeData[${category}]=${categoryTimeData[category]||0}, dailyCategoryData[${todayStr}][${category}]=${(dailyCategoryData[todayStr]||{})[category]||0}`); // LOG: Before category increment
    categoryTimeData[category] = (categoryTimeData[category] || 0) + seconds;
    dailyCategoryData[todayStr][category] = (dailyCategoryData[todayStr][category] || 0) + seconds;
    // console.log(`[Debug recordTime] Category: ${category}. After: categoryTimeData[${category}]=${categoryTimeData[category]||0}, dailyCategoryData[${todayStr}][${category}]=${(dailyCategoryData[todayStr]||{})[category]||0}`); // LOG: After category increment
  }
  // console.log(`[Debug recordTime] Finished for domain ${domain}`); // LOG: recordTime exit
}

// --- Event Handlers ---

// Tabs: Activated (switching tabs)
browser.tabs.onActivated.addListener(async (activeInfo) => {
  // console.log(`[Event] tabs.onActivated: Tab ${activeInfo.tabId}`); // Keep event logs less verbose if debug logs are detailed
  await updateTrackingState('tabs.onActivated');
});

// Tabs: Updated (URL change, loading state)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger if URL or status changes, as these affect trackability
  if (changeInfo.url || changeInfo.status) {
    // console.log(`[Event] tabs.onUpdated: Tab ${tabId}, Change: ${Object.keys(changeInfo).join(', ')}`);
    // Check if the update is for the *currently active* tab in the *focused* window before calling updateTrackingState
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
      // Don't necessarily call updateTrackingState on error here, wait for next alarm/event
    }
  }
});

// Windows: Focus Changed (switching windows, minimizing/maximizing)
browser.windows.onFocusChanged.addListener(async (windowId) => {
  // console.log(`[Event] windows.onFocusChanged: Window ${windowId === browser.windows.WINDOW_ID_NONE ? 'NONE' : windowId}`);
  await updateTrackingState('windows.onFocusChanged');
});

// Idle: State Changed (user active, idle, or locked)
browser.idle.onStateChanged.addListener(async (newState) => {
  // console.log(`[Event] idle.onStateChanged: ${newState}`);
  await updateTrackingState('idle.onStateChanged');
});

// --- Periodic Save/Check Alarm ---
const ALARM_NAME = 'periodicStateCheck';
const ALARM_PERIOD_MINUTES = 0.25; // 15 seconds

async function setupAlarm() {
  try {
    const alarm = await browser.alarms.get(ALARM_NAME);
    if (!alarm) {
      browser.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      console.log(`[Alarm] Created: ${ALARM_NAME}, Period: ${ALARM_PERIOD_MINUTES} min`);
    } else {
      console.log(`[Alarm] Already exists: ${ALARM_NAME}, Period: ${alarm.periodInMinutes} min`);
      if (alarm.periodInMinutes !== ALARM_PERIOD_MINUTES) {
        console.warn(`[Alarm] Period mismatch (${alarm.periodInMinutes}). Recreating.`);
        await browser.alarms.clear(ALARM_NAME);
        browser.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
      }
    }
  } catch (error) {
    console.error('[Alarm] Error setting up alarm:', error);
  }
}
setupAlarm(); // Setup alarm on script start

// Alarm listener
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    // console.log(`[Alarm] ${ALARM_NAME} Fired.`); // Keep alarm log minimal
    await updateTrackingState('Alarm');
  }
});

// --- Message Listener (for updates from options page) ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log(`[Message Listener] Received message: action=${request.action}`); // Keep message log minimal
  if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
    console.log(`[System] Reloading config data due to ${request.action} message.`);
    // Reload only config, not tracking data
    loadData()
      .then(() => {
        sendResponse({ success: true, message: 'Config data reloaded by background script.' });
      })
      .catch((err) => {
        console.error('Error reloading config data:', err);
        sendResponse({ success: false, message: 'Error reloading config.' });
      });
    return true; // Indicates asynchronous response
  }
  // Handle other potential messages if needed
  return false;
});

// --- Blocking & Limiting Logic (Assumed unchanged, ensure it uses loaded data) ---
// Make sure this logic correctly reads the up-to-date dailyDomainData and dailyCategoryData
function urlMatchesPattern(url, pattern) {
  if (!url || !pattern) return false;
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
  if (seconds < 0) seconds = 0;
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
  if (
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

  // Check LIMIT rules first
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

  // Check BLOCK rules if no limit was hit
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

// Register the blocking/limiting listener
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

console.log('[System] Background script finished loading (v15.2 - Detailed Logging).');
// --- End of background.js ---
