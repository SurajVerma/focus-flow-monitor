// background.js (v14 - DEBUG LOGGING - Simpler Timer Logic v3 - Regenerated Full File)

console.log('[System] Background script STARTING (v14 - DEBUG LOGGING - Simpler Timer Logic v3).');

// --- Core Tracking Variables ---
let currentTabId = null;
let currentTabUrl = null;
let startTime = null; // Timestamp when tracking for currentTabUrl started
let lastSavedTime = null; // Timestamp when time was last calculated/saved by updateTime
let trackedData = {}; // All-time domain totals {'domain.com': totalSeconds}
let categoryTimeData = {}; // All-time category totals {'Category': totalSeconds}
let dailyDomainData = {}; // Daily domain data {'YYYY-MM-DD': {'domain.com': secs, ...}}
let dailyCategoryData = {}; // Daily category data {'YYYY-MM-DD': {'Category': secs, ...}}
let hourlyData = {}; // Hourly totals {'YYYY-MM-DD': {'HH': totalSeconds, ...}}
let idleState = 'active'; // Still track the state
const idleThreshold = 1800; // Keep the constant, though not used by updateTime's core logic anymore

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
    let categoriesChanged = false; // Track if categories list itself was changed
    Object.values(categoryAssignments).forEach((catName) => {
      if (!categories.includes(catName)) {
        console.warn(`Assignment uses category "${catName}" which is not in list. Adding.`);
        categories.push(catName);
        categoriesChanged = true;
      }
    });
    if (categoriesChanged) needsSave = true; // Mark for saving if categories were added

    // Load Rules (combined block/limit)
    if (result.rules && Array.isArray(result.rules)) {
      rules = result.rules;
    } else {
      rules = [];
      if (result.rules) {
        console.warn("[System] Loaded 'rules' from storage was not an array, resetting. Value:", result.rules);
      }
      needsSave = true; // Mark for saving if rules were missing/invalid
    }

    // Load Tracking Data (Cumulative, Daily, and Hourly)
    trackedData = result.trackedData || {};
    categoryTimeData = result.categoryTimeData || {};
    dailyDomainData = result.dailyDomainData || {};
    dailyCategoryData = result.dailyCategoryData || {};
    hourlyData = result.hourlyData || {}; // *** ADDED Loading hourlyData ***
    if (!result.hourlyData) needsSave = true; // Mark for saving if hourlyData was missing

    console.log(
      `[System] State loaded: ${categories.length} cats, ${Object.keys(categoryAssignments).length} assigns, ${
        rules.length
      } rules. Daily data for ${Object.keys(dailyDomainData).length} days. Hourly data for ${
        Object.keys(hourlyData).length
      } days.`
    );

    // Save if defaults were needed OR if rules/hourlyData were missing/invalid or categories changed
    if (
      needsSave ||
      needDefaultCategories ||
      needDefaultAssignments ||
      needDefaultRules ||
      categoriesChanged ||
      !result.hourlyData
    ) {
      console.log('[System] Saving initial/updated state to storage.');
      await saveData(); // Ensure new structures are saved
    }
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
  }
}
// Initialize on startup
loadData();

// --- Save ALL current data state to storage ---
let isSaving = false; // Simple lock to prevent concurrent saves
async function saveData() {
  if (isSaving) {
    // console.warn('[Save Check] Save already in progress, skipping.');
    return;
  }
  isSaving = true;
  // console.log('[Save Check] Starting save operation...'); // Verbose log
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
    // console.log("[System] saveData Succeeded."); // Verbose success
  } catch (error) {
    console.error('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
    console.error('CRITICAL Error during saveData operation:', error);
    console.error('Data snapshot (counts):', {
      trackedKeys: Object.keys(trackedData).length,
      catTimeKeys: Object.keys(categoryTimeData).length,
      dailyDomainKeys: Object.keys(dailyDomainData).length,
      dailyCatKeys: Object.keys(dailyCategoryData).length,
      hourlyKeys: Object.keys(hourlyData).length,
      catCount: categories.length,
      assignCount: Object.keys(categoryAssignments).length,
      ruleCount: rules.length,
    });
    console.error('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  } finally {
    isSaving = false;
    // console.log('[Save Check] Save operation finished.'); // Verbose log
  }
}

// --- Get Domain & Category ---
function getDomain(url) {
  if (!url || !url.startsWith('http')) {
    // console.log(`[Debug] getDomain: Invalid URL provided: ${url}`);
    return null;
  }
  try {
    const hostname = new URL(url).hostname;
    // console.log(`[Debug] getDomain: URL=${url}, Hostname=${hostname}`);
    return hostname;
  } catch (e) {
    console.error(`[Debug] getDomain: Error parsing URL ${url}:`, e);
    return null;
  }
}

function getCategoryForDomain(domain) {
  if (!domain) return null;
  // Exact match first
  if (categoryAssignments.hasOwnProperty(domain)) {
    // console.log(`[Debug] getCategory: Exact match found for ${domain}: ${categoryAssignments[domain]}`);
    return categoryAssignments[domain];
  }
  // Wildcard matching
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    const wildcardPattern = '*.' + parentDomain;
    if (categoryAssignments.hasOwnProperty(wildcardPattern)) {
      // console.log(`[Debug] getCategory: Wildcard match found for ${domain} via ${wildcardPattern}: ${categoryAssignments[wildcardPattern]}`);
      return categoryAssignments[wildcardPattern];
    }
    // Check non-wildcard parent (e.g., for "mail.google.com" check "google.com" if "*.google.com" wasn't found)
    if (i > 0 && categoryAssignments.hasOwnProperty(parentDomain)) {
      // console.log(`[Debug] getCategory: Parent domain match found for ${domain} via ${parentDomain}: ${categoryAssignments[parentDomain]}`);
      return categoryAssignments[parentDomain];
    }
  }
  // console.log(`[Debug] getCategory: No specific assignment found for ${domain}, returning default: ${defaultCategory}`);
  return defaultCategory;
}

// --- Update Time Tracking (Simpler Logic V3) ---
function updateTime() {
  console.log(
    `[Debug updateTime V3] Called. currentTabUrl=${currentTabUrl}, startTime=${startTime}, lastSavedTime=${lastSavedTime}`
  );
  // Only proceed if the timer is actually running (startTime is set)
  if (currentTabUrl && startTime) {
    const domain = getDomain(currentTabUrl);
    if (domain) {
      const now = Date.now(); // Use simple timestamp
      // Calculate time since the last save OR since the timer started if no save yet
      const previousTime = lastSavedTime || startTime;
      const elapsedSeconds = Math.round((now - previousTime) / 1000);

      console.log(`[Debug updateTime V3] Domain=${domain}, elapsedSeconds=${elapsedSeconds} (since ${previousTime})`);

      if (elapsedSeconds > 0) {
        const nowDate = new Date(now); // Create Date object only if needed for hour
        const todayStr = getCurrentDateString();
        const currentHourStr = nowDate.getHours().toString().padStart(2, '0');

        // --- Ensure data structures exist ---
        if (!dailyDomainData[todayStr]) dailyDomainData[todayStr] = {};
        if (!dailyCategoryData[todayStr]) dailyCategoryData[todayStr] = {};
        if (!hourlyData[todayStr]) hourlyData[todayStr] = {};
        if (!hourlyData[todayStr][currentHourStr]) hourlyData[todayStr][currentHourStr] = 0;
        // --- End Init Checks ---

        // Log current values BEFORE incrementing (Optional Verbose Log)
        // console.log(`[Debug updateTime V3] Before Inc: trackedData[${domain}]=${trackedData[domain]||0}, dailyDomain[${todayStr}][${domain}]=${(dailyDomainData[todayStr]||{})[domain]||0}, hourly[${todayStr}][${currentHourStr}]=${(hourlyData[todayStr]||{})[currentHourStr]||0}`);

        // --- Increment times ---
        trackedData[domain] = (trackedData[domain] || 0) + elapsedSeconds;
        dailyDomainData[todayStr][domain] = (dailyDomainData[todayStr][domain] || 0) + elapsedSeconds;
        hourlyData[todayStr][currentHourStr] = (hourlyData[todayStr][currentHourStr] || 0) + elapsedSeconds;

        // --- Category Tracking ---
        const category = getCategoryForDomain(domain);
        console.log(
          `[Tracking V3] Domain: ${domain} -> Cat: ${
            category || 'None'
          } -> Hour: ${currentHourStr} (+${elapsedSeconds}s)`
        );
        if (category) {
          categoryTimeData[category] = (categoryTimeData[category] || 0) + elapsedSeconds;
          dailyCategoryData[todayStr][category] = (dailyCategoryData[todayStr][category] || 0) + elapsedSeconds;
        }

        // Update lastSavedTime to NOW, but DO NOT reset startTime
        lastSavedTime = now;
        console.log(`[Debug updateTime V3] Updated lastSavedTime to ${lastSavedTime}. startTime remains ${startTime}`);
        saveData(); // Save accumulated data
      } else {
        console.log('[Debug updateTime V3] elapsedSeconds was 0 or less, not saving time. lastSavedTime not updated.');
        // If no time passed, no need to update lastSavedTime
      }
    } else {
      // Domain is null
      console.log('[Debug updateTime V3] Domain was null, stopping timer.');
      startTime = null;
      lastSavedTime = null;
    }
  } else {
    // Timer wasn't running
    console.log('[Debug updateTime V3] currentTabUrl or startTime is null, timer is stopped or not started.');
    // Ensure timer is marked as stopped if conditions aren't met
    startTime = null;
    lastSavedTime = null;
  }
}

// --- Event Handlers for Tabs, Windows, Idle ---
function handleTabActivation(activeInfo) {
  console.log(`[Event handleTabActivation] Fired. Tab ID: ${activeInfo.tabId}, Window ID: ${activeInfo.windowId}`);
  updateTime(); // Save time from previous tab first
  // --- Stop previous timer state explicitly ---
  currentTabUrl = null;
  startTime = null;
  lastSavedTime = null;
  console.log('[Event handleTabActivation] Explicitly stopped timer state for previous tab.');
  // --- Attempt to start timer for new tab ---
  currentTabId = activeInfo.tabId;
  browser.tabs
    .get(currentTabId)
    .then((tab) => {
      if (!browser.runtime.lastError && tab && tab.active && tab.windowId !== browser.windows.WINDOW_ID_NONE) {
        console.log(
          `[Event handleTabActivation] Tab ${tab.id} confirmed active in window ${tab.windowId}. URL: ${tab.url}`
        );
        browser.windows
          .get(tab.windowId)
          .then((windowInfo) => {
            if (!browser.runtime.lastError && windowInfo.focused) {
              const newDomain = getDomain(tab.url);
              if (newDomain) {
                // Only start if the URL gives a valid domain
                console.log(
                  `[Event handleTabActivation] Window ${tab.windowId} IS focused. Starting timer for domain ${newDomain}.`
                );
                currentTabUrl = tab.url;
                startTime = Date.now();
                lastSavedTime = startTime; // Initialize lastSavedTime
                console.log(
                  `[Event handleTabActivation] NEW startTime = ${startTime}, NEW lastSavedTime = ${lastSavedTime}`
                );
              } else {
                console.log(
                  `[Event handleTabActivation] Window focused but URL ${tab.url} yields no domain. Timer not started.`
                );
              }
            } else {
              console.log(`[Event handleTabActivation] Window ${tab.windowId} is NOT focused. Timer remains stopped.`);
            }
          })
          .catch((err) => {
            console.error('[Event handleTabActivation] Error getting window info:', err);
          });
      } else {
        console.log(
          `[Event handleTabActivation] Tab ${tab ? tab.id : 'N/A'} is not active or invalid. Timer remains stopped.`
        );
      }
    })
    .catch((error) => {
      console.error('[Event handleTabActivation] Error getting tab info:', error);
    });
}

function handleTabUpdate(tabId, changeInfo, tab) {
  console.log(`[Event handleTabUpdate] Fired. Tab ID: ${tabId}, Active: ${tab.active}, ChangeInfo:`, changeInfo);
  // Only act if it's the currently tracked tab AND the tab is still reported as active
  if (tabId === currentTabId && tab.active) {
    if (changeInfo.url && changeInfo.url !== currentTabUrl) {
      // Check if URL actually changed
      console.log(`[Event handleTabUpdate] URL changed for active tab ${tabId}. New URL: ${changeInfo.url}`);
      browser.windows
        .get(tab.windowId)
        .then((windowInfo) => {
          if (!browser.runtime.lastError && windowInfo.focused) {
            console.log(
              `[Event handleTabUpdate] Window ${tab.windowId} focused. Saving old time, starting timer for new URL.`
            );
            updateTime(); // Save time for old URL
            const newDomain = getDomain(changeInfo.url);
            if (newDomain) {
              currentTabUrl = changeInfo.url;
              startTime = Date.now(); // Reset timer START
              lastSavedTime = startTime; // Reset last saved time
              console.log(
                `[Event handleTabUpdate] NEW startTime = ${startTime}, NEW lastSavedTime = ${lastSavedTime} for domain ${newDomain}`
              );
            } else {
              console.log(`[Event handleTabUpdate] New URL ${changeInfo.url} yields no domain. Stopping timer.`);
              currentTabUrl = null;
              startTime = null;
              lastSavedTime = null;
            }
          } else {
            console.log(`[Event handleTabUpdate] Window ${tab.windowId} NOT focused. Stopping timer.`);
            updateTime(); // Save old time
            currentTabUrl = null;
            startTime = null;
            lastSavedTime = null;
          }
        })
        .catch((error) => {
          console.error('[Event handleTabUpdate] Error getting window info:', error);
          updateTime(); // Save old time
          currentTabUrl = null;
          startTime = null;
          lastSavedTime = null;
        });
    } else if (changeInfo.status === 'loading') {
      console.log(
        `[Event handleTabUpdate] Active tab ${tabId} started loading. Saving time for previous URL. Timer continuity depends on next URL.`
      );
      updateTime(); // Save time for the old URL state
      // Important: DO NOT reset startTime or currentTabUrl here. Wait for the URL change event.
    }
  } else if (tabId === currentTabId && !tab.active) {
    console.log(`[Event handleTabUpdate] Tracked tab ${tabId} became inactive. Stopping timer.`);
    updateTime(); // Save time
    currentTabUrl = null;
    startTime = null;
    lastSavedTime = null;
  } else {
    // console.log(`[Event handleTabUpdate] Update for non-current or already inactive tab ${tabId}. Ignoring timer.`);
  }
}

function handleWindowFocusChange(windowId) {
  console.log(`[Event handleWindowFocusChange] Fired. New Window ID: ${windowId}`);
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // Window lost focus
    console.log('[Event handleWindowFocusChange] Browser lost focus. Stopping timer.');
    updateTime(); // Save any pending time
    currentTabUrl = null; // Mark as not tracking
    startTime = null;
    lastSavedTime = null;
  } else {
    // Window gained focus
    console.log(`[Event handleWindowFocusChange] Browser gained focus on window ${windowId}. Querying active tab.`);
    browser.tabs
      .query({ active: true, windowId: windowId })
      .then((tabs) => {
        if (!browser.runtime.lastError && tabs.length > 0) {
          // Check if this tab is different OR if the timer wasn't running
          if (tabs[0].id !== currentTabId || !startTime) {
            console.log(
              `[Event handleWindowFocusChange] Active tab ${tabs[0].id} in focused window is new or timer was stopped. Activating...`
            );
            handleTabActivation({ tabId: tabs[0].id, windowId: windowId }); // Let activation handle starting timer
          } else {
            console.log(
              `[Event handleWindowFocusChange] Active tab ${tabs[0].id} is the same and timer was running. Ensuring timer continues by updating lastSavedTime.`
            );
            // Update lastSavedTime to prevent a large jump if updateTime hasn't run recently
            lastSavedTime = Date.now();
            console.log(
              `[Event handleWindowFocusChange] Updated lastSavedTime to ${lastSavedTime}. startTime remains ${startTime}`
            );
          }
        } else {
          console.log('[Event handleWindowFocusChange] No active tab found in focused window? Stopping timer.');
          updateTime(); // Save any pending time from previous state
          currentTabUrl = null;
          startTime = null;
          lastSavedTime = null;
        }
      })
      .catch((error) => {
        console.error('[Event handleWindowFocusChange] Error querying tabs:', error);
        currentTabUrl = null;
        startTime = null;
        lastSavedTime = null;
      });
  }
}

// Modified Idle Listener
browser.idle.onStateChanged.addListener((newState) => {
  console.log(`[Idle] State changed from ${idleState} to ${newState}`);
  const oldState = idleState;
  idleState = newState;

  if (newState === 'active' && oldState !== 'active') {
    console.log('[Idle] State became active. Re-checking active tab/window focus.');
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (!browser.runtime.lastError && tabs.length > 0) {
          browser.windows
            .get(tabs[0].windowId)
            .then((windowInfo) => {
              if (!browser.runtime.lastError && windowInfo.focused) {
                // Only restart timer if it was previously stopped (startTime is null)
                if (!startTime) {
                  console.log('[Idle] User active and window focused. Timer was stopped, calling handleTabActivation.');
                  handleTabActivation({ tabId: tabs[0].id, windowId: tabs[0].windowId });
                } else {
                  console.log(
                    '[Idle] User active and window focused, and timer was already running. Updating lastSavedTime.'
                  );
                  // Prevent potential large jump in time calculation if updateTime hasn't run recently
                  lastSavedTime = Date.now();
                  console.log(`[Idle] Updated lastSavedTime to ${lastSavedTime}. startTime remains ${startTime}`);
                }
              } else {
                console.log('[Idle] User active BUT window NOT focused. Timer remains stopped.');
                // Ensure timer is marked stopped if window isn't focused
                currentTabUrl = null;
                startTime = null;
                lastSavedTime = null;
              }
            })
            .catch((err) => {
              console.error('[Idle] Error checking window focus on becoming active:', err);
              currentTabUrl = null;
              startTime = null;
              lastSavedTime = null;
            });
        } else {
          console.log('[Idle] User active but no active tab found. Timer remains stopped.');
          currentTabUrl = null;
          startTime = null;
          lastSavedTime = null;
        }
      })
      .catch((error) => {
        console.error('[Idle] Err query tabs on becoming active:', error);
        currentTabUrl = null;
        startTime = null;
        lastSavedTime = null;
      });
  } else if (newState === 'locked') {
    // Stop timer ONLY if the screen is locked
    console.log('[Idle] Screen locked. Stopping timer.');
    updateTime(); // Save any pending time before stopping
    startTime = null;
    lastSavedTime = null;
  } else if (newState === 'idle') {
    // User is idle, but screen isn't locked.
    console.log('[Idle] Idle state detected, timer continues. Saving progress via updateTime.');
    updateTime(); // Save potentially accumulated time, doesn't stop timer
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
    console.log('[Alarm periodicSave] Fired. Calling updateTime.');
    updateTime(); // Calls updateTime to save progress if timer is running
  }
});

// --- Message Listener ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`[Message Listener] Received message: action=${request.action}`);
  if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
    console.log(`[System] Reloading data due to ${request.action} message.`);
    loadData(); // Reload categories, assignments, and rules
    sendResponse({ success: true, message: 'Data reloaded by background script.' });
    return true; // Indicates asynchronous response is possible
  }
  return false; // No asynchronous response for other messages
});

// --- Blocking & Limiting Logic (Assume unchanged) ---
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
  const normalizedPattern = normalize(pattern);
  if (pattern.startsWith('*.')) {
    const basePattern = normalizedPattern.substring(2);
    return normalizedUrlHost === basePattern || normalizedUrlHost.endsWith('.' + basePattern);
  } else {
    return normalizedUrlHost === normalizedPattern;
  }
}
function formatTimeBlocking(seconds) {
  /* Use a separate formatTime if needed, or reuse main one */
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `<1m`;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
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
  let determinedCategory = null;
  const todayStr = getCurrentDateString();
  const todaysDomainData = dailyDomainData[todayStr] || {};
  const todaysCategoryData = dailyCategoryData[todayStr] || {};
  const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');

  console.log(
    `\n[Request Handler START] URL: ${requestedUrl} (Domain: ${requestedDomain}). Checking ${rules.length} rules.`
  );

  // Check LIMIT rules
  for (const rule of rules) {
    if (!rule.type.includes('limit-')) continue;
    let ruleMatches = false;
    let timeSpentToday = -1;
    let limitSeconds = rule.limitSeconds || 0;
    let targetValue = rule.value;
    if (limitSeconds <= 0) continue;
    try {
      if (rule.type === 'limit-url') {
        if (requestedDomain && urlMatchesPattern(requestedUrl, targetValue)) {
          ruleMatches = true;
          timeSpentToday = todaysDomainData[requestedDomain] || 0;
        }
      } else if (rule.type === 'limit-category') {
        if (!determinedCategory && requestedDomain) determinedCategory = getCategoryForDomain(requestedDomain);
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
          timeSpentToday = todaysCategoryData[determinedCategory] || 0;
        }
      }
      if (ruleMatches) {
        const limitReached = timeSpentToday >= limitSeconds;
        console.log(
          `    [Limit Result] For ${rule.type}='${targetValue}': Limit=${formatTimeBlocking(
            limitSeconds
          )}, Spent=${formatTimeBlocking(timeSpentToday)}. Limit reached: ${limitReached}`
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
      console.error(`[Limit Check Error] Rule ${JSON.stringify(rule)} for URL ${requestedUrl}`, e);
    }
  }
  // Check BLOCK rules
  for (const rule of rules) {
    if (!rule.type.includes('block-')) continue;
    let ruleMatches = false;
    let targetValue = rule.value;
    try {
      if (rule.type === 'block-url') {
        if (urlMatchesPattern(requestedUrl, targetValue)) ruleMatches = true;
      } else if (rule.type === 'block-category') {
        if (!determinedCategory && requestedDomain) determinedCategory = getCategoryForDomain(requestedDomain);
        if (determinedCategory && determinedCategory === targetValue) ruleMatches = true;
      }
      if (ruleMatches) {
        console.log(`    [!!! BLOCK ENFORCED !!!] Rule matched: ${rule.type}='${targetValue}'. REDIRECTING.`);
        const params = new URLSearchParams();
        params.append('url', requestedUrl);
        params.append('reason', 'block');
        params.append('type', rule.type);
        params.append('value', targetValue);
        return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
      }
    } catch (e) {
      console.error(`[Block Check Error] Rule ${JSON.stringify(rule)} for URL ${requestedUrl}`, e);
    }
  }
  console.log(`[Request Handler END] Allowing request for ${requestedUrl}`);
  return {};
}

// Register the blocking/limiting listener
try {
  if (browser.webRequest) {
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

console.log('[System] Background script finished loading (v14 - DEBUG LOGGING - Simpler Timer Logic v3).');
// --- End of background.js ---
