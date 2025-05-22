const PRUNE_ALARM_NAME = 'dailyDataPruneCheck'; // Used for the daily data pruning alarm

// --- Pomodoro Timer Constants & Variables ---
const POMODORO_PHASES = { WORK: 'Work', SHORT_BREAK: 'Short Break', LONG_BREAK: 'Long Break' };

let pomodoroSettings = {
  durations: {
    [POMODORO_PHASES.WORK]: 25 * 60,
    [POMODORO_PHASES.SHORT_BREAK]: 5 * 60,
    [POMODORO_PHASES.LONG_BREAK]: 15 * 60,
  },
  sessionsBeforeLongBreak: 4,
  notifyEnabled: true, // User's *intent* - will be reconciled with actual permission
};

let pomodoroState = {
  currentPhase: POMODORO_PHASES.WORK,
  remainingTime: pomodoroSettings.durations[POMODORO_PHASES.WORK],
  workSessionsCompleted: 0,
  timerState: 'stopped',
  timerIntervalId: null,
};

// --- Pomodoro Core Logic ---

/**
 * Sends the current Pomodoro status to any open popups.
 * It now reconciles notifyEnabled with actual permission before sending.
 */
async function sendPomodoroStatusToPopups() {
  if (browser.runtime && browser.runtime.sendMessage) {
    // Reconcile notifyEnabled before sending
    let notifyStateChanged = false;
    if (pomodoroSettings.notifyEnabled) {
      try {
        const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
        if (!hasPermission) {
          console.log(
            '[Pomodoro Background] sendPomodoroStatusToPopups: notifyEnabled was true, but permission missing. Updating to false.'
          );
          pomodoroSettings.notifyEnabled = false;
          notifyStateChanged = true;
        }
      } catch (err) {
        console.error('[Pomodoro Background] sendPomodoroStatusToPopups: Error checking notification permission:', err);
        if (pomodoroSettings.notifyEnabled) {
          pomodoroSettings.notifyEnabled = false; // Assume no permission on error
          notifyStateChanged = true;
        }
      }
    }

    if (notifyStateChanged) {
      await savePomodoroStateAndSettings();
    }

    const statusPayload = {
      ...pomodoroState,
      durations: pomodoroSettings.durations,
      notifyEnabled: pomodoroSettings.notifyEnabled,
    };
    browser.runtime
      .sendMessage({
        action: 'pomodoroStatusUpdate',
        status: statusPayload,
      })
      .catch((err) => {
        // This error is common if no popup is open, so often benign.
      });
  }
}

function updatePomodoroBadge() {
  let badgeText = '';
  let badgeColor = '#808080'; // Default grey

  if (pomodoroState.timerState === 'running') {
    const minutes = Math.floor(pomodoroState.remainingTime / 60);
    badgeText = minutes > 0 ? `${String(minutes)}` : pomodoroState.remainingTime > 0 ? '<1' : '0';
    badgeColor =
      pomodoroState.currentPhase === POMODORO_PHASES.WORK
        ? '#28a745' // Green for work
        : pomodoroState.currentPhase === POMODORO_PHASES.SHORT_BREAK
        ? '#fd7e14' // Orange for short break
        : '#ffc107'; // Yellow for long break
  } else if (pomodoroState.timerState === 'paused') {
    badgeText = '❚❚'; // Pause symbol
    badgeColor = '#808080'; // Grey for paused
  }

  try {
    browser.browserAction.setBadgeText({ text: badgeText });
    browser.browserAction.setBadgeBackgroundColor({ color: badgeColor });
  } catch (e) {
    console.error('[Pomodoro] Error setting badge text or color:', e);
  }
}

async function sendPomodoroNotification(phaseName, nextPhaseName) {
  if (!pomodoroSettings.notifyEnabled) {
    console.log('[Pomodoro] Notifications are disabled by user setting (notifyEnabled=false). Skipping notification.');
    return;
  }

  try {
    const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
    if (!hasPermission) {
      console.log('[Pomodoro] Notification permission not granted. Skipping notification and updating setting.');
      if (pomodoroSettings.notifyEnabled) {
        pomodoroSettings.notifyEnabled = false;
        await savePomodoroStateAndSettings();
        sendPomodoroStatusToPopups();
      }
      return;
    }

    browser.notifications.create(`pomodoro-${Date.now()}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: `FocusFlow: ${phaseName} Complete!`,
      message: `Time for your ${nextPhaseName.toLowerCase()}. Click Start in the popup when ready.`,
      priority: 2,
    });
    console.log(`[Pomodoro] Notification sent for ${phaseName} completion.`);
  } catch (e) {
    console.error('[Pomodoro] Error creating notification:', e);
  }
}

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
        durations: pomodoroSettings.durations,
        sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
        notifyEnabled: pomodoroSettings.notifyEnabled,
      },
    });
  } catch (error) {
    console.error('[Pomodoro] Error saving state and settings:', error);
  }
}

async function loadPomodoroStateAndSettings() {
  try {
    const result = await browser.storage.local.get([
      FocusFlowState.STORAGE_KEY_POMODORO_STATE,
      FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS,
    ]);

    if (result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]) {
      const loadedSettings = result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS];
      pomodoroSettings.durations = loadedSettings.durations || pomodoroSettings.durations;
      pomodoroSettings.sessionsBeforeLongBreak =
        loadedSettings.sessionsBeforeLongBreak || pomodoroSettings.sessionsBeforeLongBreak;
      pomodoroSettings.notifyEnabled = loadedSettings.notifyEnabled !== undefined ? loadedSettings.notifyEnabled : true;
    } else {
      pomodoroSettings.notifyEnabled = true;
    }

    if (result[FocusFlowState.STORAGE_KEY_POMODORO_STATE]) {
      const persisted = result[FocusFlowState.STORAGE_KEY_POMODORO_STATE];
      pomodoroState.currentPhase = persisted.currentPhase || POMODORO_PHASES.WORK;
      const currentPhaseDuration = pomodoroSettings.durations[pomodoroState.currentPhase] || 25 * 60;
      pomodoroState.remainingTime =
        persisted.remainingTime !== undefined
          ? Math.min(persisted.remainingTime, currentPhaseDuration)
          : currentPhaseDuration;
      pomodoroState.workSessionsCompleted = persisted.workSessionsCompleted || 0;
      pomodoroState.timerState = persisted.timerState === 'running' ? 'paused' : persisted.timerState || 'stopped';
    } else {
      pomodoroState.currentPhase = POMODORO_PHASES.WORK;
      pomodoroState.remainingTime = pomodoroSettings.durations[POMODORO_PHASES.WORK];
      pomodoroState.workSessionsCompleted = 0;
      pomodoroState.timerState = 'stopped';
    }

    let settingsChangedOnLoad = false;
    if (pomodoroSettings.notifyEnabled) {
      const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
      if (!hasPermission) {
        console.warn('[Pomodoro Load] notifyEnabled was true in storage, but permission is missing. Setting to false.');
        pomodoroSettings.notifyEnabled = false;
        settingsChangedOnLoad = true;
      }
    }

    if (settingsChangedOnLoad) {
      await savePomodoroStateAndSettings();
    }

    console.log('[Pomodoro] Initial state/settings loaded/set:', pomodoroState, pomodoroSettings);
    updatePomodoroBadge();
    sendPomodoroStatusToPopups();
  } catch (error) {
    console.error('[Pomodoro] Error loading state/settings:', error);
    pomodoroSettings.notifyEnabled = true;
    pomodoroState.remainingTime = pomodoroSettings.durations[pomodoroState.currentPhase] || 25 * 60;
    updatePomodoroBadge();
    sendPomodoroStatusToPopups();
  }
}

function setupPomodoroPhase(phase, sessionsCompleted = pomodoroState.workSessionsCompleted) {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.currentPhase = phase;
  pomodoroState.remainingTime = pomodoroSettings.durations[phase];
  pomodoroState.workSessionsCompleted = sessionsCompleted;
  pomodoroState.timerState = 'stopped';

  console.log(
    `[Pomodoro] Phase set up: ${phase}, Duration: ${pomodoroState.remainingTime}s, Sessions Completed: ${sessionsCompleted}`
  );
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();
}

function pomodoroTick() {
  if (pomodoroState.timerState !== 'running' || pomodoroState.remainingTime <= 0) {
    if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
    pomodoroState.timerIntervalId = null;
    if (pomodoroState.remainingTime > 0 && pomodoroState.timerState === 'running') {
      pomodoroState.timerState = 'paused';
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
    let sessions = pomodoroState.workSessionsCompleted;

    if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
      sessions++;
      console.log(`[Pomodoro Stats] Work session ${sessions} completed.`);
      nextPhase =
        sessions % pomodoroSettings.sessionsBeforeLongBreak === 0
          ? POMODORO_PHASES.LONG_BREAK
          : POMODORO_PHASES.SHORT_BREAK;
    } else {
      nextPhase = POMODORO_PHASES.WORK;
      if (justFinishedPhase === POMODORO_PHASES.LONG_BREAK) {
        sessions = 0;
      }
    }
    sendPomodoroNotification(justFinishedPhase, nextPhase);
    setupPomodoroPhase(nextPhase, sessions);
  } else {
    if (pomodoroState.remainingTime % 10 === 0) {
      savePomodoroStateAndSettings();
    }
  }
}

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

function resetPomodoroTimer(resetCycle = false) {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;

  let sessionsToSet = pomodoroState.workSessionsCompleted;
  if (resetCycle) {
    sessionsToSet = 0;
    pomodoroState.currentPhase = POMODORO_PHASES.WORK;
  }
  pomodoroState.remainingTime = pomodoroSettings.durations[pomodoroState.currentPhase];
  pomodoroState.timerState = 'stopped';
  pomodoroState.workSessionsCompleted = sessionsToSet;

  console.log(
    `[Pomodoro] Timer reset. Cycle reset: ${resetCycle}. Sessions now: ${pomodoroState.workSessionsCompleted}`
  );
  updatePomodoroBadge();
  sendPomodoroStatusToPopups();
  savePomodoroStateAndSettings();
}

function skipPomodoroPhase() {
  if (pomodoroState.currentPhase === POMODORO_PHASES.WORK) {
    console.log('[Pomodoro] Cannot skip Work phase. Use "Switch Timer" or let it complete.');
    return;
  }
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;

  console.log(`[Pomodoro] Skipping ${pomodoroState.currentPhase}. Setting up Work phase.`);
  setupPomodoroPhase(POMODORO_PHASES.WORK, pomodoroState.workSessionsCompleted);
}

/**
 * Changes to the next logical Pomodoro phase and stops the timer.
 * User will need to manually start the new phase.
 * This implements a fixed cycle: Work -> Short Break -> Long Break -> Work.
 */
function changeToNextPomodoroPhase() {
  if (pomodoroState.timerIntervalId) clearInterval(pomodoroState.timerIntervalId);
  pomodoroState.timerIntervalId = null;
  pomodoroState.timerState = 'stopped';

  let nextPhase;
  let sessions = pomodoroState.workSessionsCompleted;

  switch (pomodoroState.currentPhase) {
    case POMODORO_PHASES.WORK:
      nextPhase = POMODORO_PHASES.SHORT_BREAK;
      break;
    case POMODORO_PHASES.SHORT_BREAK:
      nextPhase = POMODORO_PHASES.LONG_BREAK;
      break;
    case POMODORO_PHASES.LONG_BREAK:
      nextPhase = POMODORO_PHASES.WORK;
      sessions = 0;
      break;
    default:
      console.warn(`[Pomodoro] Unknown current phase: ${pomodoroState.currentPhase}. Defaulting to WORK.`);
      nextPhase = POMODORO_PHASES.WORK;
      sessions = 0;
  }
  console.log(
    `[Pomodoro] Manually changing phase from ${pomodoroState.currentPhase} to ${nextPhase}. Sessions to be set: ${sessions}`
  );
  setupPomodoroPhase(nextPhase, sessions);
}

// --- Initialize Alarms ---
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

// --- Event Listeners ---
browser.tabs.onActivated.addListener(() => {
  updateTrackingStateDebounced('tabs.onActivated');
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
        // Benign in many cases
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
  (async () => {
    if (request.action === 'categoriesUpdated' || request.action === 'rulesUpdated') {
      console.log(`[System Background] Reloading config data due to ${request.action} message.`);
      try {
        await loadData(); // from storage.js
        sendResponse({ success: true, message: 'Config data reloaded.' });
      } catch (err) {
        console.error(`[System Background] Error reloading data on message:`, err);
        sendResponse({ success: false, message: 'Error reloading config.' });
      }
    } else if (request.action === 'importedData') {
      console.log(`[System Background] Reloading ALL data due to data import.`);
      try {
        await loadData(); // from storage.js
        console.log('[System Background] Background state reloaded after import.');
        await loadPomodoroStateAndSettings(); // Also reload Pomodoro state
        sendResponse({ success: true, message: 'Background state reloaded after import.' });
      } catch (err) {
        console.error(`[System Background] Error reloading background state after import:`, err);
        sendResponse({ success: false, message: 'Error reloading background state.' });
      }
    }
    // --- Pomodoro Message Handlers ---
    else if (request.action === 'pomodoroSettingsChanged') {
      console.log(`[System Background] Received pomodoroSettingsChanged. Reloading settings from storage.`);
      try {
        const result = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS);
        if (result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS]) {
          const loadedSettings = result[FocusFlowState.STORAGE_KEY_POMODORO_SETTINGS];
          const defaultDurations = {
            [POMODORO_PHASES.WORK]: 25 * 60,
            [POMODORO_PHASES.SHORT_BREAK]: 5 * 60,
            [POMODORO_PHASES.LONG_BREAK]: 15 * 60,
          };
          const defaultSessions = 4;

          pomodoroSettings.durations = loadedSettings.durations || pomodoroSettings.durations || defaultDurations;
          pomodoroSettings.sessionsBeforeLongBreak =
            loadedSettings.sessionsBeforeLongBreak || pomodoroSettings.sessionsBeforeLongBreak || defaultSessions;
          pomodoroSettings.notifyEnabled =
            loadedSettings.notifyEnabled !== undefined ? loadedSettings.notifyEnabled : true;

          console.log(`[Pomodoro Background] Reloaded notifyEnabled from storage: ${pomodoroSettings.notifyEnabled}`);
        } else {
          pomodoroSettings.notifyEnabled = true;
          console.warn(
            `[Pomodoro Background] No pomodoroUserSettings found in storage on 'pomodoroSettingsChanged'. Defaulting notifyEnabled to true.`
          );
        }
        await sendPomodoroStatusToPopups();
        sendResponse({ success: true, message: 'Background acknowledged and reloaded Pomodoro settings.' });
      } catch (err) {
        console.error(`[System Background] Error reloading pomodoro settings in background:`, err);
        sendResponse({ success: false, message: 'Error reloading pomodoro settings in background.' });
      }
    } else if (request.action === 'getPomodoroStatus') {
      let currentNotifyEnabled = pomodoroSettings.notifyEnabled;
      let settingChangedInStorage = false;
      if (currentNotifyEnabled) {
        try {
          const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
          if (!hasPermission) {
            console.log(
              '[Pomodoro Background] getPomodoroStatus: notifyEnabled was true, but permission missing. Updating to false.'
            );
            pomodoroSettings.notifyEnabled = false;
            currentNotifyEnabled = false;
            settingChangedInStorage = true;
          }
        } catch (err) {
          console.error('[Pomodoro Background] getPomodoroStatus: Error checking notification permission:', err);
          if (pomodoroSettings.notifyEnabled) {
            pomodoroSettings.notifyEnabled = false;
            currentNotifyEnabled = false;
            settingChangedInStorage = true;
          }
        }
      }
      if (settingChangedInStorage) {
        await savePomodoroStateAndSettings();
      }
      sendResponse({
        ...pomodoroState,
        durations: pomodoroSettings.durations,
        notifyEnabled: currentNotifyEnabled,
      });
    } else if (request.action === 'startPomodoro') {
      startPomodoroTimer();
      sendResponse({ success: true });
    } else if (request.action === 'pausePomodoro') {
      pausePomodoroTimer();
      sendResponse({ success: true });
    } else if (request.action === 'resetPomodoro') {
      resetPomodoroTimer(request.resetCycle || false);
      sendResponse({ success: true });
    } else if (request.action === 'skipPomodoro') {
      skipPomodoroPhase();
      sendResponse({ success: true });
    } else if (request.action === 'changePomodoroPhase') {
      changeToNextPomodoroPhase();
      sendResponse({ success: true });
    } else if (request.action === 'updatePomodoroNotificationSetting') {
      if (request.enabled !== undefined) {
        const userIntentEnabled = !!request.enabled;
        let finalNotifyEnabledState = userIntentEnabled;
        let settingActuallyChanged = false;

        if (userIntentEnabled) {
          try {
            const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
            if (!hasPermission) {
              console.warn(
                '[Pomodoro Background] Popup requested to enable notifications, but permission is missing. Overriding intent: Forcing disabled.'
              );
              finalNotifyEnabledState = false;
            }
          } catch (err) {
            console.error(
              '[Pomodoro Background] Error checking notification permission during update from popup:',
              err
            );
            finalNotifyEnabledState = false;
          }
        }

        if (pomodoroSettings.notifyEnabled !== finalNotifyEnabledState) {
          pomodoroSettings.notifyEnabled = finalNotifyEnabledState;
          settingActuallyChanged = true;
        }

        if (settingActuallyChanged) {
          await savePomodoroStateAndSettings();
        }
        await sendPomodoroStatusToPopups();
        console.log(
          `[Pomodoro Background] Popup update. User intent: ${userIntentEnabled}, Actual setting in background: ${pomodoroSettings.notifyEnabled}`
        );
        sendResponse({ success: true, actualState: pomodoroSettings.notifyEnabled });
      } else {
        sendResponse({ success: false, error: "Missing 'enabled' parameter." });
      }
    }
  })();
  return true;
});

// --- Initialization Flow ---
async function initializeExtension() {
  await loadData(); // from storage.js
  await loadPomodoroStateAndSettings();
  await setupAlarms();

  try {
    if (
      browser.webRequest &&
      browser.webRequest.onBeforeRequest &&
      !browser.webRequest.onBeforeRequest.hasListener(handleBlockingRequest) // handleBlockingRequest from blocking.js
    ) {
      browser.webRequest.onBeforeRequest.addListener(
        handleBlockingRequest, // from blocking.js
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['blocking']
      );
      console.log('[System] Request listener for blocking registered.');
    } else if (browser.webRequest?.onBeforeRequest?.hasListener(handleBlockingRequest)) {
      console.log('[System] Request listener for blocking already registered.');
    } else {
      console.error('[System] browser.webRequest API not available for blocking. Blocking feature will not work.');
    }
  } catch (error) {
    console.error('[System] CRITICAL: Failed to register request listener for blocking.', error);
  }

  console.log('[System] Background script initialization complete.');
}

initializeExtension();
