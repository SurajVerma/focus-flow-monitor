// options.js (v19j - Fixed innerHTML Usage)
// Modified showDayDetails to avoid innerHTML assignment

// --- Storage Keys ---
const STORAGE_KEY_IDLE_THRESHOLD = 'idleThresholdSeconds';
const DEFAULT_IDLE_SECONDS = 1800;

// --- Global variables ---
// ... (same as v19i) ...
let categories = ['Other'];
let categoryAssignments = {};
let trackedData = {};
let categoryTimeData = {};
let dailyDomainData = {};
let dailyCategoryData = {};
let hourlyData = {};
let rules = [];
let timeChart = null;
let domainCurrentPage = 1;
const domainItemsPerPage = 10;
let fullDomainDataSorted = [];
let calendarDate = new Date();
let selectedDateStr = getCurrentDateString();
let currentChartViewMode = 'domain';
let editingRuleIndex = -1;

// --- UI Element References ---
// ... (same as v19i, including exportCsvBtn) ...
let detailedTimeList, categoryTimeList, categoryList, assignmentList, ruleList;
let newCategoryNameInput, addCategoryBtn, domainPatternInput, categorySelect, assignDomainBtn;
let ruleTypeSelect, rulePatternInput, ruleCategorySelect, ruleLimitInput, ruleUnitSelect, addRuleBtn;
let timeLimitInputDiv;
let dateRangeSelect;
let statsPeriodSpans;
let domainPaginationDiv, domainPrevBtn, domainNextBtn, domainPageInfo;
let calendarGrid, prevMonthBtn, nextMonthBtn, currentMonthYearSpan;
let calendarDetailPopup;
let chartTitleElement;
let chartViewRadios;
let editRuleModal, closeEditModalBtn, editRuleFormContent, editRuleIndexInput;
let editRuleTypeDisplay, editRulePatternGroup, editRulePatternInput;
let editRuleCategoryGroup, editRuleCategorySelect;
let editRuleLimitGroup, editRuleLimitInput, editRuleUnitSelect;
let saveRuleChangesBtn, cancelEditRuleBtn;
let idleThresholdSelect;
let exportCsvBtn;

// --- Helper Functions ---
function formatTime(seconds, includeSeconds = true, forceHMS = false) {
  /* ... same as v19i ... */ if (seconds < 0) seconds = 0;
  if (forceHMS) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  if (seconds < 60 && includeSeconds) return `${seconds}s`;
  if (seconds < 60 && !includeSeconds) return `<1m`;
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  let parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  if (totalMinutes === 0 && remainingSeconds > 0) {
    parts.push(`${remainingSeconds}s`);
  }
  if (parts.length === 0) return includeSeconds ? '0s' : '<1m';
  return parts.join(' ');
}
function formatDate(date) {
  /* ... same as v19i ... */ if (!(date instanceof Date)) {
    try {
      date = new Date(date);
    } catch (e) {
      return null;
    }
  }
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getCurrentDateString() {
  /* ... same as v19i ... */ return formatDate(new Date());
}
function formatDisplayDate(dateStr) {
  /* ... same as v19i ... */ if (!dateStr) return 'Date';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(navigator.language || 'en-US', options);
  } catch (e) {
    return dateStr;
  }
}

// --- Data Loading & Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  /* ... same as v19i ... */
  console.log('[Options v19j] DOMContentLoaded');
  try {
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
    calendarDetailPopup = document.getElementById('calendarDetailPopup');
    chartTitleElement = document.getElementById('chartTitle');
    chartViewRadios = document.querySelectorAll('input[name="chartView"]');
    editRuleModal = document.getElementById('editRuleModal');
    closeEditModalBtn = document.getElementById('closeEditModalBtn');
    editRuleFormContent = document.getElementById('editRuleFormContent');
    editRuleIndexInput = document.getElementById('editRuleIndex');
    editRuleTypeDisplay = document.getElementById('editRuleTypeDisplay');
    editRulePatternGroup = document.getElementById('editRulePatternGroup');
    editRulePatternInput = document.getElementById('editRulePatternInput');
    editRuleCategoryGroup = document.getElementById('editRuleCategoryGroup');
    editRuleCategorySelect = document.getElementById('editRuleCategorySelect');
    editRuleLimitGroup = document.getElementById('editRuleLimitGroup');
    editRuleLimitInput = document.getElementById('editRuleLimitInput');
    editRuleUnitSelect = document.getElementById('editRuleUnitSelect');
    saveRuleChangesBtn = document.getElementById('saveRuleChangesBtn');
    cancelEditRuleBtn = document.getElementById('cancelEditRuleBtn');
    idleThresholdSelect = document.getElementById('idleThresholdSelect');
    exportCsvBtn = document.getElementById('exportCsvBtn');
    if (!exportCsvBtn) console.error('Export CSV button element not found!');
    if (!idleThresholdSelect) console.error('Idle threshold select element not found!');
    if (!editRuleModal || !closeEditModalBtn || !saveRuleChangesBtn || !cancelEditRuleBtn || !editRuleCategorySelect) {
      console.error('One or more essential modal elements not found!');
    }
    console.log('[Options v19j] UI element references obtained.');
  } catch (e) {
    console.error('[Options v19j] Error getting UI elements!', e);
    return;
  }
  loadAllData();
  setupEventListeners();
  console.log('Options script loaded (v19j).');
});

function loadAllData() {
  /* ... same as v19i ... */
  console.log('[Options v19j] loadAllData starting...');
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
    ])
    .then((result) => {
      console.log('[Options v19j] Data loaded from storage.');
      try {
        trackedData = result.trackedData || {};
        categoryTimeData = result.categoryTimeData || {};
        dailyDomainData = result.dailyDomainData || {};
        dailyCategoryData = result.dailyCategoryData || {};
        hourlyData = result.hourlyData || {};
        categories = result.categories || ['Other'];
        if (!categories.includes('Other')) categories.push('Other');
        categoryAssignments = result.categoryAssignments || {};
        rules = result.rules || [];
        const savedIdleThreshold = result[STORAGE_KEY_IDLE_THRESHOLD];
        if (idleThresholdSelect) {
          idleThresholdSelect.value =
            savedIdleThreshold !== undefined && savedIdleThreshold !== null ? savedIdleThreshold : DEFAULT_IDLE_SECONDS;
          console.log(`[Options v19j] Idle threshold loaded: ${idleThresholdSelect.value} seconds`);
        }
        populateCategoryList();
        populateCategorySelect();
        populateAssignmentList();
        populateRuleCategorySelect();
        populateRuleList();
        renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth());
        updateDisplayForSelectedRange();
        highlightSelectedCalendarDay(selectedDateStr);
      } catch (processingError) {
        console.error('[Options v19j] Error during data processing/UI update!', processingError);
      }
    })
    .catch((error) => {
      console.error('[Options v19j] storage.local.get FAILED!', error);
    });
}

// --- Get Filtered Data Functions ---
function getFilteredDataForRange(range) {
  /* ... same as v19i ... */ let filteredDomainData = {};
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
      periodLabel = 'This Week';
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
      const daysInMonth = today.getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
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
    } else {
      filteredDomainData = trackedData || {};
      filteredCategoryData = categoryTimeData || {};
      periodLabel = 'All Time';
    }
  } catch (filterError) {
    console.error(`Error filtering for range "${range}":`, filterError);
    return { domainData: {}, categoryData: {}, label: `Error (${range})` };
  }
  return { domainData: filteredDomainData, categoryData: filteredCategoryData, label: periodLabel };
}

// --- Central UI Update Function ---
function updateDisplayForSelectedRange() {
  /* ... same as v19i ... */ if (!dateRangeSelect) return;
  const selectedRange = dateRangeSelect.value;
  console.log(`[Options v19j] updateDisplayForSelectedRange called for range: ${selectedRange}`);
  try {
    const { domainData, categoryData, label } = getFilteredDataForRange(selectedRange);
    if (statsPeriodSpans) statsPeriodSpans.forEach((span) => (span.textContent = label));
    fullDomainDataSorted = Object.entries(domainData)
      .map(([domain, time]) => ({ domain, time }))
      .sort((a, b) => b.time - a.time);
    domainCurrentPage = 1;
    updateDomainDisplayAndPagination();
    displayCategoryTime(categoryData);
    renderChartForSelectedDate();
    console.log(`[Options v19j] Display updated for range: ${selectedRange}`);
  } catch (e) {
    console.error(`Error updating display for range ${selectedRange}:`, e);
  }
}

// --- Pagination Display Update ---
function updateDomainDisplayAndPagination() {
  /* ... same as v19i ... */ if (
    !detailedTimeList ||
    !domainPaginationDiv ||
    !domainPrevBtn ||
    !domainNextBtn ||
    !domainPageInfo
  )
    return;
  const totalItems = fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / domainItemsPerPage));
  domainCurrentPage = Math.max(1, Math.min(domainCurrentPage, totalPages));
  const startIndex = (domainCurrentPage - 1) * domainItemsPerPage;
  const endIndex = startIndex + domainItemsPerPage;
  const itemsToShow = fullDomainDataSorted.slice(startIndex, endIndex);
  displayDomainTime(itemsToShow);
  domainPageInfo.textContent = `Page ${domainCurrentPage} of ${totalPages}`;
  domainPrevBtn.disabled = domainCurrentPage <= 1;
  domainNextBtn.disabled = domainCurrentPage >= totalPages;
  domainPaginationDiv.style.display = totalPages > 1 ? 'flex' : 'none';
}

// --- UI Population/Display Functions ---
function displayDomainTime(itemsToDisplay) {
  /* ... same as v19i ... */ if (!detailedTimeList) return;
  detailedTimeList.replaceChildren();
  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    const li = document.createElement('li');
    li.textContent = fullDomainDataSorted.length === 0 ? 'No domain data for this period.' : 'No domains on this page.';
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
  /* ... same as v19i ... */ if (!categoryTimeList) return;
  categoryTimeList.replaceChildren();
  if (!dataToDisplay || Object.keys(dataToDisplay).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No category data for this period.';
    categoryTimeList.appendChild(li);
    return;
  }
  const sortedData = Object.entries(dataToDisplay)
    .map(([category, time]) => ({ category, time }))
    .filter((item) => item.time > 0.1)
    .sort((a, b) => b.time - a.time);
  if (sortedData.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No category data for this period.';
    categoryTimeList.appendChild(li);
    return;
  }
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
  /* ... same as v19i ... */ if (!categoryList) return;
  categoryList.replaceChildren();
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
  /* ... same as v19i ... */ if (!categorySelect) return;
  categorySelect.replaceChildren();
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
  /* ... same as v19i ... */ if (!assignmentList) return;
  assignmentList.replaceChildren();
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
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.appendChild(categorySpan);
    controlsDiv.appendChild(deleteBtn);
    li.appendChild(domainSpan);
    li.appendChild(controlsDiv);
    assignmentList.appendChild(li);
  });
}
function populateRuleCategorySelect() {
  /* ... same as v19i ... */ if (ruleCategorySelect) {
    ruleCategorySelect.replaceChildren();
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
  }
  if (editRuleCategorySelect) {
    editRuleCategorySelect.replaceChildren();
    const defaultEditOption = document.createElement('option');
    defaultEditOption.value = '';
    defaultEditOption.textContent = 'Select Category';
    editRuleCategorySelect.appendChild(defaultEditOption);
    categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      editRuleCategorySelect.appendChild(option);
    });
  } else {
    console.error('Edit rule category select element not found during population!');
  }
}
function populateRuleList() {
  /* ... same as v19i ... */ if (!ruleList) return;
  ruleList.replaceChildren();
  if (!rules || !Array.isArray(rules)) {
    const li = document.createElement('li');
    li.textContent = 'Error: Rule data is invalid.';
    ruleList.appendChild(li);
    return;
  }
  if (rules.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No blocking or limiting rules are currently set.';
    ruleList.appendChild(li);
    return;
  }
  try {
    rules.forEach((rule, index) => {
      if (!rule || typeof rule.type !== 'string' || typeof rule.value !== 'string') return;
      const li = document.createElement('li');
      const infoSpan = document.createElement('span');
      infoSpan.className = 'rule-info';
      let typeText = '',
        targetText = rule.value,
        detailContent = '',
        detailClass = '';
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
        targetText = JSON.stringify(rule.value);
      }
      const typeSpan = document.createElement('span');
      typeSpan.className = 'rule-type';
      typeSpan.textContent = `${typeText}:`;
      const targetSpan = document.createElement('span');
      targetSpan.className = 'rule-target';
      targetSpan.textContent = targetText;
      infoSpan.appendChild(typeSpan);
      infoSpan.appendChild(document.createTextNode(' '));
      infoSpan.appendChild(targetSpan);
      if (detailClass && detailContent) {
        infoSpan.appendChild(document.createTextNode(' '));
        const detailSpan = document.createElement('span');
        detailSpan.className = detailClass;
        detailSpan.textContent = detailContent;
        infoSpan.appendChild(detailSpan);
      }
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.whiteSpace = 'nowrap';
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'edit-btn';
      editBtn.dataset.ruleIndex = index;
      buttonsDiv.appendChild(editBtn);
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.ruleIndex = index;
      buttonsDiv.appendChild(deleteBtn);
      li.appendChild(infoSpan);
      li.appendChild(buttonsDiv);
      ruleList.appendChild(li);
    });
  } catch (e) {
    console.error('Error populating rule list:', e);
  }
}

// --- Calendar Rendering & Interaction (MODIFIED showDayDetails) ---
function renderCalendar(year, month) {
  /* ... same as v19i ... */ if (!calendarGrid || !currentMonthYearSpan) return;
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
  const dayCells = Array.from(calendarGrid.querySelectorAll('.calendar-day'));
  dayCells.forEach((cell) => cell.remove());
  const emptyCells = Array.from(calendarGrid.querySelectorAll('.empty'));
  emptyCells.forEach((cell) => cell.remove());
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < startingDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('calendar-day', 'empty');
    fragment.appendChild(emptyCell);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('calendar-day');
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    if (dateStr === todayStr) dayCell.classList.add('today');
    dayCell.dataset.date = dateStr;
    const dayNumberSpan = document.createElement('span');
    dayNumberSpan.classList.add('day-number');
    dayNumberSpan.textContent = day;
    dayCell.appendChild(dayNumberSpan);
    const dailyTotalSeconds = Object.values(dailyDomainData[dateStr] || {}).reduce((sum, time) => sum + time, 0);
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('day-time');
    if (dailyTotalSeconds > 0) {
      timeSpan.textContent = formatTime(dailyTotalSeconds, false);
    } else {
      timeSpan.textContent = '-';
      timeSpan.classList.add('no-data');
    }
    dayCell.appendChild(timeSpan);
    if (dailyTotalSeconds > 0) {
      dayCell.addEventListener('mouseover', showDayDetails);
      dayCell.addEventListener('focus', showDayDetails);
      dayCell.addEventListener('mouseout', hideDayDetails);
      dayCell.addEventListener('blur', hideDayDetails);
      dayCell.addEventListener('click', handleDayClick);
      dayCell.setAttribute('tabindex', '0');
    } else {
      dayCell.style.cursor = 'default';
    }
    fragment.appendChild(dayCell);
  }
  calendarGrid.appendChild(fragment);
}

// MODIFIED: Use safe DOM methods instead of innerHTML
function showDayDetails(event) {
  const dayCell = event.target.closest('.calendar-day');
  if (!dayCell || !calendarDetailPopup) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;

  const dayDomainData = dailyDomainData[dateStr] || {};
  const dayCategoryData = dailyCategoryData[dateStr] || {}; // Keep fetching this
  const totalSeconds = Object.values(dayDomainData).reduce((s, t) => s + t, 0);
  const topDomains = Object.entries(dayDomainData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  // const topCategories = Object.entries(dayCategoryData).sort((a, b) => b[1] - a[1]).slice(0, 3); // Can use later

  // --- Build Content using DOM methods ---
  calendarDetailPopup.replaceChildren(); // Clear previous content safely

  // Heading (Date)
  const heading = document.createElement('strong');
  heading.textContent = formatDisplayDate(dateStr);
  calendarDetailPopup.appendChild(heading);

  // Total Time
  const totalText = document.createTextNode(`Total: ${formatTime(totalSeconds, true)}`); // Include seconds
  calendarDetailPopup.appendChild(totalText);
  calendarDetailPopup.appendChild(document.createElement('br')); // Line break

  // Top Sites List
  if (topDomains.length > 0) {
    const sitesHeading = document.createTextNode('Top Sites:');
    const sitesList = document.createElement('ul');
    topDomains.forEach(([domain, time]) => {
      const listItem = document.createElement('li');
      // Sanitize domain? Generally okay, but textContent is safe.
      listItem.textContent = `${domain}: ${formatTime(time, false)}`; // Compact time
      sitesList.appendChild(listItem);
    });
    calendarDetailPopup.appendChild(document.createElement('br')); // Space before list
    calendarDetailPopup.appendChild(sitesHeading);
    calendarDetailPopup.appendChild(sitesList);
  } else {
    const noDataText = document.createTextNode('No site data recorded.');
    calendarDetailPopup.appendChild(noDataText);
  }

  // --- Positioning Logic (same as v19f) ---
  const container = document.querySelector('.calendar-container');
  if (!container) return;
  let targetTop = dayCell.offsetTop + dayCell.offsetHeight + 5;
  let targetLeft = dayCell.offsetLeft + dayCell.offsetWidth / 2;
  calendarDetailPopup.style.position = 'absolute';
  calendarDetailPopup.style.top = `${targetTop}px`;
  calendarDetailPopup.style.left = `${targetLeft}px`;
  calendarDetailPopup.style.transform = 'translateX(-50%)';
  calendarDetailPopup.style.display = 'block';
  const popupRect = calendarDetailPopup.getBoundingClientRect();
  if (popupRect.bottom > window.innerHeight) {
    targetTop = dayCell.offsetTop - popupRect.height - 5;
    calendarDetailPopup.style.top = `${targetTop}px`;
  }
  if (calendarDetailPopup.getBoundingClientRect().top < 0) {
    targetTop = dayCell.offsetTop + dayCell.offsetHeight + 5;
    calendarDetailPopup.style.top = `${targetTop}px`;
  }
  const finalPopupRect = calendarDetailPopup.getBoundingClientRect();
  if (finalPopupRect.right > window.innerWidth) {
    targetLeft = dayCell.offsetLeft + dayCell.offsetWidth - popupRect.width;
    calendarDetailPopup.style.left = `${targetLeft}px`;
    calendarDetailPopup.style.transform = 'translateX(0)';
  } else if (finalPopupRect.left < 0) {
    targetLeft = dayCell.offsetLeft;
    calendarDetailPopup.style.left = `${targetLeft}px`;
    calendarDetailPopup.style.transform = 'translateX(0)';
  } else {
    calendarDetailPopup.style.transform = 'translateX(-50%)';
  }
  // --- Positioning Logic Ends ---
}

function hideDayDetails() {
  /* ... same as v19f ... */ if (calendarDetailPopup) {
    calendarDetailPopup.style.display = 'none';
  }
}
function handleDayClick(event) {
  /* ... same as v19f ... */ const dayCell = event.target.closest('.calendar-day');
  if (!dayCell) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;
  console.log(`[Calendar] Day clicked: ${dateStr}`);
  selectedDateStr = dateStr;
  highlightSelectedCalendarDay(dateStr);
  renderChartForSelectedDate();
}
function highlightSelectedCalendarDay(dateStrToSelect) {
  /* ... same as v19f ... */ if (!calendarGrid) return;
  const allDays = calendarGrid.querySelectorAll('.calendar-day');
  allDays.forEach((day) => {
    if (day.dataset.date === dateStrToSelect) {
      day.classList.add('selected');
    } else {
      day.classList.remove('selected');
    }
  });
}
function renderChartForSelectedDate() {
  /* ... same as v19f ... */ if (!selectedDateStr) {
    clearChartOnError('Select a date from the calendar.');
    return;
  }
  const data =
    currentChartViewMode === 'domain'
      ? dailyDomainData[selectedDateStr] || {}
      : dailyCategoryData[selectedDateStr] || {};
  const displayDate = formatDisplayDate(selectedDateStr);
  renderChart(data, displayDate, currentChartViewMode);
  if (chartTitleElement) {
    chartTitleElement.textContent = `Usage Chart (${displayDate})`;
  }
}

// --- Event Listener Setup ---
function setupEventListeners() {
  /* ... same as v19i ... */
  try {
    if (addCategoryBtn) addCategoryBtn.addEventListener('click', handleAddCategory);
    if (assignDomainBtn) assignDomainBtn.addEventListener('click', handleAssignDomain);
    if (categoryList) categoryList.addEventListener('click', handleDeleteCategory);
    if (assignmentList) assignmentList.addEventListener('click', handleDeleteAssignment);
    if (ruleTypeSelect) ruleTypeSelect.addEventListener('change', handleRuleTypeChange);
    if (addRuleBtn) addRuleBtn.addEventListener('click', handleAddRule);
    if (ruleList) {
      ruleList.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) {
          handleDeleteRule(event);
        } else if (event.target.classList.contains('edit-btn')) {
          handleEditRuleClick(event);
        }
      });
    } else {
      console.error('Rule list element not found for event listener setup!');
    }
    if (dateRangeSelect) dateRangeSelect.addEventListener('change', updateDisplayForSelectedRange);
    if (domainPrevBtn) domainPrevBtn.addEventListener('click', handleDomainPrev);
    if (domainNextBtn) domainNextBtn.addEventListener('click', handleDomainNext);
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', handlePrevMonth);
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', handleNextMonth);
    if (chartViewRadios) {
      chartViewRadios.forEach((radio) => {
        radio.addEventListener('change', (event) => {
          currentChartViewMode = event.target.value;
          console.log(`Chart view changed to: ${currentChartViewMode}`);
          renderChartForSelectedDate();
        });
      });
    }
    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', handleCancelEditClick);
    if (cancelEditRuleBtn) cancelEditRuleBtn.addEventListener('click', handleCancelEditClick);
    if (saveRuleChangesBtn) saveRuleChangesBtn.addEventListener('click', handleSaveChangesClick);
    if (editRuleModal) {
      editRuleModal.addEventListener('click', (event) => {
        if (event.target === editRuleModal) {
          handleCancelEditClick();
        }
      });
    }
    if (idleThresholdSelect) {
      idleThresholdSelect.addEventListener('change', handleIdleThresholdChange);
    }
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', handleExportCsv);
    }
    handleRuleTypeChange();
    console.log('[Options v19j] Event listeners set up.');
  } catch (e) {
    console.error('[Options v19j] Error setting up event listeners:', e);
  }
}

// --- Event Handlers ---
// (All handlers except showDayDetails are the same as v19i)
function handleAddCategory() {
  /* ... same ... */ try {
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
  /* ... same ... */ try {
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
  /* ... same ... */ try {
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
  /* ... same ... */ try {
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
  /* ... same ... */ try {
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
  /* ... same ... */ try {
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
    console.log('[Options v19j] Added rule:', newRule);
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
  /* ... same ... */ try {
    const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
    if (!isNaN(ruleIndex) && ruleIndex >= 0 && ruleIndex < rules.length) {
      const ruleToDelete = rules[ruleIndex];
      let confirmMessage = `DELETE RULE?\n\nType: ${ruleToDelete.type}\nTarget: ${ruleToDelete.value}`;
      if (ruleToDelete.limitSeconds !== undefined)
        confirmMessage += `\nLimit: ${formatTime(ruleToDelete.limitSeconds, false)}/day`;
      if (confirm(confirmMessage)) {
        rules.splice(ruleIndex, 1);
        console.log('[Options v19j] Deleted rule at index:', ruleIndex);
        saveRules();
        populateRuleList();
      }
    } else {
      console.warn('Delete button clicked, but rule index not found or invalid:', event.target.dataset.ruleIndex);
    }
  } catch (e) {
    console.error('Error deleting rule:', e);
  }
}
function handleDomainPrev() {
  /* ... same ... */ if (domainCurrentPage > 1) {
    domainCurrentPage--;
    updateDomainDisplayAndPagination();
  }
}
function handleDomainNext() {
  /* ... same ... */ const totalItems = fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / domainItemsPerPage));
  if (domainCurrentPage < totalPages) {
    domainCurrentPage++;
    updateDomainDisplayAndPagination();
  }
}
function handlePrevMonth() {
  /* ... same ... */ calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth());
  highlightSelectedCalendarDay(selectedDateStr);
}
function handleNextMonth() {
  /* ... same ... */ calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar(calendarDate.getFullYear(), calendarDate.getMonth());
  highlightSelectedCalendarDay(selectedDateStr);
}
function handleEditRuleClick(event) {
  /* ... same ... */ const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
  if (isNaN(ruleIndex) || ruleIndex < 0 || ruleIndex >= rules.length) {
    console.error('Invalid rule index for edit:', ruleIndex);
    alert('Could not find rule to edit.');
    return;
  }
  editingRuleIndex = ruleIndex;
  const rule = rules[ruleIndex];
  console.log('Editing rule:', rule);
  if (
    !editRuleModal ||
    !editRuleTypeDisplay ||
    !editRulePatternGroup ||
    !editRulePatternInput ||
    !editRuleCategoryGroup ||
    !editRuleCategorySelect ||
    !editRuleLimitGroup ||
    !editRuleLimitInput ||
    !editRuleUnitSelect ||
    !editRuleIndexInput
  ) {
    console.error('Cannot open edit modal - one or more form elements are missing.');
    alert('Error opening edit form.');
    return;
  }
  editRuleIndexInput.value = ruleIndex;
  editRuleTypeDisplay.textContent = rule.type;
  editRulePatternGroup.style.display = rule.type.includes('-url') ? '' : 'none';
  editRuleCategoryGroup.style.display = rule.type.includes('-category') ? '' : 'none';
  editRuleLimitGroup.style.display = rule.type.includes('limit-') ? '' : 'none';
  if (rule.type.includes('-url')) {
    editRulePatternInput.value = rule.value;
  } else if (rule.type.includes('-category')) {
    populateRuleCategorySelect();
    editRuleCategorySelect.value = rule.value;
    if (!categories.includes(rule.value)) {
      console.warn(`Category "${rule.value}" for rule no longer exists. User must select a new one.`);
      const tempOption = document.createElement('option');
      tempOption.value = rule.value;
      tempOption.textContent = `${rule.value} (Deleted)`;
      tempOption.disabled = true;
      editRuleCategorySelect.appendChild(tempOption);
      editRuleCategorySelect.value = rule.value;
    }
  }
  if (rule.type.includes('limit-')) {
    const limitSec = rule.limitSeconds || 0;
    if (limitSec > 0 && limitSec % 3600 === 0 && limitSec / 3600 >= 1) {
      editRuleLimitInput.value = limitSec / 3600;
      editRuleUnitSelect.value = 'hours';
    } else {
      editRuleLimitInput.value = Math.round(limitSec / 60);
      editRuleUnitSelect.value = 'minutes';
    }
    if (limitSec > 0 && editRuleLimitInput.value == 0) {
      editRuleLimitInput.value = 1;
      editRuleUnitSelect.value = 'minutes';
    }
  } else {
    editRuleLimitInput.value = '';
    editRuleUnitSelect.value = 'minutes';
  }
  editRuleModal.style.display = 'flex';
}
function handleCancelEditClick() {
  /* ... same ... */ if (editRuleModal) {
    editRuleModal.style.display = 'none';
  }
  editingRuleIndex = -1;
}
function handleSaveChangesClick() {
  /* ... same ... */ if (editingRuleIndex < 0 || editingRuleIndex >= rules.length) {
    console.error('Invalid editingRuleIndex:', editingRuleIndex);
    alert('Error: No rule selected for saving.');
    return;
  }
  const originalRule = rules[editingRuleIndex];
  const updatedRule = { type: originalRule.type };
  if (originalRule.type.includes('-url')) {
    const newValue = editRulePatternInput.value.trim();
    if (!newValue) {
      alert('Please enter a URL or pattern.');
      return;
    }
    updatedRule.value = newValue;
  } else if (originalRule.type.includes('-category')) {
    const newValue = editRuleCategorySelect.value;
    const selectedOption = editRuleCategorySelect.options[editRuleCategorySelect.selectedIndex];
    if (!newValue || selectedOption.disabled) {
      alert('Please select a valid category.');
      return;
    }
    updatedRule.value = newValue;
  }
  if (originalRule.type.includes('limit-')) {
    const limitValue = parseInt(editRuleLimitInput.value, 10);
    const unit = editRuleUnitSelect.value;
    if (isNaN(limitValue) || limitValue <= 0) {
      alert('Please enter a valid positive time limit.');
      return;
    }
    updatedRule.limitSeconds = unit === 'hours' ? limitValue * 3600 : limitValue * 60;
  }
  const exists = rules.some(
    (rule, index) =>
      index !== editingRuleIndex &&
      rule.type === updatedRule.type &&
      rule.value.toLowerCase() === updatedRule.value.toLowerCase()
  );
  if (exists) {
    alert(`Another rule for this exact type and target ("${updatedRule.value}") already exists.`);
    return;
  }
  rules[editingRuleIndex] = updatedRule;
  console.log(`Rule at index ${editingRuleIndex} updated:`, updatedRule);
  saveRules();
  populateRuleList();
  handleCancelEditClick();
}
function handleIdleThresholdChange() {
  /* ... same ... */ if (!idleThresholdSelect) return;
  const selectedValue = parseInt(idleThresholdSelect.value, 10);
  if (isNaN(selectedValue)) {
    console.error('Invalid idle threshold value selected:', idleThresholdSelect.value);
    idleThresholdSelect.value = DEFAULT_IDLE_SECONDS;
    return;
  }
  console.log(`[Options] Idle threshold changed to: ${selectedValue} seconds`);
  browser.storage.local
    .set({ [STORAGE_KEY_IDLE_THRESHOLD]: selectedValue })
    .then(() => {
      console.log('[Options] Idle threshold saved successfully.');
    })
    .catch((error) => {
      console.error('Error saving idle threshold:', error);
      alert('Failed to save idle threshold setting.');
    });
}
function handleExportCsv() {
  /* ... same ... */ console.log('Export CSV requested.');
  if (!dateRangeSelect) {
    alert('Error: Cannot determine selected date range.');
    return;
  }
  const selectedRange = dateRangeSelect.value;
  const { domainData, categoryData, label } = getFilteredDataForRange(selectedRange);
  const dataToExport = domainData;
  if (!dataToExport || Object.keys(dataToExport).length === 0) {
    alert(`No domain data to export for the selected period: ${label}`);
    return;
  }
  const csvString = convertDataToCsv(dataToExport);
  const filename = `focusflow_export_${label.toLowerCase().replace(/\s+/g, '_')}_${formatDate(new Date())}.csv`;
  triggerCsvDownload(csvString, filename);
}
function escapeCsvValue(value) {
  /* ... same ... */ if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    const escapedValue = stringValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }
  return stringValue;
}
function convertDataToCsv(dataObject) {
  /* ... same ... */ if (!dataObject) return '';
  const headers = ['Domain', 'Category', 'Time Spent (HH:MM:SS)', 'Time Spent (Seconds)'];
  let csvString = headers.map(escapeCsvValue).join(',') + '\n';
  const sortedData = Object.entries(dataObject)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  sortedData.forEach((item) => {
    const domain = item.domain;
    const seconds = item.seconds;
    const category = categoryAssignments[domain] || 'Other';
    const timeHMS = formatTime(seconds, true, true);
    const row = [domain, category, timeHMS, seconds];
    csvString += row.map(escapeCsvValue).join(',') + '\n';
  });
  return csvString;
}
function triggerCsvDownload(csvString, filename) {
  /* ... same ... */ try {
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

// --- Data Saving Functions ---
function saveCategoriesAndAssignments() {
  /* ... same ... */ browser.storage.local
    .set({ categories, categoryAssignments })
    .then(() => browser.runtime.sendMessage({ action: 'categoriesUpdated' }))
    .then((response) => console.log('[Options v19j] Bg notified (categories):', response ? 'OK' : 'No response'))
    .catch((error) => {
      console.error('[Options v19j] Error saving categories/assignments:', error);
    });
}
function saveRules() {
  /* ... same ... */ browser.storage.local
    .set({ rules })
    .then(() => browser.runtime.sendMessage({ action: 'rulesUpdated' }))
    .then((response) => console.log('[Options v19j] Bg notified (rules):', response ? 'OK' : 'No response'))
    .catch((error) => {
      console.error('[Options v19j] Error saving rules:', error);
    });
}

// --- Chart Rendering ---
function renderChart(data, periodLabel = 'Selected Period', viewMode = 'domain') {
  /* ... same as v19i ... */ if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded.');
    clearChartOnError('Chart library not loaded.');
    return;
  }
  const canvas = document.getElementById('timeChartCanvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) {
    console.error('Canvas element not found.');
    return;
  }
  if (timeChart) {
    timeChart.destroy();
    timeChart = null;
  }
  if (!data || Object.keys(data).length === 0) {
    clearChartOnError(`No data for ${periodLabel}`);
    return;
  }
  const maxSlices = 10;
  let sortedData, otherLabel;
  if (viewMode === 'category') {
    sortedData = Object.entries(data)
      .map(([name, time]) => ({ name, time }))
      .filter((item) => item.time > 0.1)
      .sort((a, b) => b.time - a.time);
    otherLabel = 'Other Categories';
  } else {
    sortedData = Object.entries(data)
      .map(([name, time]) => ({ name, time }))
      .filter((item) => item.time > 0.1)
      .sort((a, b) => b.time - a.time);
    otherLabel = 'Other Domains';
  }
  if (sortedData.length === 0) {
    clearChartOnError(`No significant data for ${periodLabel}`);
    return;
  }
  let labels = sortedData.map((item) => item.name);
  let times = sortedData.map((item) => item.time);
  if (sortedData.length > maxSlices) {
    const topData = sortedData.slice(0, maxSlices - 1);
    labels = topData.map((item) => item.name);
    times = topData.map((item) => item.time);
    const otherTime = sortedData.slice(maxSlices - 1).reduce((sum, item) => sum + item.time, 0);
    if (otherTime > 0.1) {
      labels.push(otherLabel);
      times.push(otherTime);
    }
  }
  const categoryColors = {
    'Work/Productivity': 'rgba(54, 162, 235, 0.8)',
    'Social Media': 'rgba(255, 99, 132, 0.8)',
    'News & Info': 'rgba(255, 159, 64, 0.8)',
    Entertainment: 'rgba(153, 102, 255, 0.8)',
    Shopping: 'rgba(255, 205, 86, 0.8)',
    'Reference & Learning': 'rgba(75, 192, 192, 0.8)',
    Technology: 'rgba(100, 255, 64, 0.8)',
    Finance: 'rgba(40, 100, 120, 0.8)',
    Other: 'rgba(201, 203, 207, 0.8)',
  };
  const defaultColorPalette = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
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
  let backgroundColors;
  if (viewMode === 'category') {
    backgroundColors = labels.map((label) => categoryColors[label] || categoryColors['Other']);
    if (labels.includes(otherLabel)) {
      const otherIndex = labels.indexOf(otherLabel);
      backgroundColors[otherIndex] = categoryColors['Other'];
    }
  } else {
    backgroundColors = labels.map((_, index) => defaultColorPalette[index % defaultColorPalette.length]);
    if (labels.includes(otherLabel)) {
      const otherIndex = labels.indexOf(otherLabel);
      backgroundColors[otherIndex] = categoryColors['Other'];
    }
  }
  try {
    timeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ label: 'Time Spent', data: times, backgroundColor: backgroundColors, hoverOffset: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 15 } },
          title: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed !== null && context.parsed !== undefined) {
                  label += formatTime(context.parsed, true);
                }
                return label;
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('[Options v19j] Error creating chart:', error);
    clearChartOnError('Error rendering chart.');
  }
}
function clearChartOnError(message = 'Error loading chart data') {
  /* ... same as v19i ... */ const canvas = document.getElementById('timeChartCanvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (timeChart) {
      timeChart.destroy();
      timeChart = null;
    }
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    const maxWidth = canvas.width * 0.8;
    const words = message.split(' ');
    let line = '';
    let y = canvas.height / 2 - 10;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, canvas.width / 2, y);
        line = words[n] + ' ';
        y += 18;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, canvas.width / 2, y);
  }
}

// --- End of options.js ---
