// popup.js (v9.2 - Using options-utils.js)

// --- Helper functions and categoryColors are now loaded from options-utils.js ---
// REMOVED: formatTime
// REMOVED: getCurrentDateString
// REMOVED: categoryColors
// REMOVED: defaultCategoryColor
// REMOVED: getCategoryColor

// --- Global Chart Instance ---
let hourlyChartInstance = null;

// --- Chart Rendering Function ---
function renderHourlyChart(canvasCtx, hourlyDataToday) {
  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
    hourlyChartInstance = null;
  }

  if (typeof Chart === 'undefined') {
    console.error('Chart.js library is not loaded or available!');
    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    canvasCtx.font = '12px sans-serif';
    canvasCtx.fillStyle = '#aaa';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Chart library missing!', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    return;
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

  if (maxTime <= 0) {
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
                // *** Use formatTime from options-utils.js ***
                return `Time: ${formatTime(seconds, true)}`;
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
                // *** Use formatTime from options-utils.js ***
                return formatTime(value, false); // Simple format (no seconds unless < 1m)
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
    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    canvasCtx.font = '12px sans-serif';
    canvasCtx.fillStyle = '#aaa';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Error rendering chart.', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
  }
}
// --- END Chart Function ---

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const totalTimeEl = document.getElementById('totalTimeToday');
  const dateEl = document.getElementById('currentDate');
  const summaryEl = document.getElementById('todaySummary');
  const progressBarEl = document.getElementById('categoryProgressBar');
  const optionsBtn = document.getElementById('optionsBtn');
  const hourlyChartCanvas = document.getElementById('hourlyChartCanvas');
  let hourlyChartCtx = null;

  if (hourlyChartCanvas) {
    try {
      hourlyChartCtx = hourlyChartCanvas.getContext('2d');
      if (!hourlyChartCtx) {
        throw new Error('Canvas 2D context not supported or missing.');
      }
    } catch (e) {
      console.error('Failed to get canvas context:', e);
      const chartWrapper = document.querySelector('.chart-wrapper');
      if (chartWrapper)
        chartWrapper.innerHTML =
          "<p style='color: red; font-size: small; text-align: center;'>Could not initialize chart canvas.</p>";
    }
  } else {
    console.error('Hourly chart canvas element not found!');
  }

  // Display Current Date
  if (dateEl) {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
      // Use formatDisplayDate if available, otherwise fallback
      if (typeof formatDisplayDate === 'function') {
        dateEl.textContent = formatDisplayDate(today.toISOString().split('T')[0]); // Use shared util
      } else {
        dateEl.textContent = today.toLocaleDateString(navigator.language || 'en-US', options); // Fallback
      }
    } catch (e) {
      console.warn('Could not format date using browser locale, using default.', e);
      dateEl.textContent = today.toDateString();
    }
  }

  // *** Use getCurrentDateString from options-utils.js if available ***
  // (Background uses its own version, this relies on script include order)
  const dateStringFetcher =
    typeof getCurrentDateString === 'function'
      ? getCurrentDateString
      : () => {
          const now = new Date();
          return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
            .getDate()
            .toString()
            .padStart(2, '0')}`;
        };
  const todayStr = dateStringFetcher();

  browser.storage.local
    .get(['dailyDomainData', 'dailyCategoryData', 'hourlyData'])
    .then((result) => {
      const todaysDomainData = result.dailyDomainData?.[todayStr] || {};
      const todaysCategoryData = result.dailyCategoryData?.[todayStr] || {};
      const todaysHourlyData = result.hourlyData?.[todayStr] || {};

      // Calculate Total Time
      let totalSecondsToday = 0;
      if (todaysDomainData && Object.keys(todaysDomainData).length > 0) {
        totalSecondsToday = Object.values(todaysDomainData).reduce((sum, time) => sum + time, 0);
      } else if (todaysCategoryData && Object.keys(todaysCategoryData).length > 0) {
        console.warn('[Popup] Domain data missing for today, calculating total from category data.');
        totalSecondsToday = Object.values(todaysCategoryData).reduce((sum, time) => sum + time, 0);
      }

      if (totalTimeEl) {
        // *** Use formatTime from options-utils.js ***
        totalTimeEl.textContent = formatTime(totalSecondsToday, true); // Show seconds
      }

      // Calculate and Display Category Summary & Progress Bar
      if (summaryEl && progressBarEl) {
        summaryEl.innerHTML = ''; // Clear previous
        progressBarEl.innerHTML = ''; // Clear previous

        if (totalSecondsToday > 0 && todaysCategoryData && Object.keys(todaysCategoryData).length > 0) {
          progressBarEl.style.display = 'flex'; // Show progress bar

          // Sort categories by time spent
          const categoryArray = Object.entries(todaysCategoryData)
            .map(([category, time]) => ({
              name: category,
              time: time,
              percentage: totalSecondsToday > 0 ? (time / totalSecondsToday) * 100 : 0,
            }))
            .filter((cat) => cat.time > 0.1)
            .sort((a, b) => b.time - a.time);

          // Aggregate smaller categories into 'Other' (Logic unchanged)
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
            if (finalDisplayItems.length > maxItemsToDisplay) {
              finalDisplayItems = finalDisplayItems.slice(0, maxItemsToDisplay);
            }
          }

          // --- Render Summary List and Progress Bar Segments ---
          finalDisplayItems.forEach((cat) => {
            const displayPercentage = cat.time > 0.1 ? Math.max(1, Math.round(cat.percentage)) : 0;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'category-item';
            const infoDiv = document.createElement('div');
            infoDiv.className = 'category-info';
            const dotSpan = document.createElement('span');
            dotSpan.className = 'category-dot';
            // *** Use getCategoryColor from options-utils.js ***
            dotSpan.style.backgroundColor = getCategoryColor(cat.name);
            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = cat.name;
            infoDiv.appendChild(dotSpan);
            infoDiv.appendChild(nameSpan);
            const timePercentSpan = document.createElement('span');
            timePercentSpan.className = 'category-time-percent';
            timePercentSpan.innerHTML = '';
            // *** Use formatTime from options-utils.js ***
            timePercentSpan.appendChild(document.createTextNode(formatTime(cat.time, true) + ' ')); // Show seconds
            const percentSpan = document.createElement('span');
            percentSpan.className = 'category-percent';
            percentSpan.textContent = `(${displayPercentage}%)`;
            timePercentSpan.appendChild(percentSpan);
            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(timePercentSpan);
            summaryEl.appendChild(itemDiv);

            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'progress-bar-segment';
            const widthPercentage = Math.max(0.5, cat.percentage);
            segmentDiv.style.width = `${widthPercentage}%`;
            // *** Use getCategoryColor and formatTime from options-utils.js ***
            segmentDiv.style.backgroundColor = getCategoryColor(cat.name);
            segmentDiv.title = `${cat.name}: ${formatTime(cat.time, true)} (${displayPercentage}%)`; // Show seconds
            progressBarEl.appendChild(segmentDiv);
          });

          // Adjust progress bar segments (Logic unchanged)
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
      } else {
        console.error('[Popup] Summary or progress bar element not found');
      }

      // Render Hourly Chart
      if (hourlyChartCtx) {
        renderHourlyChart(hourlyChartCtx, todaysHourlyData);
      }
    })
    .catch((error) => {
      console.error('Error loading data for popup:', error);
      if (totalTimeEl) totalTimeEl.textContent = 'Error';
      if (summaryEl) summaryEl.textContent = 'Error loading data.';
      if (progressBarEl) progressBarEl.style.display = 'none';
      if (hourlyChartCtx) {
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

  // --- Event Listeners ---
  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
    });
  } else {
    console.error('Options button not found');
  }
});

console.log('[System] popup.js loaded (using options-utils.js)');
