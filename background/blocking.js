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

  // --- Check Block Rules ---
  console.log('[Blocking] === Checking Block Rules ===');
  if (!determinedCategory && currentRules.some((r) => r.type === 'block-category')) {
    determinedCategory = getCategoryForDomain(requestedDomain); // Determine category only if needed for a block rule
    console.log(`[Blocking] Determined category for block check: ${determinedCategory}`);
  }

  for (const rule of currentRules) {
    if (!rule.type || !rule.type.startsWith('block-') || !rule.value) continue;

    let ruleMatches = false;
    const targetValue = rule.value;
    let matchReason = '';

    try {
      if (rule.type === 'block-url') {
        if (urlMatchesPattern(requestedUrl, targetValue)) {
          ruleMatches = true;
          matchReason = `URL pattern "${targetValue}" matched`;
        }
      } else if (rule.type === 'block-category') {
        // Category determined above if needed
        if (determinedCategory && determinedCategory === targetValue) {
          ruleMatches = true;
          matchReason = `Category "${targetValue}" matched (Domain: ${requestedDomain} -> Category: ${determinedCategory})`;
        }
      }

      if (ruleMatches) {
        console.log(
          `[Blocking] *** BLOCK ENFORCED *** for ${rule.type}='${targetValue}' (${matchReason}). Redirecting.`
        );
        const params = new URLSearchParams();
        params.append('url', requestedUrl);
        params.append('reason', 'block');
        params.append('type', rule.type);
        params.append('value', targetValue);
        return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
      }
      // else { console.log(`[Blocking] Rule ${rule.type}="${targetValue}" did NOT match URL/Category.`); } // Verbose
    } catch (e) {
      console.error(`[Blocking] Error during block check for rule ${JSON.stringify(rule)}:`, e);
    }
  } // End block rules loop

  console.log(`[Blocking] No blocking/limiting rules triggered for ${requestedUrl}`);
  return {}; // Allow request
}

console.log('[System] background/blocking.js loaded (v0.7.1 - Added Blocking Logs)');
