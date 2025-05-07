// background/blocking.js (v0.7.1 - Added Blocking Logs)
console.log('[System] background/blocking.js loaded (v0.7.1 - Added Blocking Logs)');

function urlMatchesPattern(url, pattern) {
  // Using the robust version from previous steps
  if (!url || !pattern) return false;
  const normalize = (input) => {
    try {
      if (input.startsWith('about:') || input.startsWith('moz-extension:') || input.startsWith('chrome-extension:'))
        return null;
      let hostname = new URL(input).hostname;
      return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch {
      return pattern
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
    }
  };
  const normalizedUrlHost = normalize(url);
  if (!normalizedUrlHost) return false;
  const normalizedPattern = pattern
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
  if (normalizedPattern.startsWith('*.')) {
    const basePattern = normalizedPattern.substring(2);
    return normalizedUrlHost === basePattern || normalizedUrlHost.endsWith('.' + basePattern);
  } else {
    return normalizedUrlHost === normalizedPattern;
  }
}

// --- Main Blocking Handler ---
function handleBlockingRequest(requestDetails) {
  // console.log(`[Blocking] Checking request: ${requestDetails.url} (Type: ${requestDetails.type}, Method: ${requestDetails.method})`); // Log every check

  // Ignore irrelevant requests
  if (requestDetails.type !== 'main_frame' || !requestDetails.url || requestDetails.method !== 'GET') {
    // console.log('[Blocking] Ignoring request: Not main_frame or not GET.');
    return {};
  }
  const requestedUrl = requestDetails.url;
  if (
    requestedUrl.startsWith('about:') ||
    requestedUrl.startsWith('moz-extension:') ||
    requestedUrl.startsWith('chrome-extension:')
  ) {
    // console.log('[Blocking] Ignoring request: Internal URL scheme.');
    return {};
  }

  // Allow the block page itself to load
  const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');
  if (requestedUrl.startsWith(blockPageBaseUrl)) {
    // console.log('[Blocking] Allowing request: Is block page.');
    return {};
  }

  const requestedDomain = getDomain(requestedUrl); // Using util function
  if (!requestedDomain) {
    console.warn(`[Blocking] Could not get domain for URL: ${requestedUrl}`);
    return {};
  }

  // --- Log Current State Data ---
  const currentRules = FocusFlowState.rules || []; // Get rules from state.js
  const currentAssignments = FocusFlowState.categoryAssignments || {}; // Get assignments from state.js
  console.log(`[Blocking] Checking against ${currentRules.length} rules for domain: ${requestedDomain}`);
  // console.log('[Blocking] Current Rules:', JSON.stringify(currentRules)); // Can be verbose

  // Access other needed state
  const todayStr = getCurrentDateString(); // Using util function
  const todaysDomainData = FocusFlowState.dailyDomainData[todayStr] || {};
  const todaysCategoryData = FocusFlowState.dailyCategoryData[todayStr] || {};
  let determinedCategory = null; // Lazy load category

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  const currentDayIndex = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDayStr = dayMap[currentDayIndex];

  console.log(`[Blocking] Check time: ${currentTimeStr}, Day: ${currentDayStr}`); // Log current time/day

  // --- Check Limit Rules First ---
  console.log('[Blocking] === Checking Limit Rules ===');
  for (const rule of currentRules) {
    if (!rule.type || !rule.type.startsWith('limit-') || !rule.value || !rule.limitSeconds || rule.limitSeconds <= 0)
      continue;

    let ruleMatches = false;
    let timeSpentToday = 0;
    const limitSeconds = rule.limitSeconds;
    const targetValue = rule.value;
    let matchReason = '';

    try {
      if (rule.type === 'limit-url') {
        const patternMatch = urlMatchesPattern(requestedUrl, targetValue);
        if (patternMatch) {
          ruleMatches = true;
          matchReason = `URL pattern "${targetValue}" matched`;
          // Sum time for matching domains based on pattern type
          let timeSum = 0;
          if (targetValue.startsWith('*.')) {
            const basePattern = targetValue.substring(2);
            for (const domain in todaysDomainData) {
              if (domain === basePattern || domain.endsWith('.' + basePattern)) {
                timeSum += todaysDomainData[domain];
              }
            }
          } else {
            if (todaysDomainData.hasOwnProperty(targetValue)) {
              // Use targetValue for exact match lookup
              timeSum = todaysDomainData[targetValue];
            }
          }
          timeSpentToday = timeSum;
        }
      } else if (rule.type === 'limit-category') {
        if (!determinedCategory) determinedCategory = getCategoryForDomain(requestedDomain); // Util uses FocusFlowState.categoryAssignments
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
          matchReason = `Category "${targetValue}" matched (Domain: ${requestedDomain} -> Category: ${determinedCategory})`;
          timeSpentToday = todaysCategoryData[determinedCategory] || 0;
        }
      }

      if (ruleMatches) {
        console.log(
          `[Blocking] Rule ${rule.type}="${targetValue}" matched (${matchReason}). Spent: ${Math.round(
            timeSpentToday
          )}s, Limit: ${limitSeconds}s`
        );
        const limitReached = timeSpentToday >= limitSeconds;
        if (limitReached) {
          console.log(`[Blocking] *** LIMIT ENFORCED *** for ${rule.type}='${targetValue}'. Redirecting.`);
          const params = new URLSearchParams();
          params.append('url', requestedUrl);
          params.append('reason', 'limit');
          params.append('type', rule.type);
          params.append('value', targetValue);
          params.append('limit', limitSeconds.toString());
          params.append('spent', timeSpentToday.toString());
          return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
        } else {
          console.log(`[Blocking] Limit not reached.`);
        }
      }
      // else { console.log(`[Blocking] Rule ${rule.type}="${targetValue}" did NOT match URL/Category.`); } // Verbose
    } catch (e) {
      console.error(`[Blocking] Error during limit check for rule ${JSON.stringify(rule)}:`, e);
    }
  } // End limit rules loop

  // --- Check Block Rules (MODIFIED) ---
  console.log('[Blocking] === Checking Block Rules ===');
  if (!determinedCategory && currentRules.some((r) => r.type === 'block-category')) {
    determinedCategory = getCategoryForDomain(requestedDomain); // Determine category only if needed
  }

  for (const rule of currentRules) {
    if (!rule.type || !rule.type.startsWith('block-') || !rule.value) continue;

    let ruleMatches = false;
    const targetValue = rule.value;
    let matchReason = '';

    try {
      // Check if URL or Category matches first
      if (rule.type === 'block-url') {
        if (urlMatchesPattern(requestedUrl, targetValue)) {
          ruleMatches = true;
          matchReason = `URL pattern "${targetValue}" matched`;
        }
      } else if (rule.type === 'block-category') {
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
          matchReason = `Category "${targetValue}" matched`;
        }
      }

      // If it matches, THEN check the schedule
      if (ruleMatches) {
        console.log(`[Blocking] Rule ${rule.type}="${targetValue}" matched (${matchReason}). Checking schedule...`);

        // --- Schedule Checking Logic ---
        const hasSchedule = rule.startTime && rule.endTime;
        const hasDayRestriction = rule.days && Array.isArray(rule.days) && rule.days.length > 0;
        let blockIsActive = true; // Assume block is active unless schedule says otherwise

        if (hasSchedule || hasDayRestriction) {
          let isWithinTime = !hasSchedule; // If no time set, it's always "within time"
          let isCorrectDay = !hasDayRestriction; // If no days set, it's always the "correct day"

          // Check day if restricted
          if (hasDayRestriction) {
            if (rule.days.includes(currentDayStr)) {
              isCorrectDay = true;
            } else {
              isCorrectDay = false; // Not the right day
            }
          }

          // Check time if restricted (and it's the correct day or day doesn't matter)
          if (hasSchedule && isCorrectDay) {
            if (currentTimeStr >= rule.startTime && currentTimeStr < rule.endTime) {
              isWithinTime = true;
            } else {
              isWithinTime = false; // Outside the time window
            }
          }

          // Block is active ONLY if it's the correct day AND within the time window (if applicable)
          blockIsActive = isCorrectDay && isWithinTime;

          if (blockIsActive) {
            console.log(`[Blocking] Schedule MATCHES current time/day (${currentTimeStr}, ${currentDayStr}).`);
          } else {
            console.log(`[Blocking] Schedule does NOT match current time/day. Allowing access.`);
          }
        } else {
          console.log(`[Blocking] Rule has no schedule (Permanent block).`);
          blockIsActive = true; // No schedule = always active block
        }
        // --- End Schedule Checking Logic ---

        // If the block rule is determined to be active, redirect.
        if (blockIsActive) {
          console.log(`[Blocking] *** BLOCK ENFORCED *** for ${rule.type}='${targetValue}'. Redirecting.`);
          const params = new URLSearchParams();
          params.append('url', requestedUrl);
          params.append('reason', 'block'); // Use 'block' or maybe 'scheduled_block'?
          params.append('type', rule.type);
          params.append('value', targetValue);
          // Optionally add schedule info to params if needed on block page
          if (hasSchedule || hasDayRestriction) {
            params.append('schedule_start', rule.startTime || 'N/A');
            params.append('schedule_end', rule.endTime || 'N/A');
            params.append('schedule_days', rule.days ? rule.days.join(',') : 'All');
          }
          return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
        }
      } // end if (ruleMatches)
    } catch (e) {
      console.error(`[Blocking] Error during block check for rule ${JSON.stringify(rule)}:`, e);
    }
  } // End block rules loop

  console.log(`[Blocking] No blocking/limiting rules triggered for ${requestedUrl}`);
  return {}; // Allow request
}

console.log('[System] background/blocking.js loaded (v0.7.1 - Added Blocking Logs)');
