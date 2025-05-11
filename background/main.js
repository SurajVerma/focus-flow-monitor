// background/main.js (v0.7.4 - Revised Pomodoro Flow & Settings)

console.log('[System] Background script MAIN entry point starting (v0.7.4 - Revised Pomodoro Flow & Settings).');

const PRUNE_ALARM_NAME = 'dailyDataPruneCheck';

// --- Pomodoro Timer Constants & Variables ---
const POMODORO_PHASES = {
  WORK: 'Work',
  SHORT_BREAK: 'Short Break',
  LONG_BREAK: 'Long Break',
};

// Default Pomodoro settings
let pomodoroSettings = {
  durations: {
    // in seconds
    [POMODORO_PHASES.WORK]: 25 * 60,
    [POMODORO_PHASES.SHORT_BREAK]: 5 * 60,
    [POMODORO_PHASES.LONG_BREAK]: 15 * 60,
  },
  sessionsBeforeLongBreak: 4,
  // autoStartBreaks: false, // No longer used for auto-starting
  // autoStartWork: false,   // No longer used for auto-starting
  notifyEnabled: true, // Default notification preference
};

// Pomodoro runtime state
let pomodoroState = {
  currentPhase: POMODORO_PHASES.WORK,
  remainingTime: pomodoroSettings.durations[POMODORO_PHASES.WORK],
  workSessionsCompleted: 0,
  timerState: 'stopped', // 'stopped', 'running', 'paused'
  timerIntervalId: null,
};

// --- Pomodoro Core Logic ---

/**
 * Sends the current Pomodoro status to any open popups.
 */
function sendPomodoroStatusToPopups() {
  if (browser.runtime && browser.runtime.sendMessage) {
    const statusPayload = {
      ...pomodoroState,
      durations: pomodoroSettings.durations, // Send current durations
      notifyEnabled: pomodoroSettings.notifyEnabled, // Send current notification setting
    };
    browser.runtime
      .sendMessage({
        action: 'pomodoroStatusUpdate',
        status: statusPayload,
      })
      .catch((err) => {
        // console.log("[Pomodoro Background] No popup to send status update to, or error:", err.message);
      });
  }
}

/**
 * Updates the browser action badge text with the current timer status.
 */
function updatePomodoroBadge() {
  let badgeText = '';
  let badgeColor = '#808080';

  if (pomodoroState.timerState === 'running') {
    const minutes = Math.floor(pomodoroState.remainingTime / 60);
    const seconds = pomodoroState.remainingTime % 60;

    if (minutes === 0 && pomodoroState.remainingTime > 0) {
      // UPDATED condition
      badgeText = '<1';
    } else if (pomodoroState.remainingTime <= 0) {
      // Should ideally not happen if timer stops correctly
      badgeText = '0';
    } else {
      badgeText = `${String(minutes)}`;
    }

    badgeColor =
      pomodoroState.currentPhase === POMODORO_PHASES.WORK
        ? '#28a745'
        : pomodoroState.currentPhase === POMODORO_PHASES.SHORT_BREAK
        ? '#fd7e14' // Use new short break color
        : '#ffc107'; // Long break color
  } else if (pomodoroState.timerState === 'paused') {
    badgeText = '❚❚';
    badgeColor = '#808080';
  } else {
    badgeText = '';
    badgeColor = '#808080';
  }

  try {
    browser.browserAction.setBadgeText({ text: badgeText });
    browser.browserAction.setBadgeBackgroundColor({ color: badgeColor });
  } catch (e) {
    console.error('Error setting badge text or color:', e);
  }
}

/**
 * Sends a system notification if enabled.
 */
function sendPomodoroNotification(phaseName, nextPhaseName) {
  if (!pomodoroSettings.notifyEnabled) {
    console.log('[Pomodoro] Notifications are disabled. Skipping notification.');
    return;
  }
  try {
    browser.notifications.create(`pomodoro-${Date.now()}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: `FocusFlow: ${phaseName} Complete!`,
      message: `Time for your ${nextPhaseName.toLowerCase()}. Click Start in the popup when ready.`,
      priority: 2,
    });
  } catch (e) {
    console.error('Error creating notification:', e);
  }
}

/**
 * Saves the current Pomodoro runtime state and settings.
 */
async function savePomodoroStateAndSettings() {
  try {
    await browser.storage.local.set({
      [FocusFlowState.STORAGE_KEY_POMODORO_STATE]: {
        currentPhase: pomodoroState.currentPhase,
        remainingTime: pomodoroState.remainingTime,
        workSessionsCompleted: pomodoroState.workSessionsCompleted,
        timerState: pomodoroState.timerState,
      },
      [FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]: {
        // Save settings as well
        durations: pomodoroSettings.durations,
        sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
        notifyEnabled: pomodoroSettings.notifyEnabled,
        // autoStartBreaks and autoStartWork could be saved here if they become configurable
      },
    });
    // console.log('[Pomodoro] State and Settings saved.');
  } catch (error) {
    console.error('[Pomodoro] Error saving state and settings:', error);
  }
}

/**
 * Loads persisted Pomodoro state and settings from storage.
 */
async function loadPomodoroStateAndSettings() {
  try {
    const result = await browser.storage.local.get([
      FocusFlowState.STORAGE_KEY_POMODORO_STATE,
      FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS,
    ]);

    if (result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]) {
      const loadedSettings = result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS];
      // Merge carefully, ensuring defaults are used if a specific setting is missing
      pomodoroSettings.durations = loadedSettings.durations || pomodoroSettings.durations;
      pomodoroSettings.sessionsBeforeLongBreak =
        loadedSettings.sessionsBeforeLongBreak || pomodoroSettings.sessionsBeforeLongBreak;
      pomodoroSettings.notifyEnabled =
        loadedSettings.notifyEnabled !== undefined ? loadedSettings.notifyEnabled : pomodoroSettings.notifyEnabled;
    }

    if (result[FocusFlowState.STORAGE_KEY_POMODORO_STATE]) {
      const persisted = result[FocusFlowState.STORAGE_KEY_POMODORO_STATE];
      pomodoroState.currentPhase = persisted.currentPhase || POMODORO_PHASES.WORK;
      // Ensure remainingTime is valid for the current (possibly loaded) phase duration
      pomodoroState.remainingTime =
        persisted.remainingTime !== undefined
          ? Math.min(persisted.remainingTime, pomodoroSettings.durations[pomodoroState.currentPhase])
          : pomodoroSettings.durations[pomodoroState.currentPhase];
      pomodoroState.workSessionsCompleted = persisted.workSessionsCompleted || 0;
      pomodoroState.timerState = persisted.timerState === 'running' ? 'paused' : persisted.timerState || 'stopped';
    } else {
      // Initialize with defaults if no persisted state
      pomodoroState.currentPhase = POMODORO_PHASES.WORK;
      pomodoroState.remainingTime = pomodoroSettings.durations[POMODORO_PHASES.WORK];
      pomodoroState.workSessionsCompleted = 0;
      pomodoroState.timerState = 'stopped';
    }
    console.log('[Pomodoro] Initial state/settings loaded/set:', pomodoroState, pomodoroSettings);
    updatePomodoroBadge();
    sendPomodoroStatusToPopups();
  } catch (error) {
    console.error('[Pomodoro] Error loading state/settings:', error);
    pomodoroState.remainingTime = pomodoroSettings.durations[pomodoroState.currentPhase]; // Fallback
    updatePomodoroBadge();
    sendPomodoroStatusToPopups();
  }
}

/**
 * Sets up a new Pomodoro phase (does not start the timer).
 */
function setupPomodoroPhase(phase, sessionsCompleted = pomodoroState.workSessionsCompleted) {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null; // Ensure interval is cleared
  pomodoroState.currentPhase = phase;
  pomodoroState.remainingTime = pomodoroSettings.durations[phase];
  pomodoroState.workSessionsCompleted = sessionsCompleted;
  pomodoroState.timerState = 'stopped';

  console.log(`[Pomodoro] Phase set up: ${phase}, Duration: ${pomodoroState.remainingTime}s`);
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings(); // Save new phase state and potentially updated settings
}

/**
 * The main tick function for the Pomodoro timer.
 */
function pomodoroTick() {
  if (pomodoroState.timerState !== 'running' || pomodoroState.remainingTime <= 0) {
    if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
    pomodoroState.timerIntervalId = null;
    // If timer stopped unexpectedly (not by reaching 0), ensure UI reflects it
    if (pomodoroState.remainingTime > 0 && pomodoroState.timerState === 'running') {
      pomodoroState.timerState = 'paused'; // Or 'stopped'
      updatePomodoroBadge();
      sendPomodoroStatusToPopups();
      savePomodoroStateAndSettings();
    }
    return;
  }

  pomodoroState.remainingTime--;
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();

  if (pomodoroState.remainingTime <= 0) {
    if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
    pomodoroState.timerIntervalId = null;
    pomodoroState.timerState = 'stopped';

    const justFinishedPhase = pomodoroState.currentPhase;
    let nextPhase;

    if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
      pomodoroState.workSessionsCompleted++;
      // TODO: Increment Pomodoro statistics for completed work session
      console.log(`[Pomodoro Stats] Work session ${pomodoroState.workSessionsCompleted} completed.`);
      nextPhase =
        pomodoroState.workSessionsCompleted % pomodoroSettings.sessionsBeforeLongBreak === 0
          ? POMODORO_PHASES.LONG_BREAK
          : POMODORO_PHASES.SHORT_BREAK;
    } else {
      nextPhase = POMODORO_PHASES.WORK;
    }
    sendPomodoroNotification(justFinishedPhase, nextPhase);
    setupPomodoroPhase(nextPhase, pomodoroState.workSessionsCompleted); // Sets up, does not auto-start
  } else {
    if (pomodoroState.remainingTime % 10 === 0) {
      savePomodoroStateAndSettings(); // Save state periodically
    }
  }
}

/**
 * Starts or resumes the Pomodoro timer.
 */
function startPomodoroTimer() {
  if (pomodoroState.timerState === 'running') return;

  pomodoroState.timerState = 'running';
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = setInterval(pomodoroTick, 1000);

  console.log('[Pomodoro] Timer started/resumed.');
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();
}

/**
 * Pauses the Pomodoro timer.
 */
function pausePomodoroTimer() {
  if (pomodoroState.timerState !== 'running') return;

  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.timerState = 'paused';

  console.log('[Pomodoro] Timer paused.');
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();
}

/**
 * Resets the Pomodoro timer.
 */
function resetPomodoroTimer(resetCycle = false) {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;

  if (resetCycle) {
    pomodoroState.workSessionsCompleted = 0;
    pomodoroState.currentPhase = POMODORO_PHASES.WORK;
  }
  pomodoroState.remainingTime = pomodoroSettings.durations[pomodoroState.currentPhase];
  pomodoroState.timerState = 'stopped';

  console.log(`[Pomodoro] Timer reset. Cycle reset: ${resetCycle}`);
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();
}

/**
 * Skips the current break phase and sets up the next work phase (does not auto-start).
 */
function skipPomodoroPhase() {
  if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
    console.log('[Pomodoro] Cannot skip Work phase.');
    return;
  }
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;

  console.log(`[Pomodoro] Skipping ${pomodoroState.currentPhase}. Setting up Work phase.`);
  setupPomodoroPhase(POMODORO_PHASES.WORK, pomodoroState.workSessionsCompleted);
  // Timer is now 'stopped' for the new Work phase, user needs to click Start.
}

/**
 * Changes to the next logical Pomodoro phase and stops the timer.
 */
function changeToNextPomodoroPhase() {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.timerState = 'stopped'; // Always stop timer when manually changing phase

  let nextPhase;
  let sessions = pomodoroState.workSessionsCompleted;

  switch (pomodoroState.currentPhase) {
    case POMODORO_PHASES.WORK:
      // This logic implies a work session was "completed" by changing phase,
      // or we just cycle through. For simplicity, let's assume user wants to pick next.
      // A more strict Pomodoro might increment workSessionsCompleted only if timer ran down.
      // For now, let's just cycle.
      nextPhase = POMODORO_PHASES.SHORT_BREAK;
      break;
    case POMODORO_PHASES.SHORT_BREAK:
      nextPhase = POMODORO_PHASES.LONG_BREAK;
      break;
    case POMODORO_PHASES.LONG_BREAK:
      nextPhase = POMODORO_PHASES.WORK;
      sessions = 0; // Reset session count if coming from long break
      break;
    default:
      nextPhase = POMODORO_PHASES.WORK;
      sessions = 0;
  }
  console.log(`[Pomodoro] Manually changing phase from ${pomodoroState.currentPhase} to ${nextPhase}`);
  setupPomodoroPhase(nextPhase, sessions);
}

// --- Initialize Alarms --- (no changes from previous version)
async function setupAlarms() {
  try {
    const trackAlarm = await browser.alarms.get(FocusFlowState.ALARM_NAME);
    if (!trackAlarm || trackAlarm.periodInMinutes !== FocusFlowState.ALARM_PERIOD_MINUTES) {
      browser.alarms.create(FocusFlowState.ALARM_NAME, { periodInMinutes: FocusFlowState.ALARM_PERIOD_MINUTES });
      console.log(`[Alarm] ${trackAlarm ? 'Recreated' : 'Created'} tracking alarm: ${FocusFlowState.ALARM_NAME}`);
    }

    const pruneAlarm = await browser.alarms.get(PRUNE_ALARM_NAME);
    const dailyPeriod = 1440;
    if (!pruneAlarm) {
      browser.alarms.create(PRUNE_ALARM_NAME, { delayInMinutes: 15, periodInMinutes: dailyPeriod });
      console.log(`[Alarm] Created pruning alarm: ${PRUNE_ALARM_NAME} (runs daily, first run in ~15min)`);
    } else if (pruneAlarm.periodInMinutes !== dailyPeriod) {
      browser.alarms.clear(PRUNE_ALARM_NAME);
      browser.alarms.create(PRUNE_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: dailyPeriod });
      console.log(`[Alarm] Recreated pruning alarm with correct period: ${PRUNE_ALARM_NAME}`);
    }
  } catch (error) {
    console.error('[Alarm] Error setting up alarms:', error);
  }
}

// --- Event Listeners --- (no changes from previous version)
browser.tabs.onActivated.addListener(() => {
  updateTrackingStateDebounced('tabs.onActivated'); // from tracking.js
});
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url && getDomain(tab.url)) {
    // getDomain from utils.js
    browser.windows
      .getLastFocused({ populate: true, windowTypes: ['normal'] })
      .then((currentWindow) => {
        if (currentWindow && currentWindow.focused) {
          const activeTab = currentWindow.tabs.find((t) => t.active);
          if (activeTab && activeTab.id === tabId) {
            updateTrackingStateDebounced('tabs.onUpdated (complete)');
          }
        }
      })
      .catch((e) => {
        /* Ignore */
      });
  }
});
browser.windows.onFocusChanged.addListener(() => {
  updateTrackingStateDebounced('windows.onFocusChanged');
});
browser.idle.onStateChanged.addListener((newState) => {
  updateTrackingStateDebounced(`idle.onStateChanged (${newState})`);
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FocusFlowState.ALARM_NAME) {
    await updateTrackingStateImplementation(FocusFlowState.ALARM_NAME); // from tracking.js
  } else if (alarm.name === PRUNE_ALARM_NAME) {
    console.log(`[Alarm] Triggered: ${PRUNE_ALARM_NAME}`);
    await pruneOldData(); // from storage.js
  }
});

// --- Message Listener ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
    console.log(`[System] Reloading config data due to ${request.action} message.`);
    loadData() // from storage.js
      .then(() => {
        sendResponse({ success: true, message: 'Config data reloaded.' });
      })
      .catch((err) => {
        console.error(`[System] Error reloading data on message:`, err);
        sendResponse({ success: false, message: 'Error reloading config.' });
      });
    return true;
  } else if (request.action === 'importedData') {
    console.log(`[System] Reloading ALL data due to data import.`);
    loadData()
      .then(() => {
        console.log('[System] Background state reloaded after import.');
        return loadPomodoroStateAndSettings(); // Also reload Pomodoro state
      })
      .then(() => {
        sendResponse({ success: true, message: 'Background state reloaded after import.' });
      })
      .catch((err) => {
        console.error(`[System] Error reloading background state after import:`, err);
        sendResponse({ success: false, message: 'Error reloading background state.' });
      });
    return true;
  }
  // --- Pomodoro Message Handlers ---
  else if (request.action === 'getPomodoroStatus') {
    sendResponse({
      ...pomodoroState,
      durations: pomodoroSettings.durations,
      notifyEnabled: pomodoroSettings.notifyEnabled,
    });
    return false;
  } else if (request.action === 'startPomodoro') {
    startPomodoroTimer();
    sendResponse({ success: true });
    return false;
  } else if (request.action === 'pausePomodoro') {
    pausePomodoroTimer();
    sendResponse({ success: true });
    return false;
  } else if (request.action === 'resetPomodoro') {
    resetPomodoroTimer(request.resetCycle || false);
    sendResponse({ success: true });
    return false;
  } else if (request.action === 'skipPomodoro') {
    skipPomodoroPhase();
    sendResponse({ success: true });
    return false;
  }
  // NEW: Handler for changing phase
  else if (request.action === 'changePomodoroPhase') {
    changeToNextPomodoroPhase();
    sendResponse({ success: true });
    return false;
  }
  // NEW: Handler for updating notification setting
  else if (request.action === 'updatePomodoroNotificationSetting') {
    if (request.enabled !== undefined) {
      pomodoroSettings.notifyEnabled = !!request.enabled; // Ensure boolean
      savePomodoroStateAndSettings(); // Save the updated settings
      sendPomodoroStatusToPopups(); // Notify popups of the change
      console.log(`[Pomodoro] Notification setting updated to: ${pomodoroSettings.notifyEnabled}`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Missing 'enabled' parameter." });
    }
    return false;
  }
  // --- END Pomodoro Message Handlers ---
  return false;
});

// --- Initialization Flow ---
async function initializeExtension() {
  await loadData();
  await loadPomodoroStateAndSettings();
  await setupAlarms();

  try {
    if (
      browser.webRequest &&
      browser.webRequest.onBeforeRequest &&
      !browser.webRequest.onBeforeRequest.hasListener(handleBlockingRequest) // from blocking.js
    ) {
      browser.webRequest.onBeforeRequest.addListener(
        handleBlockingRequest,
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

console.log('[System] background/main.js loaded (v0.7.4 - Revised Pomodoro Flow & Settings)');
