async function loadData() {
  console.log('[Storage] loadData started.');
  try {
    await browser.storage.local.remove(FocusFlowState.STORAGE_KEY_TRACKING_STATE);
    console.log('[Storage] Cleared potentially stale tracking state on startup.');

    const keysToLoad = [
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
      'dataRetentionPeriodDays',
    ];

    const result = await browser.storage.local.get(keysToLoad);
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

    await pruneOldData(result['dataRetentionPeriodDays']);

    console.log(
      `[Storage] State loaded: ${FocusFlowState.categories.length} cats, ${
        Object.keys(FocusFlowState.categoryAssignments).length
      } assigns, ${FocusFlowState.rules.length} rules.`
    );
    console.log('[Storage] loadData finished.');
  } catch (error) {
    console.error('[Storage] CRITICAL Error during loadData:', error);
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

function saveDataBatched() {
  if (FocusFlowState.saveTimeoutId) {
    clearTimeout(FocusFlowState.saveTimeoutId);
  }
  FocusFlowState.saveTimeoutId = setTimeout(() => {
    performSave();
    FocusFlowState.saveTimeoutId = null;
  }, FocusFlowState.SAVE_DATA_DEBOUNCE_MS);
}

/**
 * Deletes daily and hourly tracking data older than the configured retention period.
 * @param {number|undefined} [retentionDaysSetting] - Optional pre-fetched retention setting. If not provided, it will be fetched from storage.
 */
async function pruneOldData(retentionDaysSetting = undefined) {
  console.log('[Pruning] Checking for old data to prune...');
  let retentionDays = retentionDaysSetting;

  try {
    if (retentionDays === undefined) {
      const result = await browser.storage.local.get(FocusFlowState.STORAGE_KEY_DATA_RETENTION_DAYS);
      retentionDays = result[FocusFlowState.STORAGE_KEY_DATA_RETENTION_DAYS];
    }

    if (retentionDays === undefined || retentionDays === null) {
      retentionDays = FocusFlowState.DEFAULT_DATA_RETENTION_DAYS;
    } else {
      retentionDays = parseInt(retentionDays, 10);
    }

    if (isNaN(retentionDays) || retentionDays < 0) {
      console.log('[Pruning] Data retention set to Forever. No pruning needed.');
      return;
    }

    console.log(`[Pruning] Data retention period: ${retentionDays} days.`);

    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() - retentionDays);
    cutoffDate.setHours(0, 0, 0, 0);

    let dataWasPruned = false;

    const pruneObject = (dataObject, objectName) => {
      if (!dataObject) return;
      const keysToDelete = [];
      for (const dateKey in dataObject) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          try {
            const entryDate = new Date(dateKey + 'T00:00:00');
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

    pruneObject(FocusFlowState.dailyDomainData, 'dailyDomainData');
    pruneObject(FocusFlowState.dailyCategoryData, 'dailyCategoryData');
    pruneObject(FocusFlowState.hourlyData, 'hourlyData');

    if (dataWasPruned) {
      console.log('[Pruning] Old data removed. Saving updated state...');
      await performSave();
      console.log('[Pruning] Updated state saved.');
    } else {
      console.log('[Pruning] No old data found to prune.');
    }
  } catch (error) {
    console.error('[Pruning] Error during data pruning:', error);
  }
}
