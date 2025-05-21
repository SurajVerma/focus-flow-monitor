// popup.js (v9.24 - Scroll to Options & Refined Logic)

// --- Global Chart Instance ---
let hourlyChartInstance = null;
// --- Interval ID for live popup updates ---
let popupUpdateIntervalId = null;

// COMMENT BLOCK: Added for 12h/24h toggle
// --- START: 12h/24h Toggle Functionality ---
const STORAGE_KEY_TIME_FORMAT = 'hourlyChartTimeFormat'; // true for 24-hour, false for 12-hour
let use24HourFormat = false; // Default to 12-hour format
let todaysHourlyDataForToggle = {}; // Store data for re-rendering on toggle

async function loadTimeFormatPreference() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_TIME_FORMAT);
    if (result[STORAGE_KEY_TIME_FORMAT] !== undefined) {
      use24HourFormat = result[STORAGE_KEY_TIME_FORMAT];
    }
  } catch (e) {
    console.warn('Error loading time format preference:', e);
  }
}

async function saveTimeFormatPreference() {
  try {
    await browser.storage.local.set({ [STORAGE_KEY_TIME_FORMAT]: use24HourFormat });
  } catch (e) {
    console.warn('Error saving time format preference:', e);
  }
}
// --- END: 12h/24h Toggle Functionality ---
// END OF COMMENT BLOCK

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

  // COMMENT BLOCK: Modified for 12h/24h toggle
  // const labels = [];
  const xAxisLabels = []; // Renamed for clarity
  // END OF COMMENT BLOCK
  const data = [];

  for (let i = 0; i < 24; i++) {
    // COMMENT BLOCK: Added for 12h/24h toggle
    if (use24HourFormat) {
      xAxisLabels.push(String(i).padStart(2, '0'));
    } else {
      const hour = i % 12 === 0 ? 12 : i % 12;
      const ampm = i < 12 ? 'AM' : 'PM';
      xAxisLabels.push(`${hour}${ampm}`);
    }
    // END OF COMMENT BLOCK
    const hourStr = i.toString().padStart(2, '0');
    const seconds = hourlyDataToday[hourStr] || 0;
    data.push(seconds);
  }

  const hasData = data.some((value) => value > 0);

  if (!hasData && canvasCtx && canvasCtx.canvas) {
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
        // COMMENT BLOCK: Modified for 12h/24h toggle
        labels: xAxisLabels, // Use the new xAxisLabels
        // END OF COMMENT BLOCK
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
            max: 3600,
            ticks: {
              stepSize: 900,
              callback: function (value, index, values) {
                if (value === 0) {
                  return null;
                }
                if (value === 900) return '15m';
                if (value === 1800) return '30m';
                if (value === 2700) return '45m';
                if (value === 3600) return '1h';
                return null;
              },
              maxTicksLimit: 5,
              font: { size: 10 },
            },
            grid: { drawTicks: false, border: { display: false } },
          },
          x: {
            ticks: {
              font: { size: 9 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              callback: function (value) {
                const originalLabel = this.getLabelForValue(value);
                if (use24HourFormat) {
                  if (/^\d\d$/.test(originalLabel)) {
                    return `${originalLabel}h`;
                  }
                  const ampmMatch = originalLabel.match(/(\d+)(AM|PM)/);
                  if (ampmMatch) {
                    let hour = parseInt(ampmMatch[1], 10);
                    const period = ampmMatch[2];
                    if (period === 'PM' && hour !== 12) hour += 12;
                    if (period === 'AM' && hour === 12) hour = 0; // Midnight
                    return `${String(hour).padStart(2, '0')}h`;
                  }
                  return originalLabel;
                } else {
                  if (originalLabel.endsWith('h')) {
                    const numericHour = parseInt(originalLabel.substring(0, originalLabel.length - 1), 10);
                    if (!isNaN(numericHour)) {
                      if (numericHour === 0 || numericHour === 24) return '12AM'; // Midnight
                      const hour12 = numericHour % 12 === 0 ? 12 : numericHour % 12;
                      const ampm = numericHour < 12 ? 'AM' : 'PM';
                      return `${hour12}${ampm}`;
                    }
                  }
                  return originalLabel;
                }
              },
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
// COMMENT BLOCK: Added for 12h/24h toggle
document.addEventListener('DOMContentLoaded', async () => {
  await loadTimeFormatPreference(); // Load preference first
  // END OF COMMENT BLOCK

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
      // COMMENT BLOCK: Added for 12h/24h toggle
      // Add click listener to the canvas for toggling time format
      hourlyChartCanvas.addEventListener('click', () => {
        use24HourFormat = !use24HourFormat; // Toggle preference
        saveTimeFormatPreference(); // Save to storage
        if (hourlyChartCtx && Object.keys(todaysHourlyDataForToggle).length > 0) {
          // Check if data is available
          renderHourlyChart(hourlyChartCtx, todaysHourlyDataForToggle); // Re-render with new format
        } else {
          // If data isn't loaded yet (e.g., very first click before storage fetch completes),
          // re-fetch and render, or simply wait for the normal data load process.
          // For simplicity, we'll rely on the main data load to eventually call renderHourlyChart.
          // The preference is saved, so the next full render will use it.
          console.log('Hourly data not yet loaded for toggle, preference saved.');
        }
      });
      // END OF COMMENT BLOCK
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
      // COMMENT BLOCK: Added for 12h/24h toggle
      todaysHourlyDataForToggle = result.hourlyData?.[todayStr] || {}; // Store for toggle
      // END OF COMMENT BLOCK
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
      // COMMENT BLOCK: Modified for 12h/24h toggle
      if (hourlyChartCtx) renderHourlyChart(hourlyChartCtx, todaysHourlyDataForToggle); // Use stored data
      // END OF COMMENT BLOCK
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
    // pomodoroStartPauseBtn.textContent = state.timerState === 'running' ? 'Pause' : 'Start';
    if (state.timerState === 'running') {
      pomodoroStartPauseBtn.textContent = 'Pause';
    } else if (state.timerState === 'paused') {
      pomodoroStartPauseBtn.textContent = 'Resume';
    } else {
      pomodoroStartPauseBtn.textContent = 'Start';
    }

    const isNotifyEffectivelyEnabled = state.notifyEnabled === true;

    if (isNotifyEffectivelyEnabled) {
      pomodoroNotifyIcon.textContent = '🔔';
      pomodoroNotifyToggleBtn.title = 'Notifications: On (Click to disable)';
      pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Disable Notifications');
    } else {
      pomodoroNotifyIcon.textContent = '🔕';
      try {
        const hasPermission = await browser.permissions.contains({ permissions: ['notifications'] });
        if (hasPermission) {
          pomodoroNotifyToggleBtn.title = 'Notifications: Off (Click to enable)';
          pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Enable Notifications');
        } else {
          pomodoroNotifyToggleBtn.title = 'Notifications: Setup Required (Click to open settings)';
          pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Setup Notifications in Options');
        }
      } catch (err) {
        console.warn('[Popup] Error checking notification permission for title (updatePomodoroDisplay):', err);
        pomodoroNotifyToggleBtn.title = 'Notifications: Check Settings';
        pomodoroNotifyToggleBtn.setAttribute('aria-label', 'Check Notification Settings');
      }
    }

    if (pomodoroStatusMessageEl) {
      if (state.timerState === 'paused') {
        pomodoroStatusMessageEl.textContent = 'Paused';
      } else if (
        state.timerState === 'stopped' &&
        state.currentPhase !== POMODORO_PHASES.WORK &&
        state.durations &&
        state.remainingTime < state.durations[state.currentPhase]
      ) {
        pomodoroStatusMessageEl.textContent = `${state.currentPhase} complete. Start next?`;
      } else if (
        state.timerState === 'stopped' &&
        state.currentPhase === POMODORO_PHASES.WORK &&
        state.workSessionsCompleted > 0 &&
        state.durations &&
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
        .then(fetchAndUpdatePomodoroStatus)
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
            setTimeout(() => updatePomodoroDisplay(state), 1500);
            return;
          }
          const message = `Reset current ${state.currentPhase} timer?`;
          showCustomConfirm(message, () => {
            browser.runtime
              .sendMessage({ action: 'resetPomodoro', resetCycle: false })
              .then(fetchAndUpdatePomodoroStatus)
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
                .then(fetchAndUpdatePomodoroStatus)
                .catch((err) => console.error('Error sending changePomodoroPhase:', err));
            });
          } else {
            browser.runtime
              .sendMessage({ action: 'changePomodoroPhase' })
              .then(fetchAndUpdatePomodoroStatus)
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
        const currentState = await browser.runtime.sendMessage({ action: 'getPomodoroStatus' });

        if (currentState) {
          const currentNotifySettingEnabled = currentState.notifyEnabled;
          const newDesiredState = !currentNotifySettingEnabled;
          console.log(
            `[Popup] Current notifyEnabled from background: ${currentNotifySettingEnabled}. Requesting change to: ${newDesiredState}`
          );
          browser.runtime
            .sendMessage({
              action: 'updatePomodoroNotificationSetting',
              enabled: newDesiredState,
            })
            .catch((err) => {
              console.error('[Popup] Error sending notification toggle message to background:', err);
              fetchAndUpdatePomodoroStatus();
            });
        } else {
          console.error('[Popup] Could not get current Pomodoro status to determine toggle direction.');
          fetchAndUpdatePomodoroStatus();
        }
      } else {
        console.log('[Popup] Notification permission not granted. Opening options page to #pomodoro-settings-section.');
        const optionsUrl = browser.runtime.getURL('options/options.html#pomodoro-settings-section');
        browser.tabs.create({ url: optionsUrl });
        window.close();
      }
    } catch (err) {
      console.error('[Popup] Error in handleNotifyToggleClick:', err);
      try {
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
      updatePomodoroDisplay(null);
      return Promise.resolve();
    }
    return browser.runtime
      .sendMessage({ action: 'getPomodoroStatus' })
      .then((response) => {
        if (response) {
          updatePomodoroDisplay(response);
        } else {
          console.warn('[Pomodoro Popup] No response or error from getPomodoroStatus.');
          updatePomodoroDisplay(null);
        }
      })
      .catch((err) => {
        console.error('Error fetching Pomodoro status:', err);
        updatePomodoroDisplay(null);
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
  }, 1000);

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pomodoroStatusUpdate' && request.status) {
      console.log('[Popup] Received direct pomodoroStatusUpdate from background:', request.status);
      updatePomodoroDisplay(request.status);
    }

    return false;
  });
});

console.log('[System] popup.js loaded (v9.24 - Scroll to Options & Refined Logic)');
