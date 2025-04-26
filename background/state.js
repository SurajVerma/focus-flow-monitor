// background/state.js (v0.7.0)
// Defines the shared state for the background scripts

const FocusFlowState = {
  // Core Data
  trackedData: {},
  categoryTimeData: {},
  dailyDomainData: {},
  dailyCategoryData: {},
  hourlyData: {},

  // Configuration
  categories: ['Other'], // Default initial value
  categoryAssignments: {},
  rules: [],
  defaultCategory: 'Other',

  // Runtime State
  isSaving: false,
  saveTimeoutId: null,
  updateStateTimeoutId: null,

  // Constants
  STORAGE_KEY_TRACKING_STATE: 'currentTrackingState',
  STORAGE_KEY_IDLE_THRESHOLD: 'idleThresholdSeconds',
  DEFAULT_IDLE_SECONDS: 1800,
  ALARM_NAME: 'periodicStateCheck',
  ALARM_PERIOD_MINUTES: 0.25, // 15 seconds
  SAVE_DATA_DEBOUNCE_MS: 3000, // Save data 3 seconds after the last change
  UPDATE_STATE_DEBOUNCE_MS: 500, // Check state 500ms after last relevant event
};

console.log('[System] background/state.js loaded');
