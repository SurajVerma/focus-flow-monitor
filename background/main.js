// background/main.js (v0.7.2 - Add Pruning Alarm)
// Main entry point for the background script

console.log('[System] Background script MAIN entry point starting (v0.7.2).');

// *** ADDED: Alarm name for pruning task ***
const PRUNE_ALARM_NAME = 'dailyDataPruneCheck';

// --- Initialize Alarms ---
async function setupAlarms() {
  // Renamed to setupAlarms
  try {
    // Tracking state check alarm (existing)
    const trackAlarm = await browser.alarms.get(FocusFlowState.ALARM_NAME);
    if (!trackAlarm || trackAlarm.periodInMinutes !== FocusFlowState.ALARM_PERIOD_MINUTES) {
      browser.alarms.create(FocusFlowState.ALARM_NAME, { periodInMinutes: FocusFlowState.ALARM_PERIOD_MINUTES });
      console.log(`[Alarm] ${trackAlarm ? 'Recreated' : 'Created'} tracking alarm: ${FocusFlowState.ALARM_NAME}`);
    }

    // *** ADDED: Pruning alarm (daily) ***
    const pruneAlarm = await browser.alarms.get(PRUNE_ALARM_NAME);
    const dailyPeriod = 1440; // 60 minutes * 24 hours
    // Create or update if period is incorrect. Delay slightly on creation to avoid running immediately at browser start.
    if (!pruneAlarm) {
      browser.alarms.create(PRUNE_ALARM_NAME, { delayInMinutes: 15, periodInMinutes: dailyPeriod });
      console.log(`[Alarm] Created pruning alarm: ${PRUNE_ALARM_NAME} (runs daily, first run in ~15min)`);
    } else if (pruneAlarm.periodInMinutes !== dailyPeriod) {
      browser.alarms.clear(PRUNE_ALARM_NAME);
      browser.alarms.create(PRUNE_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: dailyPeriod }); // Shorter delay if just correcting period
      console.log(`[Alarm] Recreated pruning alarm with correct period: ${PRUNE_ALARM_NAME}`);
    }
    // *** END ADDED ***
  } catch (error) {
    console.error('[Alarm] Error setting up alarms:', error);
  }
}

// --- Event Listeners ---
// (Existing listeners for tabs, windows, idle remain the same)
browser.tabs.onActivated.addListener(() => {
  updateTrackingStateDebounced('tabs.onActivated');
});
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    browser.windows
      .getLastFocused({ populate: true, windowTypes: ['normal'] })
      .then((currentWindow) => {
        if (currentWindow && currentWindow.focused) {
          const activeTab = currentWindow.tabs.find((t) => t.active);
          if (activeTab && activeTab.id === tabId) {
            updateTrackingStateDebounced('tabs.onUpdated');
          }
        }
      })
      .catch((e) => {
        /* Ignore errors, likely no window focused */
      });
  }
});
browser.windows.onFocusChanged.addListener(() => {
  updateTrackingStateDebounced('windows.onFocusChanged');
});
browser.idle.onStateChanged.addListener((newState) => {
  updateTrackingStateDebounced(`idle.onStateChanged (${newState})`);
});

// --- Modified Alarm Listener ---
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FocusFlowState.ALARM_NAME) {
    // Existing tracking check
    await updateTrackingStateImplementation(FocusFlowState.ALARM_NAME);
  }
  // *** ADDED: Handle pruning alarm ***
  else if (alarm.name === PRUNE_ALARM_NAME) {
    console.log(`[Alarm] Triggered: ${PRUNE_ALARM_NAME}`);
    await pruneOldData(); // Call the pruning function from storage.js
  }
  // *** END ADDED ***
});

// --- Message Listener --- (remains the same)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
    console.log(`[System] Reloading config data due to ${request.action} message.`);
    loadData()
      .then(() => {
        // Load data now also runs initial prune check
        sendResponse({ success: true, message: 'Config data reloaded.' });
      })
      .catch((err) => {
        console.error(`[System] Error reloading data on message:`, err);
        sendResponse({ success: false, message: 'Error reloading config.' });
      });
    return true; // Indicates asynchronous response
  }
  // Optional: Add listener for manual pruning check from options?
  // else if (request.action === 'checkPruning') {
  //     console.log("[System] Manual prune check requested.");
  //     pruneOldData().then(() => sendResponse({success: true}));
  //     return true;
  // }
  return false; // No async response for other messages
});

// --- Initialization Flow ---
async function initializeExtension() {
  // loadData now includes an initial prune check
  await loadData(); // from storage.js

  // Setup both alarms
  await setupAlarms();

  // Register blocking listener (remains the same)
  try {
    if (
      browser.webRequest &&
      browser.webRequest.onBeforeRequest &&
      !browser.webRequest.onBeforeRequest.hasListener(handleBlockingRequest)
    ) {
      browser.webRequest.onBeforeRequest.addListener(
        handleBlockingRequest, // from blocking.js
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['blocking']
      );
      console.log('[System] Request listener registered.');
    } else if (browser.webRequest?.onBeforeRequest?.hasListener(handleBlockingRequest)) {
      console.log('[System] Request listener already registered.');
    } else {
      console.error('[System] browser.webRequest API not available for blocking.');
    }
  } catch (error) {
    console.error('[System] CRITICAL: Failed to register request listener.', error);
  }

  console.log('[System] Background script initialization complete.');
}

// Start Initialization
initializeExtension();

console.log('[System] background/main.js loaded');
