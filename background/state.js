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
    durations: {
      work: 25 * 60,
      shortBreak: 5 * 60,
      longBreak: 15 * 60,
    },
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartWork: false,
    currentPhase: 'Work',
    remainingTime: 25 * 60,
    workSessionsCompleted: 0,
    timerState: 'stopped',
    timerIntervalId: null,
    notifyEnabled: true,
  },
  // --- Pomodoro Timer State ---
  // Note: The active pomodoro timer's state (currentPhase, remainingTime, etc.)
  // is managed by `pomodoroState` in main.js and saved/loaded separately via
  // STORAGE_KEY_POMODORO_STATE. `pomodoroSettings` (durations, notifyEnabled, etc.)
  // are also loaded into a variable in main.js from STORAGE_KEY_POMODORO_SETTINGS.

  // --- Pomodoro Statistics Storage ---
  // These will be stored under their own keys and primarily managed in main.js & storage.js
  pomodoroDailyStats: {}, // Key: "YYYY-MM-DD", Value: { workSessions: count, totalWorkTime: seconds }
  pomodoroAllTimeStats: {
    totalWorkSessionsCompleted: 0,
    totalTimeFocused: 0, // in seconds
  },

  STORAGE_KEY_POMODORO_STATE: 'pomodoroPersistentState',
  STORAGE_KEY_POMODORO_SETTINGS: 'pomodoroUserSettings',
  STORAGE_KEY_POMODORO_STATS_DAILY: 'pomodoroStatsDaily',
  STORAGE_KEY_POMODORO_STATS_ALL_TIME: 'pomodoroStatsAllTime',
};
