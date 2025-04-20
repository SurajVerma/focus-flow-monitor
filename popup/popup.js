// popup.js (v9 - Hourly Chart Added to YOUR v8)

// --- Helper Functions ---
function formatTimePopup(seconds) {
  // Copied from your v8 code
  if (seconds < 0) seconds = 0;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const remainingSeconds = seconds % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  if (hours === 0 && remainingMinutes === 0) {
    parts.push(`${remainingSeconds}s`);
  }
  if (parts.length === 0 && seconds >= 60 && totalMinutes > 0)
    parts.push(`${totalMinutes}m`); // Handle case like 60s showing 1m
  else if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);
  else if (parts.length === 0 && seconds === 0) return '0s'; // Explicit 0s
  if (parts.length === 0 && seconds < 0) return '--h --m'; // Error/loading case
  return parts.join(' ');
}

function getCurrentDateString() {
  // Copied from your v8 code
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Category Colors ---
// Copied from your v8 code
const categoryColors = {
  'Work/Productivity': 'rgba(54, 162, 235, 0.9)',
  'Social Media': 'rgba(255, 99, 132, 0.9)',
  'News & Info': 'rgba(255, 159, 64, 0.9)',
  Entertainment: 'rgba(153, 102, 255, 0.9)',
  Shopping: 'rgba(255, 205, 86, 0.9)',
  'Reference & Learning': 'rgba(75, 192, 192, 0.9)',
  Technology: 'rgba(100, 255, 64, 0.9)',
  Finance: 'rgba(40, 100, 120, 0.9)',
  Other: 'rgba(201, 203, 207, 0.9)',
};
function getCategoryColor(category) {
  /* Copied from your v8 code */ return categoryColors[category] || categoryColors['Other'];
}

// --- Global Chart Instance ---
let hourlyChartInstance = null; // Add variable for the chart instance

// --- NEW: Chart Rendering Function ---
function renderHourlyChart(canvasCtx, hourlyDataToday) {
  console.log('[Popup] Rendering hourly chart with data:', hourlyDataToday);
  if (hourlyChartInstance) {
    hourlyChartInstance.destroy(); // Destroy previous chart if exists
    hourlyChartInstance = null;
  }

  // Double check Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library is not loaded or available!');
    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    canvasCtx.font = '12px sans-serif';
    canvasCtx.fillStyle = '#aaa'; // Corrected from 'ctx.fillStyle'
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Chart library missing!', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
    return;
  }

  // Prepare data for the chart
  const labels = []; // Hour labels (e.g., "12AM", "1AM"..."11PM")
  const data = []; // Time in seconds for each hour
  let maxTime = 0; // To help determine y-axis scale

  for (let i = 0; i < 24; i++) {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const ampm = i < 12 ? 'AM' : 'PM';
    labels.push(`${hour}${ampm}`); // Use 12-hour format labels

    const hourStr = i.toString().padStart(2, '0'); // Key is "00", "01", etc.
    const seconds = hourlyDataToday[hourStr] || 0;
    data.push(seconds);
    if (seconds > maxTime) {
      maxTime = seconds;
    }
  }

  // Don't render if there's absolutely no data for any hour
  if (maxTime <= 0) {
    console.log('[Popup] No hourly data to render chart.');
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
        maintainAspectRatio: false, // Important for fixed height container
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
                // Use the more detailed formatTime helper for tooltips
                // Assume a global formatTime exists or use formatTimePopup if sufficient
                const formatTimeTooltip = typeof formatTime === 'function' ? formatTime : formatTimePopup;
                return `Time: ${formatTimeTooltip(seconds, true)}`; // Pass true to include seconds if using original formatTime
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxTime * 1.1, // Give some top padding
            ticks: {
              callback: function (value) {
                if (value === 0 && maxTime > 0) return '0s'; // Show 0s only if there's other data
                if (value === 0 && maxTime === 0) return ''; // Hide 0s if no data
                // Use simple format for axis to avoid clutter
                return formatTimePopup(value);
              },
              maxTicksLimit: 4, // Fewer ticks on Y axis
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
    console.log('[Popup] Hourly chart rendered.');
  } catch (chartError) {
    console.error('Error creating hourly chart:', chartError);
    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);
    canvasCtx.font = '12px sans-serif';
    canvasCtx.fillStyle = '#aaa';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Error rendering chart.', canvasCtx.canvas.width / 2, canvasCtx.canvas.height / 2);
  }
}
// --- END NEW Chart Function ---

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const totalTimeEl = document.getElementById('totalTimeToday');
  const dateEl = document.getElementById('currentDate');
  const summaryEl = document.getElementById('todaySummary');
  const progressBarEl = document.getElementById('categoryProgressBar');
  const optionsBtn = document.getElementById('optionsBtn');
  // const calendarBtn = document.getElementById('viewCalendarBtn'); // Button is commented out in HTML
  // *** Get Canvas Context ***
  const hourlyChartCanvas = document.getElementById('hourlyChartCanvas');
  let hourlyChartCtx = null;
  if (hourlyChartCanvas) {
    try {
      // Wrap getContext in try-catch
      hourlyChartCtx = hourlyChartCanvas.getContext('2d');
      if (!hourlyChartCtx) {
        throw new Error('Canvas 2D context not supported or missing.');
      }
    } catch (e) {
      console.error('Failed to get canvas context:', e);
      // Optionally display error in the chart area's parent div
      const chartWrapper = document.querySelector('.chart-wrapper');
      if (chartWrapper)
        chartWrapper.innerHTML =
          "<p style='color: red; font-size: small; text-align: center;'>Could not initialize chart canvas.</p>";
    }
  } else {
    console.error('Hourly chart canvas element not found!');
  }

  // Display Current Date (IDENTICAL to your v8 code)
  if (dateEl) {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
      dateEl.textContent = today.toLocaleDateString(navigator.language || 'en-US', options);
    } catch (e) {
      console.warn('Could not format date using browser locale, using default.', e);
      dateEl.textContent = today.toDateString();
    }
  }

  // Request ALL relevant data now (including hourlyData)
  const todayStr = getCurrentDateString();
  browser.storage.local
    .get(['dailyDomainData', 'dailyCategoryData', 'hourlyData']) // Add hourlyData
    .then((result) => {
      const todaysDomainData = result.dailyDomainData?.[todayStr] || {};
      const todaysCategoryData = result.dailyCategoryData?.[todayStr] || {};
      const todaysHourlyData = result.hourlyData?.[todayStr] || {}; // *** Get hourly data ***

      // Calculate Total Time (IDENTICAL to your v8 code)
      let totalSecondsToday = 0;
      if (todaysDomainData && Object.keys(todaysDomainData).length > 0) {
        totalSecondsToday = Object.values(todaysDomainData).reduce((sum, time) => sum + time, 0);
      } else if (todaysCategoryData && Object.keys(todaysCategoryData).length > 0) {
        // Fallback to summing category data if domain data is missing for today
        console.warn('[Popup] Domain data missing for today, calculating total from category data.');
        totalSecondsToday = Object.values(todaysCategoryData).reduce((sum, time) => sum + time, 0);
      }

      if (totalTimeEl) {
        totalTimeEl.textContent = formatTimePopup(totalSecondsToday);
      }

      // Calculate and Display Category Summary & Progress Bar (IDENTICAL to your v8 code, adapted slightly)
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
            .filter((cat) => cat.time > 0.1) // Filter out negligible times
            .sort((a, b) => b.time - a.time); // Sort descending

          // Aggregate smaller categories into 'Other' if needed (logic from your v8)
          const maxItemsToDisplay = 5;
          let finalDisplayItems = [];
          if (categoryArray.length <= maxItemsToDisplay) {
            finalDisplayItems = categoryArray;
          } else {
            let topSlice = categoryArray.slice(0, maxItemsToDisplay);
            const remainingCategories = categoryArray.slice(maxItemsToDisplay);
            const remainingTime = remainingCategories.reduce((sum, cat) => sum + cat.time, 0);

            // Try to merge into existing 'Other' if it's in the top slice
            const realOtherIndexInTop = topSlice.findIndex((c) => c.name === 'Other');
            if (realOtherIndexInTop !== -1) {
              topSlice[realOtherIndexInTop].time += remainingTime;
              topSlice[realOtherIndexInTop].percentage =
                totalSecondsToday > 0 ? (topSlice[realOtherIndexInTop].time / totalSecondsToday) * 100 : 0;
              finalDisplayItems = topSlice;
            } else {
              // Otherwise, replace the last item or add a new 'Other'
              finalDisplayItems = topSlice.slice(0, maxItemsToDisplay - 1);
              const fifthItemTime = topSlice[maxItemsToDisplay - 1]?.time || 0;
              const aggregateTime = fifthItemTime + remainingTime;

              if (aggregateTime >= 1) {
                // Only add 'Other' if it has significant time
                const aggregatePercentage = totalSecondsToday > 0 ? (aggregateTime / totalSecondsToday) * 100 : 0;
                finalDisplayItems.push({ name: 'Other', time: aggregateTime, percentage: aggregatePercentage });
              } else if (finalDisplayItems.length < maxItemsToDisplay && fifthItemTime >= 1) {
                // If 'Other' wasn't added but there's space, add the original 5th item back
                finalDisplayItems.push(topSlice[maxItemsToDisplay - 1]);
              }
            }
          }

          // Ensure we don't exceed max items after aggregation
          if (finalDisplayItems.length > maxItemsToDisplay) {
            finalDisplayItems = finalDisplayItems.slice(0, maxItemsToDisplay);
          }

          // --- Render Summary List and Progress Bar Segments ---
          let totalDisplayedPercentage = 0; // For progress bar adjustment
          finalDisplayItems.forEach((cat) => {
            const displayPercentage = cat.time > 0.1 ? Math.max(1, Math.round(cat.percentage)) : 0; // Show at least 1% if > 0.1s

            // Create Summary Item Div
            const itemDiv = document.createElement('div');
            itemDiv.className = 'category-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'category-info';

            const dotSpan = document.createElement('span');
            dotSpan.className = 'category-dot';
            dotSpan.style.backgroundColor = getCategoryColor(cat.name);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = cat.name;

            infoDiv.appendChild(dotSpan);
            infoDiv.appendChild(nameSpan);

            const timePercentSpan = document.createElement('span');
            timePercentSpan.className = 'category-time-percent';

            // FIX for line 304: Use textContent and appendChild
            // Clear existing content first
            timePercentSpan.innerHTML = '';
            // Add the formatted time as a text node
            timePercentSpan.appendChild(document.createTextNode(formatTimePopup(cat.time) + ' '));
            // Create the percentage span
            const percentSpan = document.createElement('span');
            percentSpan.className = 'category-percent';
            percentSpan.textContent = `(${displayPercentage}%)`;
            timePercentSpan.appendChild(percentSpan);
            // END FIX for line 304

            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(timePercentSpan);
            summaryEl.appendChild(itemDiv);

            // Create Progress Bar Segment Div
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'progress-bar-segment';
            // Ensure segment width is at least visually noticeable, even for small percentages
            const widthPercentage = Math.max(0.5, cat.percentage);
            segmentDiv.style.width = `${widthPercentage}%`;
            segmentDiv.style.backgroundColor = getCategoryColor(cat.name);
            segmentDiv.title = `${cat.name}: ${formatTimePopup(cat.time)} (${displayPercentage}%)`; // Tooltip
            progressBarEl.appendChild(segmentDiv);

            totalDisplayedPercentage += widthPercentage; // Add to total for adjustment check
          });

          // Adjust progress bar segments if total width isn't close to 100% due to rounding/minimums
          const totalSegmentWidth = Array.from(progressBarEl.children).reduce(
            (sum, el) => sum + parseFloat(el.style.width || 0),
            0
          );
          // Adjust if total width is slightly off (e.g., > 101% or < 99%)
          if (progressBarEl.children.length > 0 && (totalSegmentWidth > 101 || totalSegmentWidth < 99)) {
            console.warn(`[Popup] Progress bar segments total width ${totalSegmentWidth}%, adjusting.`);
            const scaleFactor = 100 / totalSegmentWidth;
            Array.from(progressBarEl.children).forEach((el) => {
              el.style.width = `${parseFloat(el.style.width || 0) * scaleFactor}%`;
            });
          }
        } else {
          // No data for today
          summaryEl.textContent = 'No activity tracked today.';
          progressBarEl.style.display = 'none'; // Hide progress bar
        }
      } else {
        console.error('[Popup] Summary or progress bar element not found');
      }
      // --- End Category Summary ---

      // *** Render Hourly Chart ***
      if (hourlyChartCtx) {
        // Check if context was obtained
        renderHourlyChart(hourlyChartCtx, todaysHourlyData);
      }
      // *** End Chart Rendering ***
    })
    .catch((error) => {
      console.error('Error loading data for popup:', error);
      if (totalTimeEl) totalTimeEl.textContent = 'Error';
      if (summaryEl) summaryEl.textContent = 'Error loading data.';
      if (progressBarEl) progressBarEl.style.display = 'none';
      if (hourlyChartCtx) {
        // Display error on canvas if context exists but data loading failed
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
  /* // Calendar button listener commented out as button is hidden in HTML
  if (calendarBtn) {
    calendarBtn.addEventListener('click', () => {
      alert('Calendar view not implemented yet!');
    });
  } else {
    console.warn('Calendar button not found'); // Keep warning if element exists but ID changes
  }
  */
});
