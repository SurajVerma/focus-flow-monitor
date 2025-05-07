// options/options-main.js (v0.8.3 - Block Page Customization - User's Base Corrected)

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Options Main] DOMContentLoaded');
  // Ensure UI elements are queried and available before proceeding
  if (!queryUIElements()) {
    // From options-state.js
    console.error('Failed to initialize UI elements. Aborting setup.');
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML =
        '<p style="color: red; text-align: center; padding: 20px;">Error: Could not load page elements. Please try refreshing.</p>';
    }
    return;
  }
  try {
    // Set the initial state of the chart view radio button
    const defaultChartView = AppState.currentChartViewMode || 'domain';
    const radioToCheck = document.querySelector(`input[name="chartView"][value="${defaultChartView}"]`);
    if (radioToCheck) {
      radioToCheck.checked = true;
    } else {
      const fallback = document.querySelector('input[name="chartView"][value="domain"]');
      if (fallback) fallback.checked = true;
    }
  } catch (e) {
    console.error('Error setting initial chart view radio button:', e);
  }
  loadAllData(); // Load all settings and tracking data
  setupEventListeners(); // Setup all event listeners for the options page
  console.log("Options Main script initialized (v0.8.3 - Block Page Customization - User's Base Corrected).");
});

// --- Data Loading ---
function loadAllData() {
  console.log('[Options Main] loadAllData starting...');
  // Define all storage keys that need to be loaded
  const keysToLoad = [
    'trackedData',
    'categoryTimeData',
    'categories',
    'categoryAssignments',
    'rules',
    'dailyDomainData',
    'dailyCategoryData',
    'hourlyData',
    STORAGE_KEY_IDLE_THRESHOLD, // From options-state.js
    STORAGE_KEY_DATA_RETENTION_DAYS, // From options-state.js
    STORAGE_KEY_PRODUCTIVITY_RATINGS, // From options-state.js
    // NEW: Add block page customization storage keys (from options-state.js)
    STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
    STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
    STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
    STORAGE_KEY_BLOCK_PAGE_SHOW_URL,
    STORAGE_KEY_BLOCK_PAGE_SHOW_REASON,
    STORAGE_KEY_BLOCK_PAGE_SHOW_RULE,
    STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
    STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
    STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE,
    STORAGE_KEY_BLOCK_PAGE_USER_QUOTES,
  ];

  browser.storage.local
    .get(keysToLoad)
    .then((result) => {
      console.log('[Options Main] Data loaded from storage.');
      try {
        // Update AppState for existing data, providing defaults if data is missing
        AppState.trackedData = result.trackedData || {};
        AppState.categoryTimeData = result.categoryTimeData || {};
        AppState.dailyDomainData = result.dailyDomainData || {};
        AppState.dailyCategoryData = result.dailyCategoryData || {};
        AppState.hourlyData = result.hourlyData || {};
        AppState.categories = result.categories || ['Other'];
        AppState.categoryProductivityRatings = result[STORAGE_KEY_PRODUCTIVITY_RATINGS] || {};
        if (!AppState.categories.includes('Other')) {
          AppState.categories.push('Other');
        }
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

        // --- NEW: Load and apply Block Page Customization settings ---
        AppState.blockPageCustomHeading = result[STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING] || '';
        AppState.blockPageCustomMessage = result[STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE] || '';
        AppState.blockPageCustomButtonText = result[STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT] || '';

        AppState.blockPageShowUrl =
          result[STORAGE_KEY_BLOCK_PAGE_SHOW_URL] !== undefined ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_URL] : true;
        AppState.blockPageShowReason =
          result[STORAGE_KEY_BLOCK_PAGE_SHOW_REASON] !== undefined ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_REASON] : true;
        AppState.blockPageShowRule =
          result[STORAGE_KEY_BLOCK_PAGE_SHOW_RULE] !== undefined ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_RULE] : true;
        AppState.blockPageShowLimitInfo =
          result[STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO] !== undefined
            ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO]
            : true;
        AppState.blockPageShowScheduleInfo =
          result[STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO] !== undefined
            ? result[STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO]
            : true;
        AppState.blockPageShowQuote = result[STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE] || false;
        AppState.blockPageUserQuotes = Array.isArray(result[STORAGE_KEY_BLOCK_PAGE_USER_QUOTES])
          ? result[STORAGE_KEY_BLOCK_PAGE_USER_QUOTES]
          : [];

        // Populate UI elements with loaded block page settings
        if (UIElements.blockPageCustomHeadingInput)
          UIElements.blockPageCustomHeadingInput.value = AppState.blockPageCustomHeading;
        if (UIElements.blockPageCustomMessageTextarea)
          UIElements.blockPageCustomMessageTextarea.value = AppState.blockPageCustomMessage;
        if (UIElements.blockPageCustomButtonTextInput)
          UIElements.blockPageCustomButtonTextInput.value = AppState.blockPageCustomButtonText;

        if (UIElements.blockPageShowUrlCheckbox)
          UIElements.blockPageShowUrlCheckbox.checked = AppState.blockPageShowUrl;
        if (UIElements.blockPageShowReasonCheckbox)
          UIElements.blockPageShowReasonCheckbox.checked = AppState.blockPageShowReason;
        if (UIElements.blockPageShowRuleCheckbox)
          UIElements.blockPageShowRuleCheckbox.checked = AppState.blockPageShowRule;
        if (UIElements.blockPageShowLimitInfoCheckbox)
          UIElements.blockPageShowLimitInfoCheckbox.checked = AppState.blockPageShowLimitInfo;
        if (UIElements.blockPageShowScheduleInfoCheckbox)
          UIElements.blockPageShowScheduleInfoCheckbox.checked = AppState.blockPageShowScheduleInfo;

        if (UIElements.blockPageShowQuoteCheckbox) {
          UIElements.blockPageShowQuoteCheckbox.checked = AppState.blockPageShowQuote;
          if (UIElements.blockPageUserQuotesContainer) {
            UIElements.blockPageUserQuotesContainer.style.display = AppState.blockPageShowQuote ? 'block' : 'none';
          }
        }
        if (UIElements.blockPageUserQuotesTextarea)
          UIElements.blockPageUserQuotesTextarea.value = AppState.blockPageUserQuotes.join('\n');
        // --- END NEW ---

        // Initial UI Population for other sections
        populateCategoryList(); // from options-ui.js
        populateCategorySelect(); // from options-ui.js
        populateAssignmentList(); // from options-ui.js
        populateRuleCategorySelect(); // from options-ui.js
        populateRuleList(); // from options-ui.js
        populateProductivitySettings(); // from options-ui.js
        renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth()); // from options-ui.js
        updateDisplayForSelectedRangeUI(); // Defined below
        highlightSelectedCalendarDay(AppState.selectedDateStr); // from options-ui.js
      } catch (processingError) {
        console.error(
          '[Options Main] Error during data processing/UI update after loading from storage!',
          processingError
        );
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
        clearChartOnError('Error processing data'); // from options-ui.js
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
      clearChartOnError('Failed to load data'); // from options-ui.js
    });
}

// --- UI Update Wrappers ---
function updateDisplayForSelectedRangeUI() {
  if (!UIElements.dateRangeSelect) {
    console.warn('Date range select element not found.');
    return;
  }
  let selectedRange = UIElements.dateRangeSelect.value;
  const loader = document.getElementById('statsLoader');
  const dashboard = document.querySelector('.stats-dashboard');

  let dataFetchKey = selectedRange;
  let displayLabelKey = selectedRange;

  if (selectedRange === '' && AppState.selectedDateStr) {
    dataFetchKey = AppState.selectedDateStr;
    displayLabelKey = formatDisplayDate(AppState.selectedDateStr); // from options-utils.js
  } else if (selectedRange === '') {
    dataFetchKey = 'today';
    displayLabelKey = 'Today';
    if (UIElements.dateRangeSelect) UIElements.dateRangeSelect.value = 'today';
  }

  const showLoader = ['week', 'month', 'all'].includes(dataFetchKey);

  if (showLoader && loader) {
    loader.style.display = 'block';
    if (dashboard) dashboard.style.visibility = 'hidden';
  } else if (loader) {
    loader.style.display = 'none';
  }

  setTimeout(() => {
    let domainData = {},
      categoryData = {},
      label = `Error (${displayLabelKey || dataFetchKey})`;
    try {
      const isSpecificDateFetch = /^\d{4}-\d{2}-\d{2}$/.test(dataFetchKey);
      const rangeData = getFilteredDataForRange(dataFetchKey, isSpecificDateFetch); // Defined below
      domainData = rangeData.domainData;
      categoryData = rangeData.categoryData;
      label = isSpecificDateFetch ? displayLabelKey : rangeData.label;

      if (dataFetchKey === 'today' && !isSpecificDateFetch) {
        AppState.selectedDateStr = getCurrentDateString(); // from options-utils.js
        highlightSelectedCalendarDay(AppState.selectedDateStr); // from options-ui.js
      }

      updateStatsDisplay(domainData, categoryData, label, AppState.selectedDateStr); // Defined below
    } catch (e) {
      console.error(`Error processing range ${dataFetchKey}:`, e);
      updateStatsDisplay({}, {}, label);
    } finally {
      if (loader) loader.style.display = 'none';
      if (dashboard) dashboard.style.visibility = 'visible';
    }
  }, 10);
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

  displayDomainTime(itemsToShow); // from options-ui.js

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
    console.log(
      `[Options Main] updateStatsDisplay called for label: ${label}, chartDateStr for chart: ${chartDateStr}`
    );

    const currentDomainData = domainData || {};
    const currentCategoryData = categoryData || {};

    if (UIElements.statsPeriodSpans) {
      UIElements.statsPeriodSpans.forEach((span) => (span.textContent = label));
    }

    AppState.fullDomainDataSorted = Object.entries(currentDomainData)
      .map(([d, t]) => ({ domain: d, time: t }))
      .sort((a, b) => b.time - a.time);
    AppState.domainCurrentPage = 1;
    updateDomainDisplayAndPagination();

    displayCategoryTime(currentCategoryData); // from options-ui.js

    try {
      const scoreData = calculateFocusScore(currentCategoryData, AppState.categoryProductivityRatings); // from options-utils.js
      displayProductivityScore(scoreData, label); // Display the score
      console.log(`[Options Main] Focus score calculated for "${label}": ${scoreData?.score}%`);
    } catch (scoreError) {
      console.error(`[Options Main] Error calculating focus score for label "${label}":`, scoreError);
      displayProductivityScore(null, label, true);
    }

    const chartDataView = AppState.currentChartViewMode === 'domain' ? currentDomainData : currentCategoryData;
    const chartLabelForRender = label;

    const hasSignificantData = Object.values(chartDataView).some((time) => time > 0.1);

    if (hasSignificantData) {
      renderChart(chartDataView, chartLabelForRender, AppState.currentChartViewMode); // from options-ui.js
    } else {
      clearChartOnError(`No significant data for ${chartLabelForRender}`); // from options-ui.js
    }

    if (UIElements.chartTitleElement) {
      UIElements.chartTitleElement.textContent = `Usage Chart (${chartLabelForRender})`;
    }

    console.log(`[Options Main] Stats display updated for label: ${label}`);
  } catch (error) {
    console.error(`[Options Main] Error during updateStatsDisplay for label "${label}":`, error);
    displayCategoryTime({});
    AppState.fullDomainDataSorted = [];
    updateDomainDisplayAndPagination();
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

  if (UIElements.statsPeriodSpans) {
    UIElements.statsPeriodSpans.forEach((span) => (span.textContent = displayDateLabel));
  }
  if (UIElements.categoryTimeList) {
    UIElements.categoryTimeList.replaceChildren();
    const li = document.createElement('li');
    li.textContent = noDataMessage;
    li.style.textAlign = 'center';
    li.style.color = 'var(--text-color-muted)';
    UIElements.categoryTimeList.appendChild(li);
  }
  if (UIElements.detailedTimeList) {
    UIElements.detailedTimeList.replaceChildren();
    const li = document.createElement('li');
    li.textContent = noDataMessage;
    li.style.textAlign = 'center';
    li.style.color = 'var(--text-color-muted)';
    UIElements.detailedTimeList.appendChild(li);
  }
  if (UIElements.domainPaginationDiv) {
    UIElements.domainPaginationDiv.style.display = 'none';
  }
  AppState.fullDomainDataSorted = [];

  if (UIElements.productivityScoreLabel) {
    UIElements.productivityScoreLabel.textContent = `Focus Score (${displayDateLabel})`;
  }
  if (UIElements.productivityScoreValue) {
    UIElements.productivityScoreValue.textContent = 'N/A';
    UIElements.productivityScoreValue.className = 'score-value';
  }
  clearChartOnError(noDataMessage); // from options-ui.js
  if (UIElements.chartTitleElement) {
    UIElements.chartTitleElement.textContent = `Usage Chart (${displayDateLabel})`;
  }
}

function renderChartForSelectedDateUI() {
  if (!AppState.selectedDateStr) {
    clearChartOnError('Select a date from the calendar.'); // from options-ui.js
    return;
  }
  const data =
    AppState.currentChartViewMode === 'domain'
      ? AppState.dailyDomainData[AppState.selectedDateStr] || {}
      : AppState.dailyCategoryData[AppState.selectedDateStr] || {};

  const displayDate = formatDisplayDate(AppState.selectedDateStr); // from options-utils.js
  renderChart(data, displayDate, AppState.currentChartViewMode); // from options-ui.js

  if (UIElements.chartTitleElement) {
    UIElements.chartTitleElement.textContent = `Usage Chart (${displayDate})`;
  }
}

// --- Get Filtered Data ---
function getFilteredDataForRange(range, isSpecificDate = false) {
  let initialDomainData = {};
  let initialCategoryData = {};
  let mergedDomainData = {};
  let periodLabel = 'All Time';
  const today = new Date();

  try {
    if (isSpecificDate && /^\d{4}-\d{2}-\d{2}$/.test(range)) {
      initialDomainData = AppState.dailyDomainData[range] || {};
      initialCategoryData = AppState.dailyCategoryData[range] || {};
      periodLabel = formatDisplayDate(range); // from options-utils.js
    } else if (range === 'today') {
      const todayStr = formatDate(today); // from options-utils.js
      initialDomainData = AppState.dailyDomainData[todayStr] || {};
      initialCategoryData = AppState.dailyCategoryData[todayStr] || {};
      periodLabel = 'Today';
    } else if (range === 'week') {
      periodLabel = 'This Week';
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = formatDate(date);
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
      const dIM = today.getDate();
      for (let day = 1; day <= dIM; day++) {
        const date = new Date(y, m, day);
        const dateStr = formatDate(date);
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
        initialDomainData = {};
        initialCategoryData = {};
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
  } catch (filterError) {
    console.error(`Error filtering/merging for range "${range}":`, filterError);
    periodLabel = `Error (${range})`;
    return { domainData: {}, categoryData: {}, label: periodLabel };
  }
  return { domainData: mergedDomainData, categoryData: initialCategoryData, label: periodLabel };
}

// --- NEW: Handlers for Block Page Customization ---
// These functions will handle saving the settings when they are changed.
function handleBlockPageSettingChange(storageKey, value) {
  browser.storage.local
    .set({ [storageKey]: value })
    .then(() => console.log(`[Options] Saved ${storageKey}:`, value))
    .catch((err) => console.error(`[Options] Error saving ${storageKey}:`, err));
}

function handleBlockPageShowQuoteChange() {
  const isChecked = UIElements.blockPageShowQuoteCheckbox.checked;
  handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE, isChecked);
  // Toggle visibility of the custom quotes textarea
  if (UIElements.blockPageUserQuotesContainer) {
    UIElements.blockPageUserQuotesContainer.style.display = isChecked ? 'block' : 'none';
  }
}

function handleBlockPageUserQuotesChange() {
  const quotesText = UIElements.blockPageUserQuotesTextarea.value;
  // Split by newline, trim whitespace, and filter out empty lines
  const quotesArray = quotesText
    .split('\n')
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_USER_QUOTES, quotesArray);
}
// --- END NEW HANDLERS ---

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

    // Data Management Listeners
    if (UIElements.exportDataBtn) UIElements.exportDataBtn.addEventListener('click', handleExportData);
    if (UIElements.importDataBtn) UIElements.importDataBtn.addEventListener('click', handleImportDataClick);
    if (UIElements.importFileInput) UIElements.importFileInput.addEventListener('change', handleImportFileChange);

    // Productivity Settings Listener
    if (UIElements.productivitySettingsList) {
      UIElements.productivitySettingsList.addEventListener('change', handleProductivityRatingChange);
    }

    // --- NEW: Event Listeners for Block Page Customization ---
    if (UIElements.blockPageCustomHeadingInput) {
      UIElements.blockPageCustomHeadingInput.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
          UIElements.blockPageCustomHeadingInput.value.trim()
        )
      );
    }
    if (UIElements.blockPageCustomMessageTextarea) {
      UIElements.blockPageCustomMessageTextarea.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
          UIElements.blockPageCustomMessageTextarea.value.trim()
        )
      );
    }
    if (UIElements.blockPageCustomButtonTextInput) {
      UIElements.blockPageCustomButtonTextInput.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
          UIElements.blockPageCustomButtonTextInput.value.trim()
        )
      );
    }
    if (UIElements.blockPageShowUrlCheckbox) {
      UIElements.blockPageShowUrlCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_URL, UIElements.blockPageShowUrlCheckbox.checked)
      );
    }
    if (UIElements.blockPageShowReasonCheckbox) {
      UIElements.blockPageShowReasonCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_REASON, UIElements.blockPageShowReasonCheckbox.checked)
      );
    }
    if (UIElements.blockPageShowRuleCheckbox) {
      UIElements.blockPageShowRuleCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_RULE, UIElements.blockPageShowRuleCheckbox.checked)
      );
    }
    if (UIElements.blockPageShowLimitInfoCheckbox) {
      UIElements.blockPageShowLimitInfoCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
          UIElements.blockPageShowLimitInfoCheckbox.checked
        )
      );
    }
    if (UIElements.blockPageShowScheduleInfoCheckbox) {
      UIElements.blockPageShowScheduleInfoCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
          UIElements.blockPageShowScheduleInfoCheckbox.checked
        )
      );
    }
    if (UIElements.blockPageShowQuoteCheckbox) {
      UIElements.blockPageShowQuoteCheckbox.addEventListener('change', handleBlockPageShowQuoteChange);
    }
    if (UIElements.blockPageUserQuotesTextarea) {
      UIElements.blockPageUserQuotesTextarea.addEventListener('change', handleBlockPageUserQuotesChange);
    }
    // --- END NEW Event Listeners ---

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
  let csvString = headers.map(escapeCsvValue).join(',') + '\n'; // escapeCsvValue from options-utils.js

  const sortedData = Object.entries(dataObject)
    .map(([d, s]) => ({ domain: d, seconds: s }))
    .sort((a, b) => b.seconds - a.seconds);

  const getCategory = (domain) => {
    if (AppState.categoryAssignments.hasOwnProperty(domain)) {
      return AppState.categoryAssignments[domain];
    }
    const parts = domain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const wildcardPattern = '*.' + parts.slice(i).join('.');
      if (AppState.categoryAssignments.hasOwnProperty(wildcardPattern)) {
        return AppState.categoryAssignments[wildcardPattern];
      }
    }
    return 'Other';
  };

  sortedData.forEach((item) => {
    const category = getCategory(item.domain);
    const timeHMS = formatTime(item.seconds, true, true); // from options-utils.js
    const row = [item.domain, category, timeHMS, item.seconds];
    csvString += row.map(escapeCsvValue).join(',') + '\n';
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

// --- Recalculation Logic ---
async function recalculateAndUpdateCategoryTotals(changeDetails) {
  console.log('[Options Main] REBUILDING category totals STARTING', changeDetails);
  try {
    const result = await browser.storage.local.get(['trackedData', 'dailyDomainData', 'categoryAssignments']);
    const currentTrackedData = result.trackedData || {};
    const currentDailyDomainData = result.dailyDomainData || {};
    const currentAssignments = AppState.categoryAssignments || {};

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

    const rebuiltCategoryTimeData = {};
    for (const domain in currentTrackedData) {
      const time = currentTrackedData[domain];
      if (time > 0) {
        const category = getCategoryForDomain(domain, currentAssignments);
        rebuiltCategoryTimeData[category] = (rebuiltCategoryTimeData[category] || 0) + time;
      }
    }

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
      if (Object.keys(rebuiltDailyCategoryData[date]).length === 0) {
        delete rebuiltDailyCategoryData[date];
      }
    }

    console.log('[Recalc] Saving REBUILT category totals...');
    await browser.storage.local.set({
      categoryTimeData: rebuiltCategoryTimeData,
      dailyCategoryData: rebuiltDailyCategoryData,
    });

    AppState.categoryTimeData = rebuiltCategoryTimeData;
    AppState.dailyCategoryData = rebuiltDailyCategoryData;

    console.log('[Recalc] Category totals rebuilt and saved.');
  } catch (error) {
    console.error('[Options Main] Error during category recalculation (rebuild):', error);
    alert('An error occurred while recalculating category totals.');
  } finally {
    console.log('[Options Main] REBUILDING category totals FINISHED');
  }
}

function displayProductivityScore(scoreData, periodLabel = 'Selected Period', isError = false) {
  if (!UIElements.productivityScoreValue || !UIElements.productivityScoreLabel) {
    console.warn('Productivity score UI elements not found in Options.');
    return;
  }

  if (isError || !scoreData) {
    UIElements.productivityScoreValue.textContent = 'Error';
    UIElements.productivityScoreLabel.textContent = `Focus Score (${periodLabel})`;
    UIElements.productivityScoreValue.className = 'score-value';
    return;
  }

  UIElements.productivityScoreValue.textContent = `${scoreData.score}%`;
  UIElements.productivityScoreLabel.textContent = `Focus Score (${periodLabel})`;

  UIElements.productivityScoreValue.classList.remove('score-low', 'score-medium', 'score-high');
  if (scoreData.score < 40) {
    UIElements.productivityScoreValue.classList.add('score-low');
  } else if (scoreData.score < 70) {
    UIElements.productivityScoreValue.classList.add('score-medium');
  } else {
    UIElements.productivityScoreValue.classList.add('score-high');
  }
}

console.log("[System] options-main.js loaded (v0.8.3 - Block Page Customization - User's Base Corrected)");
