// background/storage.js (v0.7.1 - Add Pruning Logic)

// Function to load initial data and potentially trigger an initial prune
// In background/storage.js

async function loadData() {
  console.log('[Storage] loadData started.');
  try {
    // Clear any potentially stale tracking state first
    await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE); // Assumes FocusFlowState is available for this key
    console.log('[Storage] Cleared potentially stale tracking state on startup.');

    // *** MODIFIED: Use literal string key and remove the explicit check ***
    const keysToLoad = [
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
      'dataRetentionPeriodDays', // Use the literal string key here
    ];

    // Load all persistent data using the defined keys array
    const result = await browser.storage.local.get(keysToLoad);
    // *** END MODIFICATION ***

    console.log('[Storage] Config/History Data loaded from storage.');

    let needsSave = false;
    let defaults = null;
    const needDefaultConfig =
      !result.categories ||
      result.categories.length === 0 ||
      !result.categoryAssignments ||
      Object.keys(result.categoryAssignments).length === 0;

    if (needDefaultConfig) {
      try {
        console.log('[Storage] Fetching defaults...');
        const response = await fetch(browser.runtime.getURL('data/default_config.json'));
        if (!response.ok) throw new Error(`Fetch error: ${response.statusText || response.status}`);
        defaults = await response.json();
        if (!defaults || !Array.isArray(defaults.categories) || typeof defaults.assignments !== 'object') {
          throw new Error('Invalid default config structure.');
        }
        console.log('[Storage] Successfully fetched defaults.');
      } catch (fetchError) {
        console.error('[Storage] CRITICAL: Failed to fetch or parse default config.', fetchError);
        defaults = { categories: ['Other'], assignments: {} };
      }
    }

    // --- Update Global State ---
    FocusFlowState.categories =
      result.categories && result.categories.length > 0
        ? result.categories
        : defaults
        ? [...defaults.categories]
        : ['Other'];
    FocusFlowState.categoryAssignments =
      result.categoryAssignments && Object.keys(result.categoryAssignments).length > 0
        ? result.categoryAssignments
        : defaults
        ? { ...defaults.assignments }
        : {};
    FocusFlowState.rules = result.rules && Array.isArray(result.rules) ? result.rules : [];
    FocusFlowState.trackedData = result.trackedData || {};
    FocusFlowState.categoryTimeData = result.categoryTimeData || {};
    FocusFlowState.dailyDomainData = result.dailyDomainData || {};
    FocusFlowState.dailyCategoryData = result.dailyCategoryData || {};
    FocusFlowState.hourlyData = result.hourlyData || {};

    if (!FocusFlowState.categories.includes(FocusFlowState.defaultCategory)) {
      FocusFlowState.categories.push(FocusFlowState.defaultCategory);
      needsSave = true;
    }
    let categoriesChanged = false;
    for (const domain in FocusFlowState.categoryAssignments) {
      const catName = FocusFlowState.categoryAssignments[domain];
      if (!FocusFlowState.categories.includes(catName)) {
        console.warn(`[Storage] Assignment for "${domain}" uses unknown category "${catName}". Adding category.`);
        FocusFlowState.categories.push(catName);
        categoriesChanged = true;
      }
    }

    if (needsSave || needDefaultConfig || categoriesChanged || !result.hourlyData || !result.rules) {
      console.log('[Storage] Saving initial/updated non-tracking state.');
      await performSave();
    }

    // Trigger prune check once after loading data on startup
    // Use the literal string key to access the loaded setting value
    await pruneOldData(result['dataRetentionPeriodDays']);

    console.log(
      `[Storage] State loaded: ${FocusFlowState.categories.length} cats, ${
        Object.keys(FocusFlowState.categoryAssignments).length
      } assigns, ${FocusFlowState.rules.length} rules.`
    );
    console.log('[Storage] loadData finished.');
  } catch (error) {
    // Log the specific error that occurred during loadData
    console.error('[Storage] CRITICAL Error during loadData:', error); // This will now catch the underlying storage.get error if one occurs
    // Reset state on critical load error
    FocusFlowState.categories = ['Other'];
    FocusFlowState.categoryAssignments = {};
    FocusFlowState.rules = [];
    FocusFlowState.trackedData = {};
    FocusFlowState.categoryTimeData = {};
    FocusFlowState.dailyDomainData = {};
    FocusFlowState.dailyCategoryData = {};
    FocusFlowState.hourlyData = {};
    try {
      await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
    } catch (clearError) {
      console.error('[Storage] Failed to clear tracking state during loadData error handling:', clearError);
    }
  }
}

// The core save function (remains the same)
async function performSave() {
  if (FocusFlowState.isSaving) return;
  FocusFlowState.isSaving = true;
  const stateToSave = {
    trackedData: FocusFlowState.trackedData,
    categoryTimeData: FocusFlowState.categoryTimeData,
    dailyDomainData: FocusFlowState.dailyDomainData,
    dailyCategoryData: FocusFlowState.dailyCategoryData,
    hourlyData: FocusFlowState.hourlyData,
    categories: FocusFlowState.categories,
    categoryAssignments: FocusFlowState.categoryAssignments,
    rules: FocusFlowState.rules,
  };
  try {
    await browser.storage.local.set(stateToSave);
  } catch (error) {
    console.error('[Storage] CRITICAL Error during performSave:', error);
  } finally {
    FocusFlowState.isSaving = false;
  }
}

// Batched save function (remains the same)
function saveDataBatched() {
  if (FocusFlowState.saveTimeoutId) {
    clearTimeout(FocusFlowState.saveTimeoutId);
  }
  FocusFlowState.saveTimeoutId = setTimeout(() => {
    performSave();
    FocusFlowState.saveTimeoutId = null;
  }, FocusFlowState.SAVE_DATA_DEBOUNCE_MS);
}

// *** ADDED: Function to prune old data ***
/**
 * Deletes daily and hourly tracking data older than the configured retention period.
 * @param {number|undefined} [retentionDaysSetting] - Optional pre-fetched retention setting. If not provided, it will be fetched from storage.
 */
async function pruneOldData(retentionDaysSetting = undefined) {
  console.log('[Pruning] Checking for old data to prune...');
  let retentionDays = retentionDaysSetting;

  try {
    // Fetch setting from storage if not provided
    if (retentionDays === undefined) {
      const result = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_DATA_RETENTION_DAYS);
      retentionDays = result[FocusFlowState.STORAGE_KEY_DATA_RETENTION_DAYS];
    }

    // Use default if setting is missing or explicitly null
    if (retentionDays === undefined || retentionDays === null) {
      retentionDays = FocusFlowState.DEFAULT_DATA_RETENTION_DAYS;
    } else {
      retentionDays = parseInt(retentionDays, 10); // Ensure it's a number
    }

    // If retention is set to "Forever" (-1) or invalid, do nothing
    if (isNaN(retentionDays) || retentionDays < 0) {
      console.log('[Pruning] Data retention set to Forever. No pruning needed.');
      return;
    }

    console.log(`[Pruning] Data retention period: ${retentionDays} days.`);

    // Calculate cutoff date
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - retentionDays);
    cutoffDate.setHours(0, 0, 0, 0); // Compare against the start of the day

    let dataWasPruned = false;

    // Function to prune a specific data object (dailyDomainData, dailyCategoryData, hourlyData)
    const pruneObject = (dataObject, objectName) => {
      if (!dataObject) return; // Skip if object doesn't exist
      const keysToDelete = [];
      for (const dateKey in dataObject) {
        // Validate key format (YYYY-MM-DD) and convert to Date
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          try {
            const entryDate = new Date(dateKey + 'T00:00:00'); // Treat date key as local time start
            if (!isNaN(entryDate) && entryDate < cutoffDate) {
              keysToDelete.push(dateKey);
            }
          } catch (e) {
            console.warn(`[Pruning] Error parsing date key '${dateKey}' in ${objectName}. Skipping.`);
          }
        } else {
          console.warn(`[Pruning] Invalid date key format '${dateKey}' found in ${objectName}. Skipping.`);
        }
      }

      if (keysToDelete.length > 0) {
        console.log(`[Pruning] Deleting ${keysToDelete.length} old entries from ${objectName}:`, keysToDelete);
        keysToDelete.forEach((key) => delete dataObject[key]);
        dataWasPruned = true;
      }
    };

    // Prune the relevant data objects held in FocusFlowState
    pruneObject(FocusFlowState.dailyDomainData, 'dailyDomainData');
    pruneObject(FocusFlowState.dailyCategoryData, 'dailyCategoryData');
    pruneObject(FocusFlowState.hourlyData, 'hourlyData');

    // If any data was deleted, save the updated state
    if (dataWasPruned) {
      console.log('[Pruning] Old data removed. Saving updated state...');
      await performSave(); // Use performSave directly as this is a scheduled/infrequent task
      console.log('[Pruning] Updated state saved.');
    } else {
      console.log('[Pruning] No old data found to prune.');
    }
  } catch (error) {
    console.error('[Pruning] Error during data pruning:', error);
  }
}
// *** END ADDED ***

console.log('[System] background/storage.js v0.7.1 potentially updated'); // Adjust log if needed
