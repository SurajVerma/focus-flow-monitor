function recordTime(domain, seconds) {
  if (!domain || seconds <= 0) {
    return;
  }
  console.log(`[Tracking RecordTime] Recording ${seconds}s for domain: ${domain}`);

  const todayStr = getCurrentDateString(); // From utils.js
  const currentHour = new Date().getHours();
  const currentHourStr = currentHour.toString().padStart(2, '0');

  try {
    // Ensure data structures exist
    if (!FocusFlowState.dailyDomainData[todayStr]) FocusFlowState.dailyDomainData[todayStr] = {};
    if (!FocusFlowState.dailyCategoryData[todayStr]) FocusFlowState.dailyCategoryData[todayStr] = {};
    if (!FocusFlowState.hourlyData[todayStr]) FocusFlowState.hourlyData[todayStr] = {};
    if (!FocusFlowState.hourlyData[todayStr][currentHourStr]) FocusFlowState.hourlyData[todayStr][currentHourStr] = 0;

    // --- Update State ---
    FocusFlowState.trackedData[domain] = (FocusFlowState.trackedData[domain] || 0) + seconds;
    FocusFlowState.dailyDomainData[todayStr][domain] =
      (FocusFlowState.dailyDomainData[todayStr][domain] || 0) + seconds;
    FocusFlowState.hourlyData[todayStr][currentHourStr] += seconds;

    const category = getCategoryForDomain(domain); // From utils.js
    FocusFlowState.categoryTimeData[category] = (FocusFlowState.categoryTimeData[category] || 0) + seconds;
    FocusFlowState.dailyCategoryData[todayStr][category] =
      (FocusFlowState.dailyCategoryData[todayStr][category] || 0) + seconds;

    saveDataBatched(); // from storage.js
  } catch (error) {
    console.error(`[Tracking RecordTime] Error modifying state for domain ${domain}:`, error);
  }
}

// --- Core Time Tracking Logic ---
async function updateTrackingStateImplementation(triggerContext = 'unknown') {
  const now = Date.now();

  let currentDomain = null;
  let isActive = false;
  let finalDomainToRecord = null;
  let previousState = null;

  try {
    // 1. Get Idle Threshold
    let thresholdSeconds = FocusFlowState.DEFAULT_IDLE_SECONDS;
    try {
      const settings = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD);
      thresholdSeconds =
        settings[FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD] !== undefined &&
        settings[FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD] !== null
          ? parseInt(settings[FocusFlowState.STORAGE_KEY_IDLE_THRESHOLD], 10)
          : FocusFlowState.DEFAULT_IDLE_SECONDS;
      if (isNaN(thresholdSeconds)) thresholdSeconds = FocusFlowState.DEFAULT_IDLE_SECONDS;
    } catch (err) {
      console.error('[Tracking] Error fetching idle setting, using default:', err);
      thresholdSeconds = FocusFlowState.DEFAULT_IDLE_SECONDS;
    }

    // 2. Check Idle State
    let idleState = 'active';
    if (thresholdSeconds !== -1 && thresholdSeconds >= 1) {
      try {
        idleState = await browser.idle.queryState(thresholdSeconds);
      } catch (idleError) {
        console.warn('[Tracking] Error querying idle state:', idleError);
        idleState = 'active';
      }
    }

    // 3. Check Window Focus & Active Tab
    let activeTab = null;
    let focusedWindow = null;
    try {
      focusedWindow = await browser.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
      if (focusedWindow && focusedWindow.focused) {
        activeTab = focusedWindow.tabs.find((t) => t.active);
      }
    } catch (browserApiError) {
      console.warn(
        '[Tracking Check] Could not get focused window/tab (may be normal). Error:',
        browserApiError?.message
      );
    }

    // 4. Determine Activity Status & Current Domain
    if (idleState === 'active' && focusedWindow?.focused && activeTab) {
      const domain = getDomain(activeTab.url); // utils.js
      if (domain) {
        isActive = true;
        currentDomain = domain;
      } else {
        isActive = false;
      }
    } else {
      isActive = false;
    }

    // 5. Get Previous Tracking State
    try {
      const storageResult = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
      previousState = storageResult[FocusFlowState.STORAGE_KEY_TRACKING_STATE] || null;
    } catch (storageError) {
      console.error('[Tracking] Error getting previous tracking state:', storageError);
      previousState = null;
    }

    // 6. Process State Change / Update Time
    let elapsedSeconds = 0;
    if (previousState) {
      elapsedSeconds = Math.floor((now - previousState.timestamp) / 1000);
      finalDomainToRecord = previousState.domain;
    }

    // --- State Machine Logic ---
    if (isActive) {
      // ACTIVE NOW
      const newState = { timestamp: now, domain: currentDomain };
      if (previousState) {
        // PREVIOUSLY ACTIVE
        if (finalDomainToRecord && elapsedSeconds > 0) {
          recordTime(finalDomainToRecord, elapsedSeconds);
        }
        try {
          await browser.storage.local.set({ [FocusFlowState.STORAGE_KEY_TRACKING_STATE]: newState });
        } catch (storageError) {
          console.error('[Tracking] Error updating storage state (active -> active):', storageError);
        }
      } else {
        // PREVIOUSLY INACTIVE -> START TRACKING
        console.log(`[Tracking Logic] Was inactive, now ACTIVE. Storing new state:`, newState);
        try {
          await browser.storage.local.set({ [FocusFlowState.STORAGE_KEY_TRACKING_STATE]: newState });
        } catch (storageError) {
          console.error('[Tracking] Error storing initial active state:', storageError);
        }
      }
    } else {
      // INACTIVE NOW
      if (previousState) {
        // PREVIOUSLY ACTIVE -> STOP TRACKING
        if (finalDomainToRecord && elapsedSeconds > 0) {
          recordTime(finalDomainToRecord, elapsedSeconds);
        }
        try {
          await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
          console.log(`[Tracking Logic] Removed stored tracking state.`);
        } catch (storageError) {
          console.error('[Tracking] Error removing stored state (active -> inactive):', storageError);
        }
      }
      // else: PREVIOUSLY INACTIVE -> STILL INACTIVE (do nothing)
    }
  } catch (error) {
    console.error(
      `[Tracking] CRITICAL Error in updateTrackingStateImplementation (Trigger: ${triggerContext}):`,
      error
    );
    try {
      if (previousState) {
        await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
        console.error('[Tracking] Cleared potentially corrupted tracking state due to error.');
      }
    } catch (clearError) {
      console.error('[Tracking] Failed to clear tracking state during error handling:', clearError);
    }
  }
}

const updateTrackingStateDebounced = debounce(
  (context) => updateTrackingStateImplementation(context),
  FocusFlowState.UPDATE_STATE_DEBOUNCE_MS
);

// This function checks if the currently active tab should be blocked due to a time limit.
async function checkTimeLimitsAndRedirectIfNeeded() {
  const { rules, dailyDomainData, dailyCategoryData } = FocusFlowState;
  if (!rules || rules.length === 0) return; // No rules to check

  const limitRules = rules.filter((r) => r.type && r.type.startsWith('limit-'));
  if (limitRules.length === 0) return; // No limit rules to check

  let activeTab;
  try {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url) return;
    activeTab = tab;
  } catch (e) {
    // This can happen if no window is focused, which is fine.
    return;
  }

  const domain = getDomain(activeTab.url);
  if (!domain) return;

  const todayStr = getCurrentDateString();
  const todaysDomainData = dailyDomainData[todayStr] || {};
  const todaysCategoryData = dailyCategoryData[todayStr] || {};
  // Use the getCategoryForDomain from utils.js, which now uses the cache
  const category = getCategoryForDomain(domain);

  for (const rule of limitRules) {
    let timeSpentToday = 0;
    let ruleMatches = false;

    if (rule.type === 'limit-url' && urlMatchesPattern(activeTab.url, rule.value)) {
      let timeSum = 0;
      const targetValue = rule.value;
      if (targetValue.startsWith('*.')) {
        const basePattern = targetValue.substring(2);
        for (const d in todaysDomainData) {
          if (d === basePattern || d.endsWith('.' + basePattern)) {
            timeSum += todaysDomainData[d];
          }
        }
      } else {
        timeSum = todaysDomainData[targetValue] || 0;
      }
      timeSpentToday = timeSum;
      ruleMatches = true;
    } else if (rule.type === 'limit-category' && category === rule.value) {
      timeSpentToday = todaysCategoryData[rule.value] || 0;
      ruleMatches = true;
    }

    if (ruleMatches && timeSpentToday >= rule.limitSeconds) {
      console.log(`[Async Limit Check] Limit reached for ${domain}. Redirecting tab.`);
      const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');
      const params = new URLSearchParams({
        url: activeTab.url,
        reason: 'limit',
        type: rule.type,
        value: rule.value,
        limit: rule.limitSeconds.toString(),
        spent: timeSpentToday.toString(),
      });
      try {
        // Prevent redirection loop if already on the block page
        if (!activeTab.url.startsWith(blockPageBaseUrl)) {
          await browser.tabs.update(activeTab.id, { url: `${blockPageBaseUrl}?${params.toString()}` });
        }
      } catch (e) {
        console.error('Failed to redirect tab for time limit:', e);
      }
      return; // Stop checking after the first active limit is found and actioned
    }
  }
}
