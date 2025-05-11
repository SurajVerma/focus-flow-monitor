// background/state.js (v0.7.2 - Revised Pomodoro State)

const FocusFlowState = {
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
  defaultCategory: 'Other',

  // Runtime State for Tracking & Saving
  isSaving: false,
  saveTimeoutId: null,
  updateStateTimeoutId: null,

  // Constants for Tracking & Storage
  STORAGE_KEY_TRACKING_STATE: 'currentTrackingState',
  STORAGE_KEY_IDLE_THRESHOLD: 'idleThresholdSeconds',
  DEFAULT_IDLE_SECONDS: 1800,
  STORAGE_KEY_DATA_RETENTION_DAYS: 'dataRetentionPeriodDays',
  DEFAULT_DATA_RETENTION_DAYS: 90,
  STORAGE_KEY_PRODUCTIVITY_RATINGS: 'categoryProductivityRatings',

  ALARM_NAME: 'periodicStateCheck',
  ALARM_PERIOD_MINUTES: 0.25,
  SAVE_DATA_DEBOUNCE_MS: 3000,
  UPDATE_STATE_DEBOUNCE_MS: 500,

  // --- Pomodoro Timer State ---
  pomodoro: {
    // Default settings (can be made configurable later if desired)
    durations: {
      // in seconds
      work: 25 * 60,
      shortBreak: 5 * 60,
      longBreak: 15 * 60,
    },
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false, // CHANGED: User starts breaks manually
    autoStartWork: false, // CHANGED: User starts work manually

    // Runtime state (will be persisted)
    currentPhase: 'Work',
    remainingTime: 25 * 60,
    workSessionsCompleted: 0,
    timerState: 'stopped',
    timerIntervalId: null,
    notifyEnabled: true, // NEW: Default to notifications enabled
  },
  STORAGE_KEY_POMODORO_STATE: 'pomodoroPersistentState', // For currentPhase, remainingTime, workSessionsCompleted, timerState
  STORAGE_KEY_POMODORO_SETTINGS: 'pomodoroUserSettings', // For durations, sessionsBeforeLongBreak, autoStart, notifyEnabled

  // NEW: Pomodoro Statistics Storage (placeholders)
  STORAGE_KEY_POMODORO_STATS_DAILY: 'pomodoroStatsDaily', // e.g., { "YYYY-MM-DD": { workSessions: N, workTime: S } }
  STORAGE_KEY_POMODORO_STATS_ALL_TIME: 'pomodoroStatsAllTime', // e.g., { totalWorkSessions: N, totalWorkTime: S }
};

console.log('[System] background/state.js loaded (v0.7.2 - Revised Pomodoro State)');
