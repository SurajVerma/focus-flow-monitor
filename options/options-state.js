// options/options-state.js (v0.7.7 - Change Default Retention - Complete File)

// --- Storage Keys ---
const STORAGE_KEY_IDLE_THRESHOLD = 'idleThresholdSeconds';
const DEFAULT_IDLE_SECONDS = 1800;
const STORAGE_KEY_DATA_RETENTION_DAYS = 'dataRetentionPeriodDays';
// *** Default retention set to 90 days (3 Months) ***
const DEFAULT_DATA_RETENTION_DAYS = 90;

// --- Global App State ---
let AppState = {
  // Core Data
  trackedData: {},
  categoryTimeData: {},
  dailyDomainData: {},
  dailyCategoryData: {},
  hourlyData: {},
  // Configuration
  categories: ['Other'],
  categoryAssignments: {},
  rules: [],
  // UI State
  timeChart: null,
  domainCurrentPage: 1,
  domainItemsPerPage: 10,
  fullDomainDataSorted: [],
  calendarDate: new Date(),
  selectedDateStr: getCurrentDateString(), // Assumes getCurrentDateString is available from utils
  currentChartViewMode: 'domain',
  editingRuleIndex: -1,
  editingAssignmentOriginalDomain: null,
  categoryProductivityRatings: {}, // Add field to hold loaded user ratings
};

// --- UI Element References ---
// Populated by queryUIElements on DOMContentLoaded
let UIElements = {};

// Function to get references to all needed UI elements
function queryUIElements() {
  UIElements.detailedTimeList = document.getElementById('detailedTimeList');
  UIElements.categoryTimeList = document.getElementById('categoryTimeList');
  UIElements.categoryList = document.getElementById('categoryList');
  UIElements.assignmentList = document.getElementById('assignmentList');
  UIElements.ruleList = document.getElementById('ruleList');
  UIElements.newCategoryNameInput = document.getElementById('newCategoryName');
  UIElements.addCategoryBtn = document.getElementById('addCategoryBtn');
  UIElements.domainPatternInput = document.getElementById('domainPattern');
  UIElements.categorySelect = document.getElementById('categorySelect');
  UIElements.assignDomainBtn = document.getElementById('assignDomainBtn');
  UIElements.ruleTypeSelect = document.getElementById('ruleTypeSelect');
  UIElements.rulePatternInput = document.getElementById('rulePatternInput');
  UIElements.ruleCategorySelect = document.getElementById('ruleCategorySelect');
  UIElements.ruleLimitInput = document.getElementById('ruleLimitInput');
  UIElements.ruleUnitSelect = document.getElementById('ruleUnitSelect');
  UIElements.addRuleBtn = document.getElementById('addRuleBtn');
  UIElements.timeLimitInputDiv = document.querySelector('.time-limit-input');
  UIElements.dateRangeSelect = document.getElementById('dateRangeSelect');
  UIElements.statsPeriodSpans = document.querySelectorAll('.stats-period');
  UIElements.domainPaginationDiv = document.getElementById('domainPagination');
  UIElements.domainPrevBtn = document.getElementById('domainPrevBtn');
  UIElements.domainNextBtn = document.getElementById('domainNextBtn');
  UIElements.domainPageInfo = document.getElementById('domainPageInfo');
  UIElements.calendarGrid = document.getElementById('calendarGrid');
  UIElements.prevMonthBtn = document.getElementById('prevMonthBtn');
  UIElements.nextMonthBtn = document.getElementById('nextMonthBtn');
  UIElements.currentMonthYearSpan = document.getElementById('currentMonthYear');
  UIElements.calendarDetailPopup = document.getElementById('calendarDetailPopup');
  UIElements.chartTitleElement = document.getElementById('chartTitle');
  UIElements.chartViewRadios = document.querySelectorAll('input[name="chartView"]');
  // Edit Rule Modal Elements
  UIElements.editRuleModal = document.getElementById('editRuleModal');
  UIElements.closeEditModalBtn = document.getElementById('closeEditModalBtn');
  UIElements.editRuleFormContent = document.getElementById('editRuleFormContent');
  UIElements.editRuleIndexInput = document.getElementById('editRuleIndex');
  UIElements.editRuleTypeDisplay = document.getElementById('editRuleTypeDisplay');
  UIElements.editRulePatternGroup = document.getElementById('editRulePatternGroup');
  UIElements.editRulePatternInput = document.getElementById('editRulePatternInput');
  UIElements.editRuleCategoryGroup = document.getElementById('editRuleCategoryGroup');
  UIElements.editRuleCategorySelect = document.getElementById('editRuleCategorySelect');
  UIElements.editRuleLimitGroup = document.getElementById('editRuleLimitGroup');
  UIElements.editRuleLimitInput = document.getElementById('editRuleLimitInput');
  UIElements.editRuleUnitSelect = document.getElementById('editRuleUnitSelect');
  UIElements.saveRuleChangesBtn = document.getElementById('saveRuleChangesBtn');
  UIElements.cancelEditRuleBtn = document.getElementById('cancelEditRuleBtn');
  // Idle Threshold & Export
  UIElements.idleThresholdSelect = document.getElementById('idleThresholdSelect');
  UIElements.exportCsvBtn = document.getElementById('exportCsvBtn');
  // Edit Assignment Modal Elements
  UIElements.editAssignmentModal = document.getElementById('editAssignmentModal');
  UIElements.closeEditAssignmentModalBtn = document.getElementById('closeEditAssignmentModalBtn');
  UIElements.editAssignmentFormContent = document.getElementById('editAssignmentFormContent');
  UIElements.editAssignmentOriginalDomain = document.getElementById('editAssignmentOriginalDomain');
  UIElements.editAssignmentDomainInput = document.getElementById('editAssignmentDomainInput');
  UIElements.editAssignmentCategorySelect = document.getElementById('editAssignmentCategorySelect');
  UIElements.saveAssignmentChangesBtn = document.getElementById('saveAssignmentChangesBtn');
  UIElements.cancelEditAssignmentBtn = document.getElementById('cancelEditAssignmentBtn');
  // Data Retention Select
  UIElements.dataRetentionSelect = document.getElementById('dataRetentionSelect');
  // Data Management Elements (NEW)
  UIElements.exportDataBtn = document.getElementById('exportDataBtn');
  UIElements.importDataBtn = document.getElementById('importDataBtn');
  UIElements.importFileInput = document.getElementById('importFileInput');
  UIElements.importStatus = document.getElementById('importStatus');
  //Productivity Score Settings
  UIElements.productivitySettingsList = document.getElementById('productivitySettingsList');
  UIElements.productivityScoreLabel = document.getElementById('productivityScoreLabel');
  UIElements.productivityScoreValue = document.getElementById('productivityScoreValue');

  // Basic check to ensure critical elements were found
  if (
    !UIElements.detailedTimeList ||
    !UIElements.categoryList ||
    !UIElements.ruleList ||
    !UIElements.addCategoryBtn ||
    !UIElements.editAssignmentModal ||
    !UIElements.saveAssignmentChangesBtn ||
    !UIElements.dataRetentionSelect ||
    !UIElements.exportDataBtn ||
    !UIElements.importDataBtn ||
    !UIElements.importFileInput ||
    !UIElements.importStatus ||
    !UIElements.productivitySettingsList
  ) {
    console.error('One or more critical UI elements are missing from options.html!');
    return false; // Indicate failure
  }
  console.log('[System] UI element references obtained.');
  return true; // Indicate success
}

// Assume getCurrentDateString is available via options-utils.js inclusion
// function getCurrentDateString() { /* ... defined in options-utils.js ... */ }

console.log('[System] options-state.js v0.7.7 loaded');
