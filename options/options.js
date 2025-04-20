// options.js (v19b - Cleaned & innerHTML fixed v2)
// Contains: Category Mgmt, Assignment Mgmt, Blocking/Limit Rule Mgmt UI, Date Filtering, Domain Pagination, Chart, Calendar View

// --- Global variables ---
let categories = ['Other'];
let categoryAssignments = {};
let trackedData = {}; // All-time domain totals
let categoryTimeData = {}; // All-time category totals
let dailyDomainData = {}; // Daily domain data {'YYYY-MM-DD': {...}}
let dailyCategoryData = {}; // Daily category data {'YYYY-MM-DD': {...}}
let hourlyData = {}; // Added in v14 background
let rules = []; // Combined list for block and limit rules
let timeChart = null; // Chart.js instance
let domainCurrentPage = 1;
const domainItemsPerPage = 10; // User preference
let fullDomainDataSorted = [];
let calendarDate = new Date(); // Tracks the month/year being displayed

// --- UI Element References ---
let detailedTimeList, categoryTimeList, categoryList, assignmentList, ruleList;
let newCategoryNameInput, addCategoryBtn, domainPatternInput, categorySelect, assignDomainBtn;
let ruleTypeSelect, rulePatternInput, ruleCategorySelect, ruleLimitInput, ruleUnitSelect, addRuleBtn;
let timeLimitInputDiv;
let dateRangeSelect;
let statsPeriodSpans;
let domainPaginationDiv, domainPrevBtn, domainNextBtn, domainPageInfo;
let calendarGrid, prevMonthBtn, nextMonthBtn, currentMonthYearSpan;

// --- Helper Functions ---
function formatTime(seconds, includeSeconds = true) {
  if (seconds < 0) seconds = 0;
  if (seconds < 60 && includeSeconds) return `${seconds}s`;
  if (seconds < 60 && !includeSeconds) return `<1m`;
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  if (hours === 0 && remainingSeconds > 0 && includeSeconds) parts.push(`${remainingSeconds}s`);
  if (hours === 0 && remainingMinutes === 0 && remainingSeconds > 0 && includeSeconds)
    parts.push(`${remainingSeconds}s`);
  if (parts.length === 0) return includeSeconds ? '0s' : '<1m';
  return parts.join(' ');
}
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getCurrentDateString() {
  return formatDate(new Date());
}

// --- Data Loading & Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Options v19b] DOMContentLoaded');
  try {
    // Get all element references
    detailedTimeList = document.getElementById('detailedTimeList');
    categoryTimeList = document.getElementById('categoryTimeList');
    categoryList = document.getElementById('categoryList');
    assignmentList = document.getElementById('assignmentList');
    ruleList = document.getElementById('ruleList');
    newCategoryNameInput = document.getElementById('newCategoryName');
    addCategoryBtn = document.getElementById('addCategoryBtn');
    domainPatternInput = document.getElementById('domainPattern');
    categorySelect = document.getElementById('categorySelect');
    assignDomainBtn = document.getElementById('assignDomainBtn');
    ruleTypeSelect = document.getElementById('ruleTypeSelect');
    rulePatternInput = document.getElementById('rulePatternInput');
    ruleCategorySelect = document.getElementById('ruleCategorySelect');
    ruleLimitInput = document.getElementById('ruleLimitInput');
    ruleUnitSelect = document.getElementById('ruleUnitSelect');
    addRuleBtn = document.getElementById('addRuleBtn');
    timeLimitInputDiv = document.querySelector('.time-limit-input');
    dateRangeSelect = document.getElementById('dateRangeSelect');
    statsPeriodSpans = document.querySelectorAll('.stats-period');
    domainPaginationDiv = document.getElementById('domainPagination');
    domainPrevBtn = document.getElementById('domainPrevBtn');
    domainNextBtn = document.getElementById('domainNextBtn');
    domainPageInfo = document.getElementById('domainPageInfo');
    calendarGrid = document.getElementById('calendarGrid');
    prevMonthBtn = document.getElementById('prevMonthBtn');
    nextMonthBtn = document.getElementById('nextMonthBtn');
    currentMonthYearSpan = document.getElementById('currentMonthYear');

    console.log('[Options v19b] UI element references obtained.');
    if (!domainPaginationDiv || !domainPrevBtn || !domainNextBtn || !domainPageInfo) {
      console.warn('[Options v19b] Warning: One or more pagination UI elements might be missing!'); // Keep as warning
    }
  } catch (e) {
    console.error('[Options v19b] Error getting UI elements!', e);
    return;
  }

  loadAllData();
  setupEventListeners();
  console.log('Options script loaded (v19b).');
});

function loadAllData() {
  console.log('[Options v19b] loadAllData starting...');
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
    ])
    .then((result) => {
      console.log('[Options v19b] Data loaded from storage.');
      try {
        // Load all data...
        trackedData = result.trackedData || {};
        categoryTimeData = result.categoryTimeData || {};
        dailyDomainData = result.dailyDomainData || {};
        dailyCategoryData = result.dailyCategoryData || {};
        hourlyData = result.hourlyData || {};
        categories = result.categories || ['Other'];
        if (!categories.includes('Other')) categories.push('Other');
        categoryAssignments = result.categoryAssignments || {};
        rules = result.rules || [];

        // Populate static lists/dropdowns first
        populateCategoryList();
        populateCategorySelect();
        populateAssignmentList();
        populateRuleCategorySelect();
        populateRuleList();
        console.log('[Options v19b] Static lists populated.');

        // Render Calendar
        try {
          console.log('[Options v19b] Rendering calendar...');
          renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth());
          console.log('[Options v19b] Calendar render attempted.');
        } catch (calendarError) {
          console.error('Error during renderCalendar', calendarError);
          // FIX for line 330 (previously 321): Use textContent or DOM manipulation
          if (calendarGrid) {
            // Create a paragraph element
            const errorP = document.createElement('p');
            errorP.textContent = 'Error rendering calendar. Check console.';
            // Apply styles directly
            errorP.style.color = 'red';
            errorP.style.textAlign = 'center';
            // Clear previous content and add the new paragraph
            // Use replaceChildren() instead of innerHTML = ''
            calendarGrid.replaceChildren();
            calendarGrid.appendChild(errorP);
          }
        }

        // Update other displays based on default filter
        console.log('[Options v19b] Updating display for selected range (initial)...');
        updateDisplayForSelectedRange();
        console.log('[Options v19b] Initial display updated.');
      } catch (processingError) {
        console.error('[Options v19b] Error during data processing/UI update!', processingError);
      }
    })
    .catch((error) => {
      console.error('[Options v19b] storage.local.get FAILED!', error);
    });
}

// --- Get Filtered Data Functions ---
function getFilteredDataForRange(range) {
  console.log(`\n--- [Filter Debug v19b] START getFilteredDataForRange(range = "${range}") ---`);
  let filteredDomainData = {};
  let filteredCategoryData = {};
  let periodLabel = 'All Time';
  const today = new Date();
  try {
    if (range === 'today') {
      const todayStr = formatDate(today);
      filteredDomainData = dailyDomainData[todayStr] || {};
      filteredCategoryData = dailyCategoryData[todayStr] || {};
      periodLabel = 'Today';
    } else if (range === 'week') {
      periodLabel = 'This Week (Last 7 Days)';
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = formatDate(date);
        const domainsForDate = dailyDomainData[dateStr];
        if (domainsForDate) {
          for (const domain in domainsForDate) {
            filteredDomainData[domain] = (filteredDomainData[domain] || 0) + domainsForDate[domain];
          }
        }
        const categoriesForDate = dailyCategoryData[dateStr];
        if (categoriesForDate) {
          for (const category in categoriesForDate) {
            filteredCategoryData[category] = (filteredCategoryData[category] || 0) + categoriesForDate[category];
          }
        }
      }
    } else if (range === 'month') {
      periodLabel = 'This Month';
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      let loopDay = new Date(firstDayOfMonth);
      let loopCount = 0;
      let todayBoundary = new Date(today);
      todayBoundary.setHours(23, 59, 59, 999);
      while (loopDay.getMonth() === currentMonth && loopDay <= todayBoundary && loopCount < 32) {
        const dateStr = formatDate(loopDay);
        const domainsForDate = dailyDomainData[dateStr];
        if (domainsForDate) {
          for (const domain in domainsForDate) {
            filteredDomainData[domain] = (filteredDomainData[domain] || 0) + domainsForDate[domain];
          }
        }
        const categoriesForDate = dailyCategoryData[dateStr];
        if (categoriesForDate) {
          for (const category in categoriesForDate) {
            filteredCategoryData[category] = (filteredCategoryData[category] || 0) + categoriesForDate[category];
          }
        }
        loopDay.setDate(loopDay.getDate() + 1);
        loopCount++;
      }
      if (loopCount >= 32) console.error('[Options v19b] Loop safety break hit in month filter!');
    } else {
      // 'all'
      filteredDomainData = trackedData || {};
      filteredCategoryData = categoryTimeData || {};
      periodLabel = 'All Time';
    }
  } catch (filterError) {
    console.error(`--- [Filter Debug v19b] ERROR occurred during filtering for range "${range}" ---`, filterError);
    return { domainData: {}, categoryData: {}, label: `Error (${range})` };
  }
  console.log(
    `[Filter Debug v19b] END getFilteredDataForRange. Returning label: "${periodLabel}", Domain keys: ${
      Object.keys(filteredDomainData).length
    }, Category keys: ${Object.keys(filteredCategoryData).length}`
  );
  console.log(`---`);
  return { domainData: filteredDomainData, categoryData: filteredCategoryData, label: periodLabel };
}

// --- Central UI Update Function ---
function updateDisplayForSelectedRange() {
  if (!dateRangeSelect) {
    console.error('[Options v19b] Date range select not found!');
    return;
  }
  const selectedRange = dateRangeSelect.value;
  console.log(`[Options v19b] updateDisplayForSelectedRange called for range: ${selectedRange}`);
  try {
    const { domainData, categoryData, label } = getFilteredDataForRange(selectedRange);

    if (statsPeriodSpans) statsPeriodSpans.forEach((span) => (span.textContent = label));
    else console.warn('[Options v19b] Could not find H2 spans to update period label.');

    fullDomainDataSorted = Object.entries(domainData)
      .map(([domain, time]) => ({ domain, time }))
      .sort((a, b) => b.time - a.time);

    console.log(`[Options v19b] Total sorted domain items for period "${label}": ${fullDomainDataSorted.length}`);

    domainCurrentPage = 1; // Reset to page 1 when the date range changes
    updateDomainDisplayAndPagination(); // Update the list and pagination controls

    displayCategoryTime(categoryData);
    renderChart(domainData, label);

    console.log(`[Options v19b] Display updated for range: ${selectedRange}`);
  } catch (e) {
    console.error(`[Options v19b] Error updating display for range ${selectedRange}:`, e);
    alert('Error updating display.');
  }
}

// --- Pagination Display Update ---
function updateDomainDisplayAndPagination() {
  if (!detailedTimeList || !domainPaginationDiv || !domainPrevBtn || !domainNextBtn || !domainPageInfo) {
    console.error('[Options v19b] Missing elements needed for domain pagination.');
    if (domainPaginationDiv) domainPaginationDiv.style.display = 'none';
    return;
  }

  const totalItems = fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / domainItemsPerPage));

  // Clamp currentPage to valid range
  domainCurrentPage = Math.max(1, Math.min(domainCurrentPage, totalPages));

  const startIndex = (domainCurrentPage - 1) * domainItemsPerPage;
  const endIndex = startIndex + domainItemsPerPage; // slice end index is exclusive
  const itemsToShow = fullDomainDataSorted.slice(startIndex, endIndex);

  displayDomainTime(itemsToShow); // Update the list display

  // Update pagination controls text and state
  domainPageInfo.textContent = `Page ${domainCurrentPage} of ${totalPages}`;

  try {
    domainPrevBtn.disabled = domainCurrentPage <= 1;
    domainNextBtn.disabled = domainCurrentPage >= totalPages;
  } catch (e) {
    console.error('[Options v19b] Error updating pagination button state:', e);
    domainPrevBtn.disabled = true;
    domainNextBtn.disabled = true;
  }

  // Show pagination controls only if needed
  domainPaginationDiv.style.display = totalPages > 1 ? 'flex' : 'none';

  console.log(`[Options v19b] Pagination Controls updated. Total pages: ${totalPages}`);
}

// --- UI Population/Display Functions ---
function displayDomainTime(itemsToDisplay) {
  if (!detailedTimeList) {
    console.error('displayDomainTime: detailedTimeList missing');
    return;
  }
  detailedTimeList.replaceChildren(); // Use replaceChildren to clear
  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    const li = document.createElement('li');
    li.textContent =
      fullDomainDataSorted.length === 0 ? 'No domain data for this period.' : 'No domains to display on this page.';
    detailedTimeList.appendChild(li);
    return;
  }
  itemsToDisplay.forEach((item) => {
    const li = document.createElement('li');
    const domainSpan = document.createElement('span');
    domainSpan.textContent = item.domain;
    domainSpan.className = 'domain';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(item.time);
    timeSpan.className = 'time';
    li.appendChild(domainSpan);
    li.appendChild(timeSpan);
    detailedTimeList.appendChild(li);
  });
}
function displayCategoryTime(dataToDisplay) {
  console.log('[Options v19b] Displaying category time data:', JSON.stringify(dataToDisplay));
  if (!categoryTimeList) {
    console.error('displayCategoryTime: categoryTimeList missing');
    return;
  }
  categoryTimeList.replaceChildren(); // Use replaceChildren to clear
  if (!dataToDisplay || Object.keys(dataToDisplay).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No category data for this period.';
    categoryTimeList.appendChild(li);
    return;
  }
  const sortedData = Object.entries(dataToDisplay)
    .map(([category, time]) => ({ category, time }))
    .sort((a, b) => b.time - a.time);
  console.log('[Options v19b] Sorted category data for display:', sortedData);
  sortedData.forEach((item) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.category;
    nameSpan.className = 'category-name';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(item.time);
    timeSpan.className = 'time';
    li.appendChild(nameSpan);
    li.appendChild(timeSpan);
    categoryTimeList.appendChild(li);
  });
}
function populateCategoryList() {
  if (!categoryList) {
    console.error('populateCategoryList: categoryList missing');
    return;
  }
  categoryList.replaceChildren(); // Use replaceChildren to clear
  if (categories.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No categories defined.';
    categoryList.appendChild(li);
    return;
  }
  categories.forEach((cat) => {
    const li = document.createElement('li');
    li.textContent = cat;
    if (cat !== 'Other') {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.category = cat;
      li.appendChild(deleteBtn);
    }
    categoryList.appendChild(li);
  });
}
function populateCategorySelect() {
  if (!categorySelect) {
    console.error('populateCategorySelect: categorySelect missing');
    return;
  }
  categorySelect.replaceChildren(); // Use replaceChildren to clear
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select Category';
  categorySelect.appendChild(defaultOption);

  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });
}
function populateAssignmentList() {
  if (!assignmentList) {
    console.error('populateAssignmentList: assignmentList missing');
    return;
  }
  assignmentList.replaceChildren(); // Use replaceChildren to clear
  if (Object.keys(categoryAssignments).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No domains assigned yet.';
    assignmentList.appendChild(li);
    return;
  }
  const sortedAssignments = Object.entries(categoryAssignments).sort((a, b) => a[0].localeCompare(b[0]));
  sortedAssignments.forEach(([domain, category]) => {
    const li = document.createElement('li');
    const domainSpan = document.createElement('span');
    domainSpan.textContent = domain;
    domainSpan.className = 'assignment-domain';
    const categorySpan = document.createElement('span');
    categorySpan.textContent = category;
    categorySpan.className = 'assignment-category';
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.domain = domain;
    const controlsDiv = document.createElement('div');
    controlsDiv.appendChild(categorySpan);
    controlsDiv.appendChild(deleteBtn);
    li.appendChild(domainSpan);
    li.appendChild(controlsDiv);
    assignmentList.appendChild(li);
  });
}
function populateRuleCategorySelect() {
  console.log('[Options v19b] populateRuleCategorySelect executing...');
  try {
    if (!ruleCategorySelect) {
      console.error('populateRuleCategorySelect: ruleCategorySelect element reference missing!');
      return;
    }
    ruleCategorySelect.replaceChildren(); // Use replaceChildren to clear
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Category';
    ruleCategorySelect.appendChild(defaultOption);

    categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      ruleCategorySelect.appendChild(option);
    });
  } catch (e) {
    console.error('Error in populateRuleCategorySelect:', e);
  }
}
function populateRuleList() {
  console.log('[Options v19b] populateRuleList: Started. Rules count:', rules ? rules.length : 'null/undefined');
  if (!ruleList) {
    console.error('populateRuleList: ruleList element missing');
    return;
  }
  ruleList.replaceChildren(); // Use replaceChildren to clear

  if (!rules || !Array.isArray(rules)) {
    console.error("[Options v19b] populateRuleList: 'rules' variable is not a valid array!", rules);
    const li = document.createElement('li');
    li.textContent = 'Error: Rule data is invalid.';
    ruleList.appendChild(li);
    return;
  }
  if (rules.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No blocking or limiting rules are currently set.';
    ruleList.appendChild(li);
    console.log('[Options v19b] populateRuleList: No rules to display.');
    return;
  }
  try {
    rules.forEach((rule, index) => {
      if (!rule || typeof rule.type !== 'string' || typeof rule.value !== 'string') {
        console.warn(`[Options v19b] populateRuleList: Skipping invalid rule at index ${index}:`, rule);
        return;
      }
      const li = document.createElement('li');
      const infoSpan = document.createElement('span');
      infoSpan.className = 'rule-info';

      let typeText = '',
        targetText = rule.value;
      // Determine detailText content based on rule type (no direct HTML assignment yet)
      let detailContent = '';
      let detailClass = '';

      if (rule.type === 'block-url') {
        typeText = 'Block URL';
        detailContent = '(Blocked)';
        detailClass = 'rule-blocked';
      } else if (rule.type === 'limit-url') {
        typeText = 'Limit URL';
        detailContent = `(Limit: ${formatTime(rule.limitSeconds || 0, false)}/day)`;
        detailClass = 'rule-limit';
      } else if (rule.type === 'block-category') {
        typeText = 'Block Cat';
        detailContent = '(Blocked)';
        detailClass = 'rule-blocked';
      } else if (rule.type === 'limit-category') {
        typeText = 'Limit Cat';
        detailContent = `(Limit: ${formatTime(rule.limitSeconds || 0, false)}/day)`;
        detailClass = 'rule-limit';
      } else {
        typeText = 'Unknown Rule';
        targetText = JSON.stringify(rule.value); // Safely display unknown rule value
      }

      // FIX for line 524 (previously 494): Use DOM manipulation instead of innerHTML
      // Clear existing content first using replaceChildren() for safety
      infoSpan.replaceChildren();

      // Create and append the type span
      const typeSpan = document.createElement('span');
      typeSpan.className = 'rule-type';
      typeSpan.textContent = `${typeText}:`;
      infoSpan.appendChild(typeSpan);
      infoSpan.appendChild(document.createTextNode(' ')); // Add space

      // Create and append the target span
      const targetSpan = document.createElement('span');
      targetSpan.className = 'rule-target';
      targetSpan.textContent = targetText;
      infoSpan.appendChild(targetSpan);
      infoSpan.appendChild(document.createTextNode(' ')); // Add space

      // Create and append the detail span *only if* there's content
      if (detailClass && detailContent) {
        const detailSpan = document.createElement('span');
        detailSpan.className = detailClass;
        detailSpan.textContent = detailContent;
        infoSpan.appendChild(detailSpan);
      }
      // END FIX for line 524

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.ruleIndex = index;
      li.appendChild(infoSpan);
      li.appendChild(deleteBtn);
      ruleList.appendChild(li);
    });
    console.log(`[Options v19b] populateRuleList: Successfully populated ${rules.length} rules.`);
  } catch (e) {
    console.error('Error inside populateRuleList loop:', e);
    const li = document.createElement('li');
    li.textContent = 'Error displaying rules! Check console.';
    ruleList.appendChild(li);
  }
}

// --- Calendar Rendering Function ---
function renderCalendar(year, month) {
  console.log(`[Calendar] Rendering for ${year}-${month + 1}`);
  if (!calendarGrid || !currentMonthYearSpan) {
    console.error('Cannot render calendar - grid or month/year span not found.');
    return;
  }

  const todayStr = getCurrentDateString();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  currentMonthYearSpan.textContent = `${monthNames[month]} ${year}`;

  // Keep headers, clear rest
  const headers = Array.from(calendarGrid.querySelectorAll('.calendar-header'));
  // Use replaceChildren() for safety after saving headers
  const childrenToRemove = Array.from(calendarGrid.children).filter((el) => !el.classList.contains('calendar-header'));
  childrenToRemove.forEach((child) => calendarGrid.removeChild(child));

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun

  // Create fragment to batch appends
  const fragment = document.createDocumentFragment();

  // Add empty cells before the 1st
  for (let i = 0; i < startingDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('calendar-day', 'empty');
    fragment.appendChild(emptyCell);
  }

  // Add cells for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('calendar-day');
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);

    if (dateStr === todayStr) {
      dayCell.classList.add('today');
    }

    const dayNumberSpan = document.createElement('span');
    dayNumberSpan.classList.add('day-number');
    dayNumberSpan.textContent = day;
    dayCell.appendChild(dayNumberSpan);

    const dailyTotalSeconds = Object.values(dailyDomainData[dateStr] || {}).reduce((sum, time) => sum + time, 0);
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('day-time');
    if (dailyTotalSeconds > 0) {
      timeSpan.textContent = formatTime(dailyTotalSeconds, false); // Show compact time
    } else {
      timeSpan.textContent = '-';
      timeSpan.classList.add('no-data');
    }
    dayCell.appendChild(timeSpan);

    fragment.appendChild(dayCell);
  }
  calendarGrid.appendChild(fragment); // Append all at once
  console.log(`[Calendar] Render complete for ${year}-${month + 1}`);
}

// --- Event Listener Setup ---
function setupEventListeners() {
  try {
    // Existing listeners...
    if (addCategoryBtn) addCategoryBtn.addEventListener('click', handleAddCategory);
    if (assignDomainBtn) assignDomainBtn.addEventListener('click', handleAssignDomain);
    if (categoryList) categoryList.addEventListener('click', handleDeleteCategory);
    if (assignmentList) assignmentList.addEventListener('click', handleDeleteAssignment);
    if (ruleTypeSelect) ruleTypeSelect.addEventListener('change', handleRuleTypeChange);
    if (addRuleBtn) addRuleBtn.addEventListener('click', handleAddRule);
    if (ruleList) ruleList.addEventListener('click', handleDeleteRule);
    if (dateRangeSelect) dateRangeSelect.addEventListener('change', updateDisplayForSelectedRange);

    // Pagination Listeners
    if (domainPrevBtn) {
      domainPrevBtn.addEventListener('click', handleDomainPrev);
    } else {
      console.error('[Options v19b] Prev button not found for listener.');
    }
    if (domainNextBtn) {
      domainNextBtn.addEventListener('click', handleDomainNext);
    } else {
      console.error('[Options v19b] Next button not found for listener.');
    }

    // Calendar Listeners
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', handlePrevMonth);
    else console.warn('[Options v19b] prevMonthBtn missing');
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', handleNextMonth);
    else console.warn('[Options v19b] nextMonthBtn missing');

    handleRuleTypeChange(); // Initial setup
    console.log('[Options v19b] Event listeners set up.');
  } catch (e) {
    console.error('[Options v19b] Error setting up event listeners:', e);
  }
}

// --- Event Handlers ---
function handleAddCategory() {
  try {
    const name = newCategoryNameInput.value.trim();
    if (!name) {
      alert('Please enter a category name.');
      return;
    }
    if (categories.some((cat) => cat.toLowerCase() === name.toLowerCase())) {
      alert(`Category "${name}" already exists.`);
      return;
    }
    categories.push(name);
    categories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    newCategoryNameInput.value = '';
    saveCategoriesAndAssignments();
    populateCategoryList();
    populateCategorySelect();
    populateRuleCategorySelect();
  } catch (e) {
    console.error('Error adding category:', e);
    alert('Failed to add category.');
  }
}
function handleAssignDomain() {
  try {
    const domain = domainPatternInput.value.trim();
    const category = categorySelect.value;
    if (!domain) {
      alert('Please enter a domain pattern.');
      return;
    }
    if (!category) {
      alert('Please select a category.');
      return;
    }
    categoryAssignments[domain] = category;
    domainPatternInput.value = '';
    categorySelect.value = '';
    saveCategoriesAndAssignments();
    populateAssignmentList();
  } catch (e) {
    console.error('Error assigning domain:', e);
    alert('Failed to assign domain.');
  }
}
function handleDeleteCategory(event) {
  try {
    if (event.target.classList.contains('delete-btn') && event.target.closest('#categoryList')) {
      const categoryToDelete = event.target.dataset.category;
      if (categoryToDelete && categoryToDelete !== 'Other') {
        if (
          confirm(
            `DELETE CATEGORY?\n"${categoryToDelete}"\nThis also removes related domain assignments and potentially rules.`
          )
        ) {
          categories = categories.filter((cat) => cat !== categoryToDelete);
          let assignmentsChanged = false;
          let rulesChanged = false;
          for (const domain in categoryAssignments) {
            if (categoryAssignments[domain] === categoryToDelete) {
              delete categoryAssignments[domain];
              assignmentsChanged = true;
            }
          }
          const originalRulesLength = rules.length;
          rules = rules.filter((rule) => !(rule.type.includes('-category') && rule.value === categoryToDelete));
          if (rules.length !== originalRulesLength) rulesChanged = true;
          saveCategoriesAndAssignments();
          if (rulesChanged) saveRules();
          populateCategoryList();
          populateCategorySelect();
          populateRuleCategorySelect();
          if (assignmentsChanged) populateAssignmentList();
          if (rulesChanged) populateRuleList();
        }
      }
    }
  } catch (e) {
    console.error('Error deleting category:', e);
  }
}
function handleDeleteAssignment(event) {
  try {
    if (event.target.classList.contains('delete-btn') && event.target.closest('#assignmentList')) {
      const domainToDelete = event.target.dataset.domain;
      if (domainToDelete && categoryAssignments.hasOwnProperty(domainToDelete)) {
        if (confirm(`DELETE ASSIGNMENT?\n"${domainToDelete}"`)) {
          delete categoryAssignments[domainToDelete];
          saveCategoriesAndAssignments();
          populateAssignmentList();
        }
      }
    }
  } catch (e) {
    console.error('Error deleting assignment:', e);
  }
}
function handleRuleTypeChange() {
  try {
    if (!ruleTypeSelect || !rulePatternInput || !ruleCategorySelect || !timeLimitInputDiv) return;
    const selectedType = ruleTypeSelect.value;
    rulePatternInput.style.display = selectedType.includes('-url') ? '' : 'none';
    ruleCategorySelect.style.display = selectedType.includes('-category') ? '' : 'none';
    timeLimitInputDiv.style.display = selectedType.includes('limit-') ? '' : 'none';
    if (selectedType.includes('-url')) rulePatternInput.placeholder = 'e.g., badsite.com or *.social.com';
  } catch (e) {
    console.error('Error changing rule type view:', e);
  }
}
function handleAddRule() {
  try {
    if (!ruleTypeSelect || !rulePatternInput || !ruleCategorySelect || !ruleLimitInput || !ruleUnitSelect) return;
    const type = ruleTypeSelect.value;
    let value = '';
    let limitSeconds = null;
    if (type.includes('-url')) {
      value = rulePatternInput.value.trim();
      if (!value) {
        alert('Please enter a URL or pattern.');
        return;
      }
    } else if (type.includes('-category')) {
      value = ruleCategorySelect.value;
      if (!value) {
        alert('Please select a category.');
        return;
      }
    } else {
      return;
    }
    if (type.includes('limit-')) {
      const limitValue = parseInt(ruleLimitInput.value, 10);
      const unit = ruleUnitSelect.value;
      if (isNaN(limitValue) || limitValue <= 0) {
        alert('Please enter a valid positive time limit.');
        return;
      }
      limitSeconds = unit === 'hours' ? limitValue * 3600 : limitValue * 60;
    }
    const exists = rules.some((rule) => rule.type === type && rule.value.toLowerCase() === value.toLowerCase());
    if (exists) {
      alert(`A rule for this exact type and target ("${value}") already exists.`);
      return;
    }
    const newRule = { type, value };
    if (limitSeconds !== null) newRule.limitSeconds = limitSeconds;
    rules.push(newRule);
    console.log('[Options v19b] Added rule:', newRule);
    saveRules();
    populateRuleList();
    rulePatternInput.value = '';
    ruleCategorySelect.value = '';
    ruleLimitInput.value = '';
    ruleUnitSelect.value = 'minutes';
  } catch (e) {
    console.error('Error adding rule:', e);
    alert('Failed to add rule.');
  }
}
function handleDeleteRule(event) {
  try {
    if (event.target.classList.contains('delete-btn') && event.target.closest('#ruleList')) {
      const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
      if (!isNaN(ruleIndex) && ruleIndex >= 0 && ruleIndex < rules.length) {
        const ruleToDelete = rules[ruleIndex];
        let confirmMessage = `DELETE RULE?\n\nType: ${ruleToDelete.type}\nTarget: ${ruleToDelete.value}`;
        if (ruleToDelete.limitSeconds !== undefined)
          confirmMessage += `\nLimit: ${formatTime(ruleToDelete.limitSeconds, false)}/day`;
        if (confirm(confirmMessage)) {
          rules.splice(ruleIndex, 1);
          console.log('[Options v19b] Deleted rule at index:', ruleIndex);
          saveRules();
          populateRuleList();
        }
      }
    }
  } catch (e) {
    console.error('Error deleting rule:', e);
  }
}
function handleDomainPrev() {
  if (domainCurrentPage > 1) {
    domainCurrentPage--;
    updateDomainDisplayAndPagination();
  }
}
function handleDomainNext() {
  const totalItems = fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / domainItemsPerPage));
  if (domainCurrentPage < totalPages) {
    domainCurrentPage++;
    updateDomainDisplayAndPagination();
  }
}

// Calendar Navigation Handlers
function handlePrevMonth() {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth());
}
function handleNextMonth() {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth());
}

// --- Data Saving Functions ---
function saveCategoriesAndAssignments() {
  browser.storage.local
    .set({ categories, categoryAssignments })
    .then(() => browser.runtime.sendMessage({ action: 'categoriesUpdated' }))
    .then((response) => console.log('[Options v19b] Bg notified (categories):', response ? 'OK' : 'No response'))
    .catch((error) => {
      console.error('[Options v19b] Error saving categories/assignments:', error);
    });
}
function saveRules() {
  browser.storage.local
    .set({ rules })
    .then(() => browser.runtime.sendMessage({ action: 'rulesUpdated' }))
    .then((response) => console.log('[Options v19b] Bg notified (rules):', response ? 'OK' : 'No response'))
    .catch((error) => {
      console.error('[Options v19b] Error saving rules:', error);
    });
}

// --- Chart Rendering ---
function renderChart(dataToDisplay, periodLabel = 'All Time') {
  if (typeof Chart === 'undefined') {
    console.error('[Options v19b] Chart.js not loaded.');
    clearChartOnError('Chart library not loaded.');
    return;
  }
  const ctx = document.getElementById('timeChartCanvas')?.getContext('2d');
  if (!ctx) {
    console.error('[Options v19b] Canvas element not found.');
    return;
  }
  if (timeChart) {
    timeChart.destroy();
    timeChart = null;
  }
  const domainData = dataToDisplay;
  if (!domainData || Object.keys(domainData).length === 0) {
    clearChartOnError(`No domain data for ${periodLabel}`);
    return;
  }
  const sortedDomainData = Object.entries(domainData)
    .map(([domain, time]) => ({ domain, time }))
    .sort((a, b) => b.time - a.time);
  const maxSlices = 10;
  let labels = sortedDomainData.map((item) => item.domain);
  let times = sortedDomainData.map((item) => item.time);
  if (sortedDomainData.length > maxSlices) {
    const topData = sortedDomainData.slice(0, maxSlices - 1);
    labels = topData.map((item) => item.domain);
    times = topData.map((item) => item.time);
    const otherTime = sortedDomainData.slice(maxSlices - 1).reduce((sum, item) => sum + item.time, 0);
    if (otherTime > 0) {
      labels.push('Other Domains');
      times.push(otherTime);
    }
  }
  const backgroundColors = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)',
    'rgba(83, 102, 255, 0.8)',
    'rgba(100, 255, 64, 0.8)',
    'rgba(255, 100, 100, 0.8)',
    'rgba(40, 100, 120, 0.8)',
  ];
  try {
    timeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Time Spent',
            data: times,
            backgroundColor: backgroundColors.slice(0, labels.length),
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 15 } },
          title: { display: true, text: `Website Time (${periodLabel})` },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed !== null) {
                  label += formatTime(context.parsed);
                }
                return label;
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('[Options v19b] Error creating chart:', error);
    clearChartOnError('Error rendering chart.');
  }
}

function clearChartOnError(message = 'Error loading chart data') {
  const ctx = document.getElementById('timeChartCanvas')?.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (timeChart) {
      timeChart.destroy();
      timeChart = null;
    }
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText(message, ctx.canvas.width / 2, 50);
  }
}

// --- End of options.js ---
