// background.js (v14 - Hourly Tracking added to YOUR v13 - MODIFIED TO IGNORE IDLE STATE)

console.log('[System] Background script STARTING (v14 - Hourly Tracking - Modified: Ignore Idle).'); // Updated version marker

// --- Core Tracking Variables ---
let currentTabId = null;
let currentTabUrl = null;
let startTime = null;
let trackedData = {}; // All-time domain totals
let categoryTimeData = {}; // All-time category totals
let dailyDomainData = {}; // Daily domain data {'YYYY-MM-DD': {'domain.com': secs, ...}}
let dailyCategoryData = {}; // Daily category data {'YYYY-MM-DD': {'Category': secs, ...}}
let hourlyData = {}; // *** NEW: Hourly totals {'YYYY-MM-DD': {'HH': totalSeconds, ...}} ***
let idleState = 'active'; // Still track the state, but updateTime won't use it directly
const idleThreshold = 1800; // Keep the constant, though it's not used by updateTime's core logic anymore

// --- Configuration (loaded from storage or JSON defaults) ---
let categories = ['Other'];
let categoryAssignments = {};
// Use 'rules' to store both block and limit rules
let rules = [];
const defaultCategory = 'Other';

// --- Helper: Get current date string ---
function getCurrentDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`; // YYYY-MM-DD format
}

// --- Load stored data or fetch defaults ---
async function loadData() {
  console.log('[System] loadData started.');
  try {
    // Load combined 'rules' key now AND hourlyData
    const result = await browser.storage.local.get([
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules', // Use 'rules' key
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData', // *** ADDED Loading hourlyData ***
    ]);
    console.log('[System] Data loaded from storage:', result ? 'OK' : 'Empty/Error');

    let needsSave = false; // Flag if defaults were loaded and need saving
    let defaults = null; // To store defaults loaded from JSON

    // Determine if defaults are needed
    const needDefaultCategories = !result.categories || result.categories.length === 0;
    const needDefaultAssignments = !result.categoryAssignments || Object.keys(result.categoryAssignments).length === 0;
    const needDefaultRules = !result.rules; // Check if combined 'rules' key exists

    // Fetch defaults ONLY if categories/assignments are missing
    if (needDefaultCategories || needDefaultAssignments) {
      try {
        console.log('[System] Fetching defaults from data/default_config.json...');
        const response = await fetch(browser.runtime.getURL('data/default_config.json'));
        if (!response.ok) throw new Error(`Fetch error: ${response.status}`); // Corrected error
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
    if (!needDefaultCategories) {
      categories = result.categories;
    } else {
      categories = defaults ? [...defaults.categories] : ['Other'];
      needsSave = true;
    }
    if (!categories.includes(defaultCategory)) {
      categories.push(defaultCategory);
      needsSave = true;
    }
    if (!needDefaultAssignments) {
      categoryAssignments = result.categoryAssignments;
    } else {
      categoryAssignments = defaults ? { ...defaults.assignments } : {};
      needsSave = true;
    }
    let categoriesAdded = false;
    Object.values(categoryAssignments).forEach((catName) => {
      if (!categories.includes(catName)) {
        console.warn(`Assignment uses category "${catName}" which is not in list. Adding.`);
        categories.push(catName);
        categoriesAdded = true;
      }
    });
    if (categoriesAdded) needsSave = true;

    // Load Rules (combined block/limit)
    if (result.rules && Array.isArray(result.rules)) {
      rules = result.rules;
    } else {
      rules = [];
      if (result.rules) {
        console.warn("[System] Loaded 'rules' from storage was not an array, resetting. Value:", result.rules);
      }
      needsSave = true;
    }

    // Load Tracking Data (Cumulative, Daily, and Hourly)
    trackedData = result.trackedData || {};
    categoryTimeData = result.categoryTimeData || {};
    dailyDomainData = result.dailyDomainData || {};
    dailyCategoryData = result.dailyCategoryData || {};
    hourlyData = result.hourlyData || {}; // *** ADDED Loading hourlyData ***

    console.log(
      `[System] State loaded: ${categories.length} cats, ${Object.keys(categoryAssignments).length} assigns, ${
        rules.length
      } rules. Daily data for ${Object.keys(dailyDomainData).length} days. Hourly data for ${
        Object.keys(hourlyData).length
      } days.` // Updated log
    );

    // Save if defaults were loaded OR if rules/hourlyData were missing/invalid
    if (needsSave || needDefaultRules || !result.hourlyData) {
      // Added check for hourlyData
      console.log('[System] Saving initial/updated state to storage.');
      await saveData(); // Ensure new structures are saved
    }
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
    hourlyData = {}; // Reset hourly too
  }
}
// Initialize on startup
loadData();

// --- Save ALL current data state to storage ---
async function saveData() {
  // Log data just before saving for debugging purposes
  console.log('[Save Check] Data just before saving:', {
    todayDomain: JSON.stringify(dailyDomainData[getCurrentDateString()] || {}),
    todayCategory: JSON.stringify(dailyCategoryData[getCurrentDateString()] || {}),
    todayHourly: JSON.stringify(hourlyData[getCurrentDateString()] || {}), // Log hourly too
    rulesCount: rules.length, // Log rule count being saved
  });
  try {
    await browser.storage.local.set({
      trackedData,
      categoryTimeData,
      dailyDomainData,
      dailyCategoryData,
      hourlyData, // *** ADDED Saving hourlyData ***
      categories,
      categoryAssignments,
      rules, // Save combined rules list
    });
    // console.log("[System] saveData Succeeded."); // Optional: uncomment for verbose success logs
  } catch (error) {
    console.error('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
    console.error('CRITICAL Error during saveData operation:', error);
    // Log data snapshot on error
    console.error('Data snapshot (counts):', {
      trackedKeys: Object.keys(trackedData).length,
      catTimeKeys: Object.keys(categoryTimeData).length,
      dailyDomainKeys: Object.keys(dailyDomainData).length,
      dailyCatKeys: Object.keys(dailyCategoryData).length,
      hourlyKeys: Object.keys(hourlyData).length, // Log hourly keys count
      catCount: categories.length,
      assignCount: Object.keys(categoryAssignments).length,
      ruleCount: rules.length,
    });
    console.error('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  }
}

// --- Get Domain & Category ---
function getDomain(url) {
  if (!url || !url.startsWith('http')) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

function getCategoryForDomain(domain) {
  if (!domain) return null;
  if (categoryAssignments.hasOwnProperty(domain)) return categoryAssignments[domain];
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    const wildcardPattern = '*.' + parentDomain;
    if (categoryAssignments.hasOwnProperty(wildcardPattern)) return categoryAssignments[wildcardPattern];
    if (i > 0 && categoryAssignments.hasOwnProperty(parentDomain)) return categoryAssignments[parentDomain];
  }
  return defaultCategory;
}

// --- Update Time Tracking ---
// MODIFIED: Removed idleState check
function updateTime() {
  // Check only if we have a current URL and a start time
  if (currentTabUrl && startTime) {
    const domain = getDomain(currentTabUrl);
    if (domain) {
      const now = new Date(); // Get full date object once
      const elapsedSeconds = Math.round((now.getTime() - startTime) / 1000);

      if (elapsedSeconds > 0) {
        const todayStr = getCurrentDateString(); // Date string: YYYY-MM-DD
        const currentHourStr = now.getHours().toString().padStart(2, '0'); // Hour string: "00" - "23"

        // --- Ensure entries for today exist ---
        if (!dailyDomainData[todayStr]) {
          console.log(`[Daily Init] Creating dailyDomainData entry for ${todayStr}`);
          dailyDomainData[todayStr] = {};
        }
        if (!dailyCategoryData[todayStr]) {
          console.log(`[Daily Init] Creating dailyCategoryData entry for ${todayStr}`);
          dailyCategoryData[todayStr] = {};
        }
        // *** NEW: Ensure entry for current hour exists ***
        if (!hourlyData[todayStr]) {
          console.log(`[Hourly Init] Creating hourlyData entry for ${todayStr}`);
          hourlyData[todayStr] = {};
        }
        // *** NEW: Initialize hour bucket if needed (storing total seconds per hour) ***
        if (!hourlyData[todayStr][currentHourStr]) {
          // Initialize with 0 if this hour hasn't been seen today
          hourlyData[todayStr][currentHourStr] = 0;
        }
        // *** --- End Init Checks --- ***

        // --- Increment All-Time Totals ---
        trackedData[domain] = (trackedData[domain] || 0) + elapsedSeconds;
        // --- Increment Daily Totals ---
        dailyDomainData[todayStr][domain] = (dailyDomainData[todayStr][domain] || 0) + elapsedSeconds;
        // *** NEW: Increment Hourly Total ***
        // Ensure the value is treated as a number
        hourlyData[todayStr][currentHourStr] = (hourlyData[todayStr][currentHourStr] || 0) + elapsedSeconds;

        // --- Category Tracking (All-Time and Daily) ---
        const category = getCategoryForDomain(domain);
        console.log(
          `[Tracking] Domain: ${domain} -> Cat: ${category || 'None'} -> Hour: ${currentHourStr} (+${elapsedSeconds}s)`
        ); // Added Hour

        if (category) {
          categoryTimeData[category] = (categoryTimeData[category] || 0) + elapsedSeconds;
          dailyCategoryData[todayStr][category] = (dailyCategoryData[todayStr][category] || 0) + elapsedSeconds;
        } else {
          console.warn(`[Tracking] Failed to assign category for domain: ${domain}`);
        }

        // --- Update Start Time & Save ---
        startTime = now.getTime(); // Reset start time using getTime()
        saveData(); // Save all data structures
      }
    } else {
      startTime = null; // Domain is null
    }
  } else {
    // If either currentTabUrl or startTime is null, ensure timer is stopped
    // This handles cases like browser startup or when focus is lost
    startTime = null;
  }
}

// --- Event Handlers for Tabs, Windows, Idle ---
function handleTabActivation(activeInfo) {
  updateTime(); // Save time from previous tab before switching
  currentTabId = activeInfo.tabId;
  browser.tabs
    .get(currentTabId)
    .then((tab) => {
      // Check if tab is valid, active, and in a real window
      if (!browser.runtime.lastError && tab && tab.active && tab.windowId !== browser.windows.WINDOW_ID_NONE) {
        browser.windows
          .get(tab.windowId)
          .then((windowInfo) => {
            // Check if the window is focused
            if (!browser.runtime.lastError && windowInfo.focused) {
              currentTabUrl = tab.url;
              startTime = Date.now(); // Start timer for the new active tab
            } else {
              // Tab is active but window is not focused
              currentTabUrl = null;
              startTime = null;
            }
          })
          .catch((err) => {
            // Error getting window info, assume not trackable
            console.error('Err get window (act):', err);
            currentTabUrl = null;
            startTime = null;
          });
      } else {
        // Tab is not active, invalid, or not in a real window
        currentTabUrl = null;
        startTime = null;
      }
    })
    .catch((error) => {
      // Error getting tab info
      console.error('Err get tab (act):', error);
      currentTabUrl = null;
      startTime = null;
    });
}

function handleTabUpdate(tabId, changeInfo, tab) {
  // Check if it's the current tab, the URL changed, and the tab is active
  if (tabId === currentTabId && changeInfo.url && tab.active) {
    browser.windows
      .get(tab.windowId)
      .then((windowInfo) => {
        // Check if the window is focused
        if (!browser.runtime.lastError && windowInfo.focused) {
          updateTime(); // Save time before URL changes
          currentTabUrl = changeInfo.url;
          startTime = Date.now(); // Restart timer for the new URL
        } else {
          // Tab updated but window isn't focused, stop timer
          updateTime();
          currentTabUrl = null;
          startTime = null;
        }
      })
      .catch((error) => {
        // Error getting window info, stop timer
        console.error('Err get window (upd):', error);
        updateTime();
        currentTabUrl = null;
        startTime = null;
      });
  } else if (tabId === currentTabId && changeInfo.status === 'loading' && tab.active) {
    // If the *active* tab starts loading a new page (even if URL isn't in changeInfo yet)
    // treat it like an update to stop the timer for the old URL immediately.
    updateTime();
    // Don't reset startTime here, wait for URL change or activation
  }
}

function handleWindowFocusChange(windowId) {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    updateTime(); // Save any pending time
    currentTabUrl = null;
    startTime = null;
  } else {
    // Browser gained focus, check the active tab in that window
    browser.tabs
      .query({ active: true, windowId: windowId })
      .then((tabs) => {
        if (!browser.runtime.lastError && tabs.length > 0) {
          // Effectively treat this like a tab activation
          handleTabActivation({ tabId: tabs[0].id, windowId: windowId });
        } else {
          // No active tab found in the focused window?
          currentTabUrl = null;
          startTime = null;
        }
      })
      .catch((error) => {
        console.error('Err query tabs (focus):', error);
        currentTabUrl = null;
        startTime = null;
      });
  }
}

// Listener for idle state changes - still useful for other potential features
// or if you later add options to use idle state again.
browser.idle.onStateChanged.addListener((newState) => {
  console.log(`[Idle] State changed from ${idleState} to ${newState}`);
  const oldState = idleState;
  idleState = newState;
  // Reset start time when becoming active after being non-active
  // Note: updateTime() no longer strictly depends on idleState === 'active'
  if (newState === 'active' && oldState !== 'active') {
    // Re-check the current tab when becoming active
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (!browser.runtime.lastError && tabs.length > 0) {
          handleTabActivation({ tabId: tabs[0].id, windowId: tabs[0].windowId });
        } else {
          currentTabUrl = null;
          startTime = null;
        }
      })
      .catch((error) => {
        console.error('Err query tabs (idle):', error);
        currentTabUrl = null;
        startTime = null;
      });
  } else if (newState !== 'active') {
    // Save time immediately when becoming idle or locked
    updateTime();
    startTime = null; // Stop timer
  }
});

// Register event listeners
browser.tabs.onActivated.addListener(handleTabActivation);
browser.tabs.onUpdated.addListener(handleTabUpdate, { properties: ['status', 'url'] });
browser.windows.onFocusChanged.addListener(handleWindowFocusChange);

// --- Periodic Save Alarm ---
browser.alarms.create('periodicSave', { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodicSave') {
    // Still call updateTime to potentially save accumulated time if active
    updateTime();
  }
});

// --- Message Listener (Unified for Rules) ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
    console.log(`[System] Reloading data due to ${request.action} message.`);
    loadData(); // Reload categories, assignments, and rules
    sendResponse({ success: true, message: 'Data reloaded by background script.' });
    return true; // Indicates asynchronous response is possible
  }
  return false; // No asynchronous response for other messages
});

// --- Blocking & Limiting Logic ---
function urlMatchesPattern(url, pattern) {
  if (!url || !pattern) return false;

  // Normalize URL and pattern by removing protocol and www.
  const normalize = (u) => {
    try {
      let hostname = new URL(u).hostname;
      // Strip www. if it exists
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch {
      // If URL parsing fails (e.g., just a pattern like "badsite.com"), normalize the pattern string
      return pattern
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, ''); // Remove trailing slash if any
    }
  };

  const normalizedUrlHost = normalize(url);
  const normalizedPattern = normalize(pattern);

  // Handle wildcard matching (*.example.com)
  if (pattern.startsWith('*.')) {
    const basePattern = normalizedPattern.substring(2); // Remove "*.";
    return normalizedUrlHost === basePattern || normalizedUrlHost.endsWith('.' + basePattern);
  } else {
    // Exact domain match
    return normalizedUrlHost === normalizedPattern;
  }
}

function handleBlockingRequest(requestDetails) {
  // Ignore requests not for the main page or initiated by the extension itself
  if (
    requestDetails.type !== 'main_frame' ||
    !requestDetails.url ||
    requestDetails.url.startsWith('moz-extension://') || // Ignore own extension pages
    requestDetails.url.startsWith('about:') // Ignore internal browser pages
  ) {
    return {}; // Allow the request
  }

  const requestedUrl = requestDetails.url;
  const requestedDomain = getDomain(requestedUrl);
  let determinedCategory = null; // Lazy load category only if needed
  const todayStr = getCurrentDateString();
  const todaysDomainData = dailyDomainData[todayStr] || {};
  const todaysCategoryData = dailyCategoryData[todayStr] || {};
  const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');

  console.log(
    `\n[Request Handler START] URL: ${requestedUrl} (Domain: ${requestedDomain}). Checking ${rules.length} rules.`
  );

  // --- 1. Check LIMIT rules first ---
  for (const rule of rules) {
    if (!rule.type.includes('limit-')) continue; // Only process limit rules here

    let ruleMatches = false;
    let timeSpentToday = -1; // Use -1 to indicate not yet calculated
    let limitSeconds = rule.limitSeconds || 0;
    let targetValue = rule.value;

    if (limitSeconds <= 0) continue; // Skip rules with invalid limits

    try {
      // Check URL Limit
      if (rule.type === 'limit-url') {
        if (requestedDomain && urlMatchesPattern(requestedUrl, targetValue)) {
          ruleMatches = true;
          // Get time spent on *this specific domain* today
          timeSpentToday = todaysDomainData[requestedDomain] || 0;
        }
      }
      // Check Category Limit
      else if (rule.type === 'limit-category') {
        // Determine category only if needed for this rule type
        if (!determinedCategory && requestedDomain) {
          determinedCategory = getCategoryForDomain(requestedDomain);
        }
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
          // Get time spent on *this specific category* today
          timeSpentToday = todaysCategoryData[determinedCategory] || 0;
        }
      }

      // If the rule matches, check if the limit is reached
      if (ruleMatches) {
        const limitReached = timeSpentToday >= limitSeconds;
        console.log(
          `    [Limit Result] For ${rule.type}='${targetValue}': Limit=${formatTime(
            limitSeconds,
            false
          )}, Spent=${formatTime(timeSpentToday, false)}. Limit reached: ${limitReached}`
        );
        if (limitReached) {
          console.log(`    [!!! LIMIT ENFORCED !!!] Limit EXCEEDED. REDIRECTING.`);
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
      console.error(`[Limit Check Error] Processing rule ${JSON.stringify(rule)} for URL ${requestedUrl}`, e);
    }
  }

  // --- 2. Check BLOCK rules if no limit was reached ---
  for (const rule of rules) {
    if (!rule.type.includes('block-')) continue; // Only process block rules here

    let ruleMatches = false;
    let targetValue = rule.value;

    try {
      // Check URL Block
      if (rule.type === 'block-url') {
        if (urlMatchesPattern(requestedUrl, targetValue)) {
          ruleMatches = true;
        }
      }
      // Check Category Block
      else if (rule.type === 'block-category') {
        // Determine category only if needed and not already determined
        if (!determinedCategory && requestedDomain) {
          determinedCategory = getCategoryForDomain(requestedDomain);
        }
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
        }
      }

      if (ruleMatches) {
        console.log(
          `    [!!! BLOCK ENFORCED !!!] Permanent block rule matched: ${rule.type}='${targetValue}'. REDIRECTING.`
        );
        const params = new URLSearchParams();
        params.append('url', requestedUrl);
        params.append('reason', 'block');
        params.append('type', rule.type);
        params.append('value', targetValue);
        return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
      }
    } catch (e) {
      console.error(`[Block Check Error] Processing rule ${JSON.stringify(rule)} for URL ${requestedUrl}`, e);
    }
  }

  // Allow the request if no blocking or limiting rule was matched and returned a redirect
  console.log(`[Request Handler END] Allowing request for ${requestedUrl}`);
  return {}; // Allow the request
}

// Register the blocking/limiting listener
try {
  if (browser.webRequest) {
    browser.webRequest.onBeforeRequest.addListener(
      handleBlockingRequest,
      { urls: ['<all_urls>'], types: ['main_frame'] },
      ['blocking']
    );
    console.log('[System] Request listener (blocking/limiting/redirecting) registered.');
  } else {
    console.error('[System] browser.webRequest API not available.');
  }
} catch (error) {
  console.error('CRITICAL: Failed to register request listener.', error);
}

console.log('[System] Background script finished loading (v14 - Hourly Tracking - Modified: Ignore Idle).'); // Updated version marker

// --- End of background.js ---
