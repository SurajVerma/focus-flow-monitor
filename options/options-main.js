// options/options-main.js (v0.8.1 - Load Retention Setting) - Recalculation Fix

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Options Main] DOMContentLoaded');
  if (!queryUIElements()) {
    console.error('Failed to initialize UI elements. Aborting setup.');
    return;
  }
  try {
    const defaultChartView = AppState.currentChartViewMode || 'domain';
    const radioToCheck = document.querySelector(`input[name="chartView"][value="${defaultChartView}"]`);
    if (radioToCheck) radioToCheck.checked = true;
    else {
      const fallback = document.querySelector('input[name="chartView"][value="domain"]');
      if (fallback) fallback.checked = true;
    }
  } catch (e) {
    console.error('Error setting initial chart view radio button:', e);
  }
  loadAllData();
  setupEventListeners(); // Call setupEventListeners
  console.log('Options Main script initialized (v0.8.1 - Recalculation Fix).');
});

// --- Data Loading ---
function loadAllData() {
  console.log('[Options Main] loadAllData starting...');
  browser.storage.local
    .get([
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
      STORAGE_KEY_IDLE_THRESHOLD,
      STORAGE_KEY_DATA_RETENTION_DAYS,
      STORAGE_KEY_PRODUCTIVITY_RATINGS,
    ])
    .then((result) => {
      console.log('[Options Main] Data loaded from storage.');
      try {
        // Update AppState
        AppState.trackedData = result.trackedData || {};
        AppState.categoryTimeData = result.categoryTimeData || {};
        AppState.dailyDomainData = result.dailyDomainData || {};
        AppState.dailyCategoryData = result.dailyCategoryData || {};
        AppState.hourlyData = result.hourlyData || {};
        AppState.categories = result.categories || ['Other'];
        AppState.categoryProductivityRatings = result[STORAGE_KEY_PRODUCTIVITY_RATINGS] || {};
        if (!AppState.categories.includes('Other')) AppState.categories.push('Other');
        AppState.categoryAssignments = result.categoryAssignments || {};
        AppState.rules = result.rules || [];

        // Set idle threshold dropdown
        const savedIdleThreshold = result[STORAGE_KEY_IDLE_THRESHOLD];
        if (UIElements.idleThresholdSelect) {
          UIElements.idleThresholdSelect.value =
            savedIdleThreshold !== undefined && savedIdleThreshold !== null ? savedIdleThreshold : DEFAULT_IDLE_SECONDS;
        }

        // Set data retention dropdown
        const savedRetentionDays = result[STORAGE_KEY_DATA_RETENTION_DAYS];
        if (UIElements.dataRetentionSelect) {
          UIElements.dataRetentionSelect.value =
            savedRetentionDays !== undefined && savedRetentionDays !== null
              ? savedRetentionDays
              : DEFAULT_DATA_RETENTION_DAYS;
          console.log(`[Options Main] Data retention loaded: ${UIElements.dataRetentionSelect.value} days`);
        }

        // Initial UI Population
        populateCategoryList();
        populateCategorySelect();
        populateAssignmentList();
        populateRuleCategorySelect();
        populateRuleList();
        populateProductivitySettings();
        renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth());
        updateDisplayForSelectedRangeUI();
        highlightSelectedCalendarDay(AppState.selectedDateStr);
      } catch (processingError) {
        console.error('[Options Main] Error during data processing/UI update!', processingError);
        if (UIElements.categoryTimeList) {
          UIElements.categoryTimeList.replaceChildren();
          const errorLi = document.createElement('li');
          errorLi.textContent = 'Error loading data.';
          UIElements.categoryTimeList.appendChild(errorLi);
        }
        if (UIElements.detailedTimeList) {
          UIElements.detailedTimeList.replaceChildren();
          const errorLi = document.createElement('li');
          errorLi.textContent = 'Error loading data.';
          UIElements.detailedTimeList.appendChild(errorLi);
        }
        clearChartOnError('Error processing data');
      }
    })
    .catch((error) => {
      console.error('[Options Main] storage.local.get FAILED!', error);
      if (UIElements.categoryTimeList) {
        UIElements.categoryTimeList.replaceChildren();
        const errorLi = document.createElement('li');
        errorLi.textContent = 'Failed to load data.';
        UIElements.categoryTimeList.appendChild(errorLi);
      }
      if (UIElements.detailedTimeList) {
        UIElements.detailedTimeList.replaceChildren();
        const errorLi = document.createElement('li');
        errorLi.textContent = 'Failed to load data.';
        UIElements.detailedTimeList.appendChild(errorLi);
      }
      clearChartOnError('Failed to load data');
    });
}

// --- UI Update Wrappers ---
function updateDisplayForSelectedRangeUI() {
  if (!UIElements.dateRangeSelect) {
    console.warn('Date range select element not found.');
    return;
  }
  const selectedRange = UIElements.dateRangeSelect.value;
  const loader = document.getElementById('statsLoader'); // Make sure this ID exists in your HTML or remove loader logic
  const dashboard = document.querySelector('.stats-dashboard');

  const showLoader = ['week', 'month', 'all'].includes(selectedRange);

  if (showLoader && loader) {
    loader.style.display = 'block';
    if (dashboard) dashboard.style.visibility = 'hidden'; // Hide dashboard while loading large ranges
  } else if (loader) {
    loader.style.display = 'none'; // Ensure loader is hidden otherwise
  }

  // Use setTimeout to allow loader to render if needed
  setTimeout(() => {
    let domainData = {},
      categoryData = {},
      label = `Error (${selectedRange})`; // Default error values
    try {
      // Get data aggregated for the selected range (e.g., 'week', 'month')
      const rangeData = getFilteredDataForRange(selectedRange);
      domainData = rangeData.domainData;
      categoryData = rangeData.categoryData;
      label = rangeData.label;

      // Call the consolidated update function.
      // The chart should still reflect the *single selected day* in the calendar (AppState.selectedDateStr)
      // even when viewing aggregated lists/scores for a range.
      updateStatsDisplay(domainData, categoryData, label, AppState.selectedDateStr);
    } catch (e) {
      console.error(`Error processing range ${selectedRange}:`, e);
      // If fetching/processing range data failed, display empty stats with error label
      updateStatsDisplay({}, {}, label); // Pass empty data but the error label
    } finally {
      if (loader) loader.style.display = 'none';
      if (dashboard) dashboard.style.visibility = 'visible'; // Ensure dashboard is visible
    }
  }, 10); // Small timeout
}
function updateDomainDisplayAndPagination() {
  if (
    !UIElements.detailedTimeList ||
    !UIElements.domainPaginationDiv ||
    !UIElements.domainPrevBtn ||
    !UIElements.domainNextBtn ||
    !UIElements.domainPageInfo
  ) {
    console.warn('Pagination or detailed list elements not found.');
    return;
  }
  const totalItems = AppState.fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / AppState.domainItemsPerPage));
  AppState.domainCurrentPage = Math.max(1, Math.min(AppState.domainCurrentPage, totalPages));

  const startIndex = (AppState.domainCurrentPage - 1) * AppState.domainItemsPerPage;
  const endIndex = startIndex + AppState.domainItemsPerPage;
  const itemsToShow = AppState.fullDomainDataSorted.slice(startIndex, endIndex);

  displayDomainTime(itemsToShow);

  UIElements.domainPageInfo.textContent = `Page ${AppState.domainCurrentPage} of ${totalPages}`;
  UIElements.domainPrevBtn.disabled = AppState.domainCurrentPage <= 1;
  UIElements.domainNextBtn.disabled = AppState.domainCurrentPage >= totalPages;
  UIElements.domainPaginationDiv.style.display = totalPages > 1 ? 'flex' : 'none';
}

/**
 * Updates all statistic display elements (lists, score, chart, labels) with the provided data.
 * @param {object} domainData - Domain time data object { domain: seconds, ... }
 * @param {object} categoryData - Category time data object { category: seconds, ... }
 * @param {string} label - The label for the period (e.g., "Today", "This Week", "May 2, 2025")
 * @param {string} [chartDateStr] - Optional. The specific date string (YYYY-MM-DD) for chart rendering. Defaults to AppState.selectedDateStr if not provided.
 */
function updateStatsDisplay(domainData, categoryData, label, chartDateStr = AppState.selectedDateStr) {
  try {
    console.log(`[Options Main] updateStatsDisplay called for label: ${label}`);

    // Ensure data inputs are objects, even if null/undefined
    const currentDomainData = domainData || {};
    const currentCategoryData = categoryData || {};

    // Update the period label spans
    if (UIElements.statsPeriodSpans) {
      UIElements.statsPeriodSpans.forEach((span) => (span.textContent = label));
    }

    // Update domain list and pagination
    AppState.fullDomainDataSorted = Object.entries(currentDomainData)
      .map(([d, t]) => ({ domain: d, time: t }))
      .sort((a, b) => b.time - a.time);
    AppState.domainCurrentPage = 1; // Reset pagination to page 1
    updateDomainDisplayAndPagination(); // This function uses AppState.fullDomainDataSorted

    // Update category time list
    displayCategoryTime(currentCategoryData); // Pass the specific category data

    // Calculate and Display Focus Score
    try {
      const scoreData = calculateFocusScore(currentCategoryData, AppState.categoryProductivityRatings);
      displayProductivityScore(scoreData, label); // Pass the correct label
      console.log(`[Options Main] Focus score calculated for "${label}": ${scoreData?.score}%`);
    } catch (scoreError) {
      console.error(`[Options Main] Error calculating focus score for label "${label}":`, scoreError);
      displayProductivityScore(null, label, true); // Display error state
    }

    // Render chart based on the *specific date* the chart should represent
    const chartDataView =
      AppState.currentChartViewMode === 'domain'
        ? AppState.dailyDomainData[chartDateStr] || {}
        : AppState.dailyCategoryData[chartDateStr] || {};
    const chartLabel = formatDisplayDate(chartDateStr); // Label for the chart title
    renderChart(chartDataView, chartLabel, AppState.currentChartViewMode); // Use the general renderChart

    if (UIElements.chartTitleElement) {
      UIElements.chartTitleElement.textContent = `Usage Chart (${chartLabel})`; // Update chart title
    }

    console.log(`[Options Main] Stats display updated for label: ${label}`);
  } catch (error) {
    console.error(`[Options Main] Error during updateStatsDisplay for label "${label}":`, error);
    // Fallback: Display error state for all components
    displayCategoryTime({});
    updateDomainDisplayAndPagination(); // Will show empty based on potentially empty AppState.fullDomainDataSorted
    displayProductivityScore(null, label, true);
    clearChartOnError(`Error loading data for ${label}`);
    if (UIElements.chartTitleElement) {
      UIElements.chartTitleElement.textContent = `Usage Chart (Error)`;
    }
  }
}

/**
 * Updates the statistics display areas to show a "No data" message for a specific date.
 * @param {string} displayDateLabel - The user-friendly formatted date string (e.g., "May 3, 2025").
 */
function displayNoDataForDate(displayDateLabel) {
  console.log(`[Options Main] Displaying 'No Data' state for: ${displayDateLabel}`);

  const noDataMessage = `No data recorded for ${displayDateLabel}.`;

  // Update period labels
  if (UIElements.statsPeriodSpans) {
    UIElements.statsPeriodSpans.forEach((span) => (span.textContent = displayDateLabel));
  }

  // Clear Category List
  if (UIElements.categoryTimeList) {
    UIElements.categoryTimeList.replaceChildren(); // Clear existing items
    const li = document.createElement('li');
    li.textContent = noDataMessage;
    li.style.textAlign = 'center'; // Optional: center the message
    li.style.color = 'var(--text-color-muted)'; // Optional: use muted color
    UIElements.categoryTimeList.appendChild(li);
  }

  // Clear Domain List and hide pagination
  if (UIElements.detailedTimeList) {
    UIElements.detailedTimeList.replaceChildren(); // Clear existing items
    const li = document.createElement('li');
    li.textContent = noDataMessage;
    li.style.textAlign = 'center'; // Optional: center the message
    li.style.color = 'var(--text-color-muted)'; // Optional: use muted color
    UIElements.detailedTimeList.appendChild(li);
  }
  if (UIElements.domainPaginationDiv) {
    UIElements.domainPaginationDiv.style.display = 'none'; // Hide pagination
  }
  // Reset sorted data in state to ensure pagination doesn't reappear incorrectly later
  AppState.fullDomainDataSorted = [];

  // Update Focus Score display
  if (UIElements.productivityScoreLabel) {
    UIElements.productivityScoreLabel.textContent = `Focus Score (${displayDateLabel})`;
  }
  if (UIElements.productivityScoreValue) {
    UIElements.productivityScoreValue.textContent = 'N/A'; // Or '--%' or '0%'
    UIElements.productivityScoreValue.className = 'score-value'; // Reset score class
  }

  // Clear Chart
  clearChartOnError(noDataMessage); // Reuse the existing chart clearing function
  if (UIElements.chartTitleElement) {
    UIElements.chartTitleElement.textContent = `Usage Chart (${displayDateLabel})`; // Update title even if no data
  }
}

function renderChartForSelectedDateUI() {
  if (!AppState.selectedDateStr) {
    clearChartOnError('Select a date from the calendar.');
    return;
  }
  const data =
    AppState.currentChartViewMode === 'domain'
      ? AppState.dailyDomainData[AppState.selectedDateStr] || {}
      : AppState.dailyCategoryData[AppState.selectedDateStr] || {};

  const displayDate = formatDisplayDate(AppState.selectedDateStr);
  renderChart(data, displayDate, AppState.currentChartViewMode);

  if (UIElements.chartTitleElement) {
    UIElements.chartTitleElement.textContent = `Usage Chart (${displayDate})`;
  }
}

// --- Get Filtered Data ---
function getFilteredDataForRange(range) {
  let initialDomainData = {};
  let initialCategoryData = {};
  let mergedDomainData = {}; // <<< Declare mergedDomainData HERE (outside try)
  let periodLabel = 'All Time';
  const today = new Date();

  try {
    // --- Step 1: Aggregate data based on range (Existing Logic) ---
    if (range === 'today') {
      const todayStr = formatDate(today); // from utils.js
      initialDomainData = AppState.dailyDomainData[todayStr] || {};
      initialCategoryData = AppState.dailyCategoryData[todayStr] || {};
      periodLabel = 'Today';
    } else if (range === 'week') {
      periodLabel = 'This Week';
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = formatDate(date); // from utils.js
        const dF = AppState.dailyDomainData[dateStr];
        if (dF) {
          for (const d in dF) initialDomainData[d] = (initialDomainData[d] || 0) + dF[d];
        }
        const cF = AppState.dailyCategoryData[dateStr];
        if (cF) {
          for (const c in cF) initialCategoryData[c] = (initialCategoryData[c] || 0) + cF[c];
        }
      }
    } else if (range === 'month') {
      periodLabel = 'This Month';
      const y = today.getFullYear();
      const m = today.getMonth();
      const dIM = today.getDate(); // Days In Month (up to today)
      for (let day = 1; day <= dIM; day++) {
        const date = new Date(y, m, day);
        const dateStr = formatDate(date); // from utils.js
        const dF = AppState.dailyDomainData[dateStr];
        if (dF) {
          for (const d in dF) initialDomainData[d] = (initialDomainData[d] || 0) + dF[d];
        }
        const cF = AppState.dailyCategoryData[dateStr];
        if (cF) {
          for (const c in cF) initialCategoryData[c] = (initialCategoryData[c] || 0) + cF[c];
        }
      }
    } else {
      // 'all'
      periodLabel = 'All Time';
      if (Object.keys(AppState.dailyDomainData).length > 0) {
        console.log("[Options Main] Recalculating 'All Time' from daily data for display.");
        initialDomainData = {}; // Start fresh
        initialCategoryData = {}; // Start fresh
        for (const dateStr in AppState.dailyDomainData) {
          const dF = AppState.dailyDomainData[dateStr];
          if (dF) {
            for (const d in dF) initialDomainData[d] = (initialDomainData[d] || 0) + dF[d];
          }
        }
        for (const dateStr in AppState.dailyCategoryData) {
          const cF = AppState.dailyCategoryData[dateStr];
          if (cF) {
            for (const c in cF) initialCategoryData[c] = (initialCategoryData[c] || 0) + cF[c];
          }
        }
      } else {
        console.warn("[Options Main] Daily data is empty, falling back to stored 'All Time' totals.");
        initialDomainData = AppState.trackedData || {};
        initialCategoryData = AppState.categoryTimeData || {};
      }
    }

    // --- Step 2: Merge www and non-www domains (Now populates the outer mergedDomainData) ---
    // No longer declaring mergedDomainData here
    for (const domain in initialDomainData) {
      const time = initialDomainData[domain];
      if (time > 0) {
        let normalizedDomain = domain;
        if (domain.startsWith('www.')) {
          normalizedDomain = domain.substring(4);
        }
        mergedDomainData[normalizedDomain] = (mergedDomainData[normalizedDomain] || 0) + time;
      }
    }
    // --- End Merging Logic ---
  } catch (filterError) {
    console.error(`Error filtering/merging for range "${range}":`, filterError);
    // Return empty objects on error (mergedDomainData might be partially populated or empty)
    // It's declared outside, so the return statement below will still work, returning whatever was merged before the error.
    // If the goal is to return completely empty on ANY error, we'd return here:
    // return { domainData: {}, categoryData: {}, label: `Error (${range})` };
  }

  // Return the MERGED domain data (declared outside try) and the original category data
  return { domainData: mergedDomainData, categoryData: initialCategoryData, label: periodLabel };
}

// --- Event Listener Setup ---
function setupEventListeners() {
  console.log('[Options Main] Setting up event listeners...');
  try {
    if (UIElements.addCategoryBtn) UIElements.addCategoryBtn.addEventListener('click', handleAddCategory);
    if (UIElements.assignDomainBtn) UIElements.assignDomainBtn.addEventListener('click', handleAssignDomain);
    if (UIElements.categoryList) {
      UIElements.categoryList.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-delete-btn')) handleDeleteCategory(event);
        else if (event.target.classList.contains('category-edit-btn')) handleEditCategoryClick(event);
        else if (event.target.classList.contains('category-save-btn')) handleSaveCategoryClick(event);
        else if (event.target.classList.contains('category-cancel-btn')) handleCancelCategoryEditClick(event);
      });
    }
    if (UIElements.assignmentList) {
      UIElements.assignmentList.addEventListener('click', (event) => {
        if (event.target.classList.contains('assignment-delete-btn')) handleDeleteAssignment(event);
        else if (event.target.classList.contains('assignment-edit-btn')) handleEditAssignmentClick(event);
      });
    }
    if (UIElements.ruleList) {
      UIElements.ruleList.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) handleDeleteRule(event);
        else if (event.target.classList.contains('edit-btn')) handleEditRuleClick(event);
      });
    }
    if (UIElements.ruleTypeSelect) UIElements.ruleTypeSelect.addEventListener('change', handleRuleTypeChange);
    if (UIElements.addRuleBtn) UIElements.addRuleBtn.addEventListener('click', handleAddRule);
    if (UIElements.dateRangeSelect)
      UIElements.dateRangeSelect.addEventListener('change', updateDisplayForSelectedRangeUI);
    if (UIElements.domainPrevBtn) UIElements.domainPrevBtn.addEventListener('click', handleDomainPrev);
    if (UIElements.domainNextBtn) UIElements.domainNextBtn.addEventListener('click', handleDomainNext);
    if (UIElements.prevMonthBtn) UIElements.prevMonthBtn.addEventListener('click', handlePrevMonth);
    if (UIElements.nextMonthBtn) UIElements.nextMonthBtn.addEventListener('click', handleNextMonth);
    if (UIElements.chartViewRadios) {
      UIElements.chartViewRadios.forEach((radio) => radio.addEventListener('change', handleChartViewChange));
    }
    if (UIElements.exportCsvBtn) UIElements.exportCsvBtn.addEventListener('click', handleExportCsv);
    // Rule Modal
    if (UIElements.closeEditModalBtn) UIElements.closeEditModalBtn.addEventListener('click', handleCancelEditClick);
    if (UIElements.cancelEditRuleBtn) UIElements.cancelEditRuleBtn.addEventListener('click', handleCancelEditClick);
    if (UIElements.saveRuleChangesBtn) UIElements.saveRuleChangesBtn.addEventListener('click', handleSaveChangesClick);
    if (UIElements.editRuleModal)
      UIElements.editRuleModal.addEventListener('click', (event) => {
        if (event.target === UIElements.editRuleModal) handleCancelEditClick();
      });
    // Assignment Modal
    if (UIElements.closeEditAssignmentModalBtn)
      UIElements.closeEditAssignmentModalBtn.addEventListener('click', handleCancelAssignmentEditClick);
    if (UIElements.cancelEditAssignmentBtn)
      UIElements.cancelEditAssignmentBtn.addEventListener('click', handleCancelAssignmentEditClick);
    if (UIElements.saveAssignmentChangesBtn)
      UIElements.saveAssignmentChangesBtn.addEventListener('click', handleSaveAssignmentClick);
    if (UIElements.editAssignmentModal)
      UIElements.editAssignmentModal.addEventListener('click', (event) => {
        if (event.target === UIElements.editAssignmentModal) handleCancelAssignmentEditClick();
      });
    // Settings
    if (UIElements.idleThresholdSelect)
      UIElements.idleThresholdSelect.addEventListener('change', handleIdleThresholdChange);
    if (UIElements.dataRetentionSelect) {
      UIElements.dataRetentionSelect.addEventListener('change', handleDataRetentionChange);
    } else {
      console.warn('Data retention select element not found, cannot add listener.');
    }
    // Inside setupEventListeners() in options-main.js

    // Data Management Listeners (NEW)
    if (UIElements.exportDataBtn) UIElements.exportDataBtn.addEventListener('click', handleExportData);
    if (UIElements.importDataBtn) UIElements.importDataBtn.addEventListener('click', handleImportDataClick);
    if (UIElements.importFileInput) UIElements.importFileInput.addEventListener('change', handleImportFileChange);

    // *** ADD Listener for Productivity Settings ***
    if (UIElements.productivitySettingsList) {
      // Use 'change' event which works well for radio buttons
      UIElements.productivitySettingsList.addEventListener('change', handleProductivityRatingChange);
    }

    handleRuleTypeChange(); // Initialize rule input display
    console.log('[Options Main] Event listeners setup complete.');
  } catch (e) {
    console.error('[Options Main] Error setting up event listeners:', e);
  }
}

// --- Data Saving Functions ---
function saveCategoriesAndAssignments() {
  return browser.storage.local
    .set({ categories: AppState.categories, categoryAssignments: AppState.categoryAssignments })
    .then(() => {
      console.log('[Options Main] Categories/Assignments saved to storage.');
      return browser.runtime.sendMessage({ action: 'categoriesUpdated' });
    })
    .then((response) =>
      console.log('[Options Main] Background notified (categories):', response ? 'OK' : 'No response/Error')
    )
    .catch((error) => {
      console.error('[Options Main] Error saving categories/assignments or notifying background:', error);
      throw error;
    });
}
function saveRules() {
  return browser.storage.local
    .set({ rules: AppState.rules })
    .then(() => {
      console.log('[Options Main] Rules saved to storage.');
      return browser.runtime.sendMessage({ action: 'rulesUpdated' });
    })
    .then((response) =>
      console.log('[Options Main] Background notified (rules):', response ? 'OK' : 'No response/Error')
    )
    .catch((error) => {
      console.error('[Options Main] Error saving rules or notifying background:', error);
      throw error;
    });
}

// --- CSV Generation/Download ---
function convertDataToCsv(dataObject) {
  if (!dataObject) return '';
  const headers = ['Domain', 'Category', 'Time Spent (HH:MM:SS)', 'Time Spent (Seconds)'];
  let csvString = headers.map(escapeCsvValue).join(',') + '\n';

  const sortedData = Object.entries(dataObject)
    .map(([d, s]) => ({ domain: d, seconds: s }))
    .sort((a, b) => b.seconds - a.seconds);

  // Helper function to get category (avoids calling background utils)
  const getCategory = (domain) => {
    // Direct match
    if (AppState.categoryAssignments.hasOwnProperty(domain)) {
      return AppState.categoryAssignments[domain];
    }
    // Wildcard match
    const parts = domain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const wildcardPattern = '*.' + parts.slice(i).join('.');
      if (AppState.categoryAssignments.hasOwnProperty(wildcardPattern)) {
        return AppState.categoryAssignments[wildcardPattern];
      }
    }
    return 'Other'; // Default category
  };

  sortedData.forEach((item) => {
    const category = getCategory(item.domain);
    const timeHMS = formatTime(item.seconds, true, true); // from options-utils.js
    const row = [item.domain, category, timeHMS, item.seconds];
    csvString += row.map(escapeCsvValue).join(',') + '\n'; // from options-utils.js
  });
  return csvString;
}
function triggerCsvDownload(csvString, filename) {
  try {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('CSV download triggered:', filename);
    } else {
      alert('CSV export might not be fully supported by your browser.');
    }
  } catch (e) {
    console.error('Error triggering CSV download:', e);
    alert('An error occurred while trying to export the data.');
  }
}

// --- Recalculation Logic (REWRITTEN) ---
async function recalculateAndUpdateCategoryTotals(changeDetails) {
  console.log('[Options Main] REBUILDING category totals STARTING', changeDetails);
  try {
    // Fetch the most current domain data directly from storage within this function
    // to ensure we're working with the latest persisted data.
    const result = await browser.storage.local.get(['trackedData', 'dailyDomainData', 'categoryAssignments']);
    const currentTrackedData = result.trackedData || {};
    const currentDailyDomainData = result.dailyDomainData || {};
    const currentAssignments = result.categoryAssignments || {}; // Use fetched assignments

    // Helper function to get category using the current assignments
    const getCategoryForDomain = (domain, assignments) => {
      if (!domain) return 'Other';
      if (assignments.hasOwnProperty(domain)) {
        return assignments[domain];
      }
      const parts = domain.split('.');
      for (let i = 1; i < parts.length; i++) {
        const wildcardPattern = '*.' + parts.slice(i).join('.');
        if (assignments.hasOwnProperty(wildcardPattern)) {
          return assignments[wildcardPattern];
        }
      }
      return 'Other';
    };

    // 1. Rebuild All-Time Category Totals (categoryTimeData)
    const rebuiltCategoryTimeData = {};
    for (const domain in currentTrackedData) {
      const time = currentTrackedData[domain];
      if (time > 0) {
        const category = getCategoryForDomain(domain, currentAssignments);
        rebuiltCategoryTimeData[category] = (rebuiltCategoryTimeData[category] || 0) + time;
      }
    }

    // 2. Rebuild Daily Category Totals (dailyCategoryData)
    const rebuiltDailyCategoryData = {};
    for (const date in currentDailyDomainData) {
      rebuiltDailyCategoryData[date] = {};
      const domainsForDate = currentDailyDomainData[date];
      for (const domain in domainsForDate) {
        const time = domainsForDate[domain];
        if (time > 0) {
          const category = getCategoryForDomain(domain, currentAssignments);
          rebuiltDailyCategoryData[date][category] = (rebuiltDailyCategoryData[date][category] || 0) + time;
        }
      }
      // Clean up dates with no category data after rebuild
      if (Object.keys(rebuiltDailyCategoryData[date]).length === 0) {
        delete rebuiltDailyCategoryData[date];
      }
    }

    // 3. Save the rebuilt data
    console.log('[Recalc] Saving REBUILT category totals...');
    await browser.storage.local.set({
      categoryTimeData: rebuiltCategoryTimeData,
      dailyCategoryData: rebuiltDailyCategoryData,
    });

    // 4. Update AppState with the newly saved data
    AppState.categoryTimeData = rebuiltCategoryTimeData;
    AppState.dailyCategoryData = rebuiltDailyCategoryData;
    // AppState.trackedData and AppState.dailyDomainData were already up-to-date
    // AppState.categoryAssignments was updated before calling this function

    console.log('[Recalc] Category totals rebuilt and saved.');
  } catch (error) {
    console.error('[Options Main] Error during category recalculation (rebuild):', error);
    alert('An error occurred while recalculating category totals.');
    // Consider a full reload as a fallback
    // loadAllData();
  } finally {
    console.log('[Options Main] REBUILDING category totals FINISHED');
    // The UI update should happen *after* this function completes in the calling handler
  }
}

// Add this function to options-main.js

function displayProductivityScore(scoreData, periodLabel = 'Selected Period', isError = false) {
  // Check if UI elements exist (using UIElements from options-state.js)
  if (!UIElements.productivityScoreValue || !UIElements.productivityScoreLabel) {
    console.warn('Productivity score UI elements not found in Options.');
    return;
  }

  if (isError || !scoreData) {
    UIElements.productivityScoreValue.textContent = 'Error';
    UIElements.productivityScoreLabel.textContent = `Focus Score (${periodLabel})`;
    UIElements.productivityScoreValue.className = 'score-value'; // Reset class
    return;
  }

  // Display the score
  UIElements.productivityScoreValue.textContent = `${scoreData.score}%`;
  UIElements.productivityScoreLabel.textContent = `Focus Score (${periodLabel})`; // Update label with period

  // Add visual indicator class based on score (Optional)
  UIElements.productivityScoreValue.classList.remove('score-low', 'score-medium', 'score-high');
  if (scoreData.score < 40) {
    UIElements.productivityScoreValue.classList.add('score-low');
  } else if (scoreData.score < 70) {
    UIElements.productivityScoreValue.classList.add('score-medium');
  } else {
    UIElements.productivityScoreValue.classList.add('score-high');
  }
}

console.log('[System] options-main.js loaded (v0.8.1 - Recalculation Fix)');
