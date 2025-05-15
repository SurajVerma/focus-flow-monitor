// popup.js (v9.24 - Scroll to Options & Refined Logic)

// --- Global Chart Instance ---
let hourlyChartInstance = null;
// --- Interval ID for live popup updates ---
let popupUpdateIntervalId = null;

// --- Chart Rendering Function ---
function renderHourlyChart(canvasCtx, hourlyDataToday) {
  // Ensure Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library is not loaded or available!');
    if (canvasCtx && canvasCtx.canvas) {
      canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
      canvasCtx.font = '12px sans-serif';
      canvasCtx.fillStyle = '#aaa';
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText('Chart library missing!', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    }
    return;
  }

  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
    hourlyChartInstance = null;
  }

  const labels = [];
  const data = [];
  let maxTime = 0;

  for (let i = 0; i < 24; i++) {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    labels.push(`${hour}${ampm}`);
    const hourStr = i.toString().padStart(2, '0');
    const seconds = hourlyDataToday[hourStr] || 0;
    data.push(seconds);
    if (seconds > maxTime) {
      maxTime = seconds;
    }
  }

  if (maxTime <= 0 && canvasCtx && canvasCtx.canvas) {
    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    canvasCtx.font = '12px sans-serif';
    canvasCtx.fillStyle = '#aaa';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('No hourly usage data for today.', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    return;
  }

  try {
    hourlyChartInstance = new Chart(canvasCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Time Spent',
            data: data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.9,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            displayColors: false,
            callbacks: {
              title: function (context) {
                return context[0]?.label || '';
              },
              label: function (context) {
                const seconds = context.parsed.y || 0;
                return `Time: ${typeof formatTime === 'function' ? formatTime(seconds, true) : seconds + 's'}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxTime * 1.1,
            ticks: {
              callback: function (value) {
                return typeof formatTime === 'function' ? formatTime(value, false) : value;
              },
              maxTicksLimit: 4,
              font: { size: 10 },
            },
            grid: { drawTicks: false, border: { display: false } },
          },
          x: {
            ticks: {
              font: { size: 9 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
            grid: { display: false, drawTicks: false, border: { display: false } },
          },
        },
      },
    });
  } catch (chartError) {
    console.error('Error creating hourly chart:', chartError);
    if (canvasCtx && canvasCtx.canvas) {
      canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
      canvasCtx.font = '12px sans-serif';
      canvasCtx.fillStyle = '#aaa';
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText('Error rendering chart.', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    }
  }
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const totalTimeEl = document.getElementById('totalTimeToday');
  const dateEl = document.getElementById('currentDate');
  const summaryEl = document.getElementById('todaySummary');
  const progressBarEl = document.getElementById('categoryProgressBar');
  const optionsBtn = document.getElementById('optionsBtn');
  const hourlyChartCanvas = document.getElementById('hourlyChartCanvas');
  const focusScoreEl = document.getElementById('focusScoreToday');
  let hourlyChartCtx = null;

  const pomodoroPhaseEl = document.getElementById('pomodoro-phase');
  const pomodoroTimeEl = document.getElementById('pomodoro-time');
  const pomodoroStartPauseBtn = document.getElementById('pomodoro-start-pause-btn');
  const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
  const pomodoroStatusMessageEl = document.getElementById('pomodoro-status-message');
  const pomodoroChangePhaseBtn = document.getElementById('pomodoro-change-phase-btn');

  const pomodoroNotifyToggleBtn = document.getElementById('pomodoro-notify-toggle');
  const pomodoroNotifyIcon = document.getElementById('pomodoro-notify-icon');

  const customConfirmModalEl = document.getElementById('custom-confirm-modal');
  const customConfirmMessageEl = document.getElementById('custom-confirm-message');
  const customConfirmYesBtn = document.getElementById('custom-confirm-yes-btn');
  const customConfirmNoBtn = document.getElementById('custom-confirm-no-btn');
  let confirmYesCallback = null;
  let confirmNoCallback = null;

  if (hourlyChartCanvas) {
    try {
      hourlyChartCtx = hourlyChartCanvas.getContext('2d');
      if (!hourlyChartCtx) throw new Error('Canvas 2D context not supported or missing.');
    } catch (e) {
      console.error('Failed to get canvas context:', e);
      const chartWrapper = document.querySelector('.chart-wrapper');
      if (chartWrapper)
        chartWrapper.innerHTML =
          "<p style='color: red; font-size: small; text-align: center;'>Could not initialize chart canvas.</p>";
    }
  }

  if (dateEl) {
    const today = new Date();
    const displayOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
      dateEl.textContent =
        typeof formatDisplayDate === 'function'
          ? formatDisplayDate(today.toISOString().split('T')[0])
          : today.toLocaleDateString(navigator.language || 'en-US', displayOptions);
    } catch (e) {
      console.warn('Could not format date using browser locale, using default.', e);
      dateEl.textContent = today.toDateString();
    }
  }

  const dateStringFetcher =
    typeof getCurrentDateString === 'function'
      ? getCurrentDateString
      : () => new Date().toISOString().split('T')[0].replace(/-/g, '-');
  const todayStr = dateStringFetcher();

  browser.storage.local
    .get(['dailyDomainData', 'dailyCategoryData', 'hourlyData', 'categoryProductivityRatings'])
    .then((result) => {
      const todaysCategoryData = result.dailyCategoryData?.[todayStr] || {};
      const todaysDomainData = result.dailyDomainData?.[todayStr] || {};
      const todaysHourlyData = result.hourlyData?.[todayStr] || {};
      const userRatings = result.categoryProductivityRatings || {};
      let totalSecondsToday = 0;

      if (todaysDomainData && Object.keys(todaysDomainData).length > 0) {
        totalSecondsToday = Object.values(todaysDomainData).reduce((sum, time) => sum + time, 0);
      } else if (todaysCategoryData && Object.keys(todaysCategoryData).length > 0) {
        totalSecondsToday = Object.values(todaysCategoryData).reduce((sum, time) => sum + time, 0);
      }

      if (totalTimeEl)
        totalTimeEl.textContent =
          typeof formatTime === 'function' ? formatTime(totalSecondsToday, true) : totalSecondsToday + 's';

      if (summaryEl && progressBarEl) {
        summaryEl.innerHTML = '';
        progressBarEl.innerHTML = '';
        if (totalSecondsToday > 0 && todaysCategoryData && Object.keys(todaysCategoryData).length > 0) {
          progressBarEl.style.display = 'flex';
          const categoryArray = Object.entries(todaysCategoryData)
            .map(([category, time]) => ({
              name: category,
              time: time,
              percentage: totalSecondsToday > 0 ? (time / totalSecondsToday) * 100 : 0,
            }))
            .filter((cat) => cat.time > 0.1)
            .sort((a, b) => b.time - a.time);

          const maxItemsToDisplay = 5;
          let finalDisplayItems = [];
          if (categoryArray.length <= maxItemsToDisplay) {
            finalDisplayItems = categoryArray;
          } else {
            let topSlice = categoryArray.slice(0, maxItemsToDisplay);
            const remainingCategories = categoryArray.slice(maxItemsToDisplay);
            const remainingTime = remainingCategories.reduce((sum, cat) => sum + cat.time, 0);
            const realOtherIndexInTop = topSlice.findIndex((c) => c.name === 'Other');

            if (realOtherIndexInTop !== -1) {
              topSlice[realOtherIndexInTop].time += remainingTime;
              topSlice[realOtherIndexInTop].percentage =
                totalSecondsToday > 0 ? (topSlice[realOtherIndexInTop].time / totalSecondsToday) * 100 : 0;
              finalDisplayItems = topSlice;
            } else {
              finalDisplayItems = topSlice.slice(0, maxItemsToDisplay - 1);
              const fifthItemTime = topSlice[maxItemsToDisplay - 1]?.time || 0;
              const aggregateTime = fifthItemTime + remainingTime;
              if (aggregateTime >= 1) {
                const aggregatePercentage = totalSecondsToday > 0 ? (aggregateTime / totalSecondsToday) * 100 : 0;
                finalDisplayItems.push({ name: 'Other', time: aggregateTime, percentage: aggregatePercentage });
              } else if (finalDisplayItems.length < maxItemsToDisplay && fifthItemTime >= 1) {
                finalDisplayItems.push(topSlice[maxItemsToDisplay - 1]);
              }
            }
            if (finalDisplayItems.length > maxItemsToDisplay)
              finalDisplayItems = finalDisplayItems.slice(0, maxItemsToDisplay);
          }

          finalDisplayItems.forEach((cat) => {
            const displayPercentage = cat.time > 0.1 ? Math.max(1, Math.round(cat.percentage)) : 0;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'category-item';
            const infoDiv = document.createElement('div');
            infoDiv.className = 'category-info';
            const dotSpan = document.createElement('span');
            dotSpan.className = 'category-dot';
            dotSpan.style.backgroundColor =
              typeof getCategoryColor === 'function' ? getCategoryColor(cat.name) : '#ccc';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = cat.name;
            infoDiv.appendChild(dotSpan);
            infoDiv.appendChild(nameSpan);
            const timePercentSpan = document.createElement('span');
            timePercentSpan.className = 'category-time-percent';
            timePercentSpan.appendChild(
              document.createTextNode(
                (typeof formatTime === 'function' ? formatTime(cat.time, true) : cat.time + 's') + ' '
              )
            );
            const percentSpanElement = document.createElement('span');
            percentSpanElement.className = 'category-percent';
            percentSpanElement.textContent = `(${displayPercentage}%)`;
            timePercentSpan.appendChild(percentSpanElement);
            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(timePercentSpan);
            summaryEl.appendChild(itemDiv);

            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'progress-bar-segment';
            const widthPercentage = Math.max(0.5, cat.percentage);
            segmentDiv.style.width = `${widthPercentage}%`;
            segmentDiv.style.backgroundColor =
              typeof getCategoryColor === 'function' ? getCategoryColor(cat.name) : '#ccc';
            segmentDiv.title = `${cat.name}: ${
              typeof formatTime === 'function' ? formatTime(cat.time, true) : cat.time + 's'
            } (${displayPercentage}%)`;
            progressBarEl.appendChild(segmentDiv);
          });

          const totalSegmentWidth = Array.from(progressBarEl.children).reduce(
            (sum, el) => sum + parseFloat(el.style.width || 0),
            0
          );
          if (progressBarEl.children.length > 0 && (totalSegmentWidth > 101 || totalSegmentWidth < 99)) {
            const scaleFactor = 100 / totalSegmentWidth;
            Array.from(progressBarEl.children).forEach((el) => {
              el.style.width = `${parseFloat(el.style.width || 0) * scaleFactor}%`;
            });
          }
        } else {
          summaryEl.textContent = 'No activity tracked today.';
          progressBarEl.style.display = 'none';
        }
      }

      if (hourlyChartCtx) renderHourlyChart(hourlyChartCtx, todaysHourlyData);
      if (focusScoreEl) {
        try {
          const scoreData =
            typeof calculateFocusScore === 'function'
              ? calculateFocusScore(todaysCategoryData, userRatings)
              : { score: 0 };
          focusScoreEl.textContent = `Focus Score: ${scoreData.score}%`;
          focusScoreEl.classList.remove('score-low', 'score-medium', 'score-high');
          if (scoreData.score < 40) focusScoreEl.classList.add('score-low');
          else if (scoreData.score < 70) focusScoreEl.classList.add('score-medium');
          else focusScoreEl.classList.add('score-high');
        } catch (scoreError) {
          console.error('[Popup] Error calculating focus score:', scoreError);
          focusScoreEl.textContent = 'Focus Score: Error';
        }
      }
    })
    .catch((error) => {
      console.error('Error loading data for popup:', error);
      if (totalTimeEl) totalTimeEl.textContent = 'Error';
      if (summaryEl) summaryEl.textContent = 'Error loading data.';
      if (progressBarEl) progressBarEl.style.display = 'none';
      if (hourlyChartCtx && hourlyChartCtx.canvas) {
        hourlyChartCtx.clearRect(0, 0, hourlyChartCtx.canvas.width, hourlyChartCtx.canvas.height);
        hourlyChartCtx.font = '12px sans-serif';
        hourlyChartCtx.fillStyle = '#aaa';
        hourlyChartCtx.textAlign = 'center';
        hourlyChartCtx.fillText(
          'Error loading chart data.',
          hourlyChartCtx.canvas.width / 2,
          hourlyChartCtx.canvas.height / 2
        );
      }
    });

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => browser.runtime.openOptionsPage());
  }

  const POMODORO_PHASES = {
    WORK: 'Work',
    SHORT_BREAK: 'Short Break',
    LONG_BREAK: 'Long Break',
  };

  function formatTimeForDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async function updatePomodoroDisplay(state) {
    if (
      !pomodoroPhaseEl ||
      !pomodoroTimeEl ||
      !pomodoroStartPauseBtn ||
      !pomodoroNotifyIcon ||
      !pomodoroNotifyToggleBtn
    ) {
      console.warn('[Pomodoro Popup] One or more Pomodoro UI elements are missing. Cannot update display.');
      return;
    }

    if (!state) {
      console.warn('[Pomodoro Popup] No state received to update display.');
      pomodoroPhaseEl.textContent = 'N/A';
      pomodoroTimeEl.textContent = '--:--';
      pomodoroStartPauseBtn.textContent = 'Start';
      if (pomodoroStatusMessageEl) pomodoroStatusMessageEl.textContent = 'Loading...';

      pomodoroNotifyIcon.textContent = '🔕'; // Default to notifications off icon if state is missing
      pomodoroNotifyToggleBtn.title = 'Enable Notifications / Setup';
      pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Setup Notifications in Options');
      return;
    }

    pomodoroPhaseEl.textContent = state.currentPhase;
    pomodoroPhaseEl.classList.remove('work', 'short-break', 'long-break');
    if (state.currentPhase === POMODORO_PHASES.WORK) pomodoroPhaseEl.classList.add('work');
    else if (state.currentPhase === POMODORO_PHASES.SHORT_BREAK) pomodoroPhaseEl.classList.add('short-break');
    else if (state.currentPhase === POMODORO_PHASES.LONG_BREAK) pomodoroPhaseEl.classList.add('long-break');

    pomodoroTimeEl.textContent = formatTimeForDisplay(state.remainingTime);
    pomodoroStartPauseBtn.textContent = state.timerState === 'running' ? 'Pause' : 'Start';

    // The 'state.notifyEnabled' comes directly from the background script,
    // which has already reconciled it with actual browser permissions.
    // So, we can trust this value to reflect whether notifications *can* and *will* be shown.
    const isNotifyEffectivelyEnabled = state.notifyEnabled === true;

    if (isNotifyEffectivelyEnabled) {
      pomodoroNotifyIcon.textContent = '🔔';
      pomodoroNotifyToggleBtn.title = 'Notifications: On (Click to disable)';
      pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Disable Notifications');
    } else {
      pomodoroNotifyIcon.textContent = '🔕';
      // If notifications are not effectively enabled, check if it's due to missing permission
      // to guide the user appropriately.
      try {
        const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
        if (hasPermission) {
          // Permission exists, but notifyEnabled is false (user turned them off)
          pomodoroNotifyToggleBtn.title = 'Notifications: Off (Click to enable)';
          pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Enable Notifications');
        } else {
          // Permission does NOT exist, and notifyEnabled is false (likely because of missing permission)
          pomodoroNotifyToggleBtn.title = 'Notifications: Setup Required (Click to open settings)';
          pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Setup Notifications in Options');
        }
      } catch (err) {
        console.warn('[Popup] Error checking notification permission for title (updatePomodoroDisplay):', err);
        pomodoroNotifyToggleBtn.title = 'Notifications: Check Settings'; // Fallback title
        pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Check Notification Settings');
      }
    }

    if (pomodoroStatusMessageEl) {
      if (state.timerState === 'paused') {
        pomodoroStatusMessageEl.textContent = 'Paused';
      } else if (
        state.timerState === 'stopped' &&
        state.currentPhase !== POMODORO_PHASES.WORK &&
        state.durations && // Ensure durations is present
        state.remainingTime < state.durations[state.currentPhase]
      ) {
        pomodoroStatusMessageEl.textContent = `${state.currentPhase} complete. Start next?`;
      } else if (
        state.timerState === 'stopped' &&
        state.currentPhase === POMODORO_PHASES.WORK &&
        state.workSessionsCompleted > 0 &&
        state.durations && // Ensure durations is present
        state.remainingTime < state.durations[state.currentPhase]
      ) {
        pomodoroStatusMessageEl.textContent = `Work session complete.`;
      } else {
        pomodoroStatusMessageEl.textContent = '';
      }
    }
  }

  function showCustomConfirm(message, onConfirm, onCancel) {
    if (customConfirmModalEl && customConfirmMessageEl) {
      customConfirmMessageEl.textContent = message;
      confirmYesCallback = onConfirm;
      confirmNoCallback = onCancel;
      customConfirmModalEl.style.display = 'flex';
    }
  }
  function hideCustomConfirm() {
    if (customConfirmModalEl) customConfirmModalEl.style.display = 'none';
    confirmYesCallback = null;
    confirmNoCallback = null;
  }
  if (customConfirmYesBtn) {
    customConfirmYesBtn.addEventListener('click', () => {
      if (typeof confirmYesCallback === 'function') confirmYesCallback();
      hideCustomConfirm();
    });
  }
  if (customConfirmNoBtn) {
    customConfirmNoBtn.addEventListener('click', () => {
      if (typeof confirmNoCallback === 'function') confirmNoCallback();
      hideCustomConfirm();
    });
  }
  if (customConfirmModalEl) {
    customConfirmModalEl.addEventListener('click', (event) => {
      if (event.target === customConfirmModalEl) {
        if (typeof confirmNoCallback === 'function') confirmNoCallback();
        hideCustomConfirm();
      }
    });
  }

  if (pomodoroStartPauseBtn) {
    pomodoroStartPauseBtn.addEventListener('click', () => {
      const currentButtonText = pomodoroStartPauseBtn.textContent;
      const action =
        currentButtonText === 'Start' || currentButtonText === 'Resume' ? 'startPomodoro' : 'pausePomodoro';
      browser.runtime
        .sendMessage({ action: action })
        .then(fetchAndUpdatePomodoroStatus) // Fetch and update UI after action
        .catch((err) => console.error(`Error sending ${action}:`, err));
    });
  }

  if (pomodoroResetBtn) {
    pomodoroResetBtn.addEventListener('click', () => {
      browser.runtime
        .sendMessage({ action: 'getPomodoroStatus' })
        .then((state) => {
          if (!state || !state.durations) {
            console.error('Cannot reset, invalid state from background:', state);
            return;
          }
          const isAtVeryStartOfCycle =
            state.timerState === 'stopped' &&
            state.currentPhase === POMODORO_PHASES.WORK &&
            state.workSessionsCompleted === 0 &&
            state.remainingTime === state.durations[POMODORO_PHASES.WORK];

          if (isAtVeryStartOfCycle) {
            if (pomodoroStatusMessageEl) pomodoroStatusMessageEl.textContent = 'Timer is already at the start.';
            setTimeout(() => updatePomodoroDisplay(state), 1500); // Revert message after a delay
            return;
          }
          const message = `Reset current ${state.currentPhase} timer?`;
          showCustomConfirm(message, () => {
            browser.runtime
              .sendMessage({ action: 'resetPomodoro', resetCycle: false })
              .then(fetchAndUpdatePomodoroStatus) // Fetch and update UI
              .catch((err) => console.error('Error sending resetPomodoro:', err));
          });
        })
        .catch((err) => console.error('Error getting status for reset:', err));
    });
  }

  if (pomodoroChangePhaseBtn) {
    pomodoroChangePhaseBtn.addEventListener('click', () => {
      browser.runtime
        .sendMessage({ action: 'getPomodoroStatus' })
        .then((state) => {
          if (!state) {
            console.error('Cannot switch timer, invalid state from background.');
            return;
          }
          if (state.timerState === 'running' || state.timerState === 'paused') {
            showCustomConfirm('Switching the timer will stop the current session. Continue?', () => {
              browser.runtime
                .sendMessage({ action: 'changePomodoroPhase' })
                .then(fetchAndUpdatePomodoroStatus) // Fetch and update UI
                .catch((err) => console.error('Error sending changePomodoroPhase:', err));
            });
          } else {
            browser.runtime
              .sendMessage({ action: 'changePomodoroPhase' })
              .then(fetchAndUpdatePomodoroStatus) // Fetch and update UI
              .catch((err) => console.error('Error sending changePomodoroPhase:', err));
          }
        })
        .catch((err) => console.error('Error getting status for switch timer:', err));
    });
  }

  async function handleNotifyToggleClick() {
    console.log('[Popup] handleNotifyToggleClick initiated.');
    if (!pomodoroNotifyToggleBtn) {
      console.error('[Popup] pomodoroNotifyToggleBtn not found in handleNotifyToggleClick.');
      return;
    }

    try {
      console.log('[Popup] Checking notification permissions...');
      const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
      console.log(`[Popup] Notification permission present: ${hasPermission}`);

      if (hasPermission) {
        console.log('[Popup] Permission granted. Getting current Pomodoro status to determine toggle direction...');
        // Fetch the current state from the background, which includes the *reconciled* notifyEnabled.
        const currentState = await browser.runtime.sendMessage({ action: 'getPomodoroStatus' });

        if (currentState) {
          const currentNotifySettingEnabled = currentState.notifyEnabled; // This is the authoritative state
          const newDesiredState = !currentNotifySettingEnabled; // User's intent is to toggle
          console.log(
            `[Popup] Current notifyEnabled from background: ${currentNotifySettingEnabled}. Requesting change to: ${newDesiredState}`
          );

          // Send the user's *intent* to the background.
          // The background will handle saving this intent, reconciling with permissions if needed,
          // and then broadcasting the final state via 'pomodoroStatusUpdate'.
          browser.runtime
            .sendMessage({
              action: 'updatePomodoroNotificationSetting',
              enabled: newDesiredState,
            })
            // No explicit call to fetchAndUpdatePomodoroStatus() here.
            // The UI will be updated reactively by the 'pomodoroStatusUpdate' message
            // listener when the background broadcasts the new state.
            .catch((err) => {
              console.error('[Popup] Error sending notification toggle message to background:', err);
              fetchAndUpdatePomodoroStatus(); // Fallback UI refresh on error
            });
        } else {
          console.error('[Popup] Could not get current Pomodoro status to determine toggle direction.');
          fetchAndUpdatePomodoroStatus(); // Attempt to refresh UI as a fallback
        }
      } else {
        // Permission not granted, open options page with hash for scrolling
        console.log('[Popup] Notification permission not granted. Opening options page to #pomodoro-settings-section.');
        const optionsUrl = browser.runtime.getURL('options/options.html#pomodoro-settings-section');
        browser.tabs.create({ url: optionsUrl });
        window.close(); // Close the popup after opening the options page
      }
    } catch (err) {
      console.error('[Popup] Error in handleNotifyToggleClick:', err);
      try {
        // Fallback: try to open options page without hash on error
        browser.runtime.openOptionsPage();
        window.close();
      } catch (openErr) {
        console.error('[Popup] Could not open options page on error:', openErr);
      }
    }
  }

  if (pomodoroNotifyToggleBtn) {
    console.log('[Popup] Adding click listener to pomodoroNotifyToggleBtn.');
    pomodoroNotifyToggleBtn.addEventListener('click', handleNotifyToggleClick);
  } else {
    console.error('[Popup] pomodoroNotifyToggleBtn element not found. Cannot add listener.');
  }

  function fetchAndUpdatePomodoroStatus() {
    if (!browser.runtime || !browser.runtime.sendMessage) {
      console.warn('[Pomodoro Popup] Browser runtime or sendMessage not available. Cannot fetch status.');
      updatePomodoroDisplay(null); // Update UI to a "loading/error" state
      return Promise.resolve();
    }
    return browser.runtime
      .sendMessage({ action: 'getPomodoroStatus' })
      .then((response) => {
        if (response) {
          updatePomodoroDisplay(response); // Update UI with fresh status
        } else {
          console.warn('[Pomodoro Popup] No response or error from getPomodoroStatus.');
          updatePomodoroDisplay(null); // Update UI to a "loading/error" state
        }
      })
      .catch((err) => {
        console.error('Error fetching Pomodoro status:', err);
        updatePomodoroDisplay(null); // Update UI to a "loading/error" state
      });
  }

  fetchAndUpdatePomodoroStatus();

  if (popupUpdateIntervalId) {
    clearInterval(popupUpdateIntervalId);
  }
  popupUpdateIntervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchAndUpdatePomodoroStatus();
    }
  }, 1000); // Refresh every second

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pomodoroStatusUpdate' && request.status) {
      console.log('[Popup] Received direct pomodoroStatusUpdate from background:', request.status);
      updatePomodoroDisplay(request.status); // Update UI with the broadcasted status
    }

    return false;
  });
});

console.log('[System] popup.js loaded (v9.24 - Scroll to Options & Refined Logic)');
