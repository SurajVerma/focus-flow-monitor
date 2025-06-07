function urlMatchesPattern(url, pattern) {
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
  // 1. Initial checks to ignore irrelevant requests (unchanged)
  if (requestDetails.type !== 'main_frame' || !requestDetails.url || requestDetails.method !== 'GET') {
    return {};
  }
  const requestedUrl = requestDetails.url;
  const blockPageBaseUrl = browser.runtime.getURL('blocked/blocked.html');
  if (
    requestedUrl.startsWith('about:') ||
    requestedUrl.startsWith('moz-extension:') ||
    requestedUrl.startsWith('chrome-extension:') ||
    requestedUrl.startsWith(blockPageBaseUrl)
  ) {
    return {};
  }
  const requestedDomain = getDomain(requestedUrl); // from utils.js
  if (!requestedDomain) {
    return {};
  }

  // 2. Use the fast in-memory cache. Time-limit checks are now removed.
  const currentRules = FocusFlowState.activeBlockingRules;
  if (!currentRules || currentRules.length === 0) {
    return {};
  }

  // 3. Determine category only if a category block rule exists (optimization)
  let determinedCategory = null;
  if (currentRules.some((r) => r.type === 'block-category')) {
    determinedCategory = getCategoryForDomain(requestedDomain); // This now uses the cache
  }

  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const currentDayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];

  for (const rule of currentRules) {
    // ONLY check for permanent/scheduled block types. Limits are handled elsewhere.
    if (!rule.type || !rule.type.startsWith('block-')) {
      continue;
    }

    let ruleMatches = false;
    if (rule.type === 'block-url' && urlMatchesPattern(requestedUrl, rule.value)) {
      ruleMatches = true;
    } else if (rule.type === 'block-category' && determinedCategory === rule.value) {
      ruleMatches = true;
    }

    if (ruleMatches) {
      // Schedule checking logic is fast and can remain here.
      const hasSchedule = rule.startTime && rule.endTime;
      const hasDayRestriction = rule.days && Array.isArray(rule.days) && rule.days.length > 0;
      let blockIsActive = true; // Assume permanent block unless a schedule proves otherwise

      if (hasSchedule || hasDayRestriction) {
        let isWithinTime = !hasSchedule;
        let isCorrectDay = !hasDayRestriction;

        if (hasDayRestriction) {
          isCorrectDay = rule.days.includes(currentDayStr);
        }
        if (hasSchedule && isCorrectDay) {
          isWithinTime = currentTimeStr >= rule.startTime && currentTimeStr < rule.endTime;
        }
        blockIsActive = isCorrectDay && isWithinTime;
      }

      if (blockIsActive) {
        console.log(`[Blocking] *** FAST BLOCK ENFORCED *** for ${rule.type}='${rule.value}'. Redirecting.`);
        const params = new URLSearchParams({
          url: requestedUrl,
          reason: 'block',
          type: rule.type,
          value: rule.value,
          schedule_start: rule.startTime || 'N/A',
          schedule_end: rule.endTime || 'N/A',
          schedule_days: rule.days ? rule.days.join(',') : 'All',
        });
        return { redirectUrl: `${blockPageBaseUrl}?${params.toString()}` };
      }
    }
  }

  // If no block rule matched, allow the request
  return {};
}
