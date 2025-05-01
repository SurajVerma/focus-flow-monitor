// options/options-ui.js (v0.7.4 - Full Edit Category UI)

// --- UI Population/Display Functions ---

function displayDomainTime(itemsToDisplay) {
  if (!UIElements.detailedTimeList) return;
  UIElements.detailedTimeList.replaceChildren();
  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    const li = document.createElement('li');
    li.textContent =
      AppState.fullDomainDataSorted.length === 0 ? 'No domain data for this period.' : 'No domains on this page.';
    UIElements.detailedTimeList.appendChild(li);
    return;
  }
  itemsToDisplay.forEach((item) => {
    const li = document.createElement('li');
    const domainSpan = document.createElement('span');
    domainSpan.textContent = item.domain;
    domainSpan.className = 'domain';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(item.time, true); // From utils.js
    timeSpan.className = 'time';
    li.appendChild(domainSpan);
    li.appendChild(timeSpan);
    UIElements.detailedTimeList.appendChild(li);
  });
}

function displayCategoryTime(dataToDisplay) {
  if (!UIElements.categoryTimeList) return;
  UIElements.categoryTimeList.replaceChildren();
  if (!dataToDisplay || Object.keys(dataToDisplay).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No category data for this period.';
    UIElements.categoryTimeList.appendChild(li);
    return;
  }
  const sortedData = Object.entries(dataToDisplay)
    .map(([category, time]) => ({ category, time }))
    .filter((item) => item.time > 0.1)
    .sort((a, b) => b.time - a.time);

  if (sortedData.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No significant category data for this period.';
    UIElements.categoryTimeList.appendChild(li);
    return;
  }

  sortedData.forEach((item) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.category;
    nameSpan.className = 'category-name';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatTime(item.time, true); // From utils.js
    timeSpan.className = 'time';
    li.appendChild(nameSpan);
    li.appendChild(timeSpan);
    UIElements.categoryTimeList.appendChild(li);
  });
}

function populateCategoryList() {
  if (!UIElements.categoryList) {
    console.error('Category list UI element not found!');
    return;
  }
  // *** Use replaceChildren for safety ***
  UIElements.categoryList.replaceChildren();

  if (!AppState.categories || AppState.categories.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No categories defined.';
    UIElements.categoryList.appendChild(li);
    return;
  }

  // Sort categories alphabetically for display, keeping 'Other' last
  const sortedCategories = [...AppState.categories].sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  sortedCategories.forEach((cat) => {
    const li = document.createElement('li'); // Define li here
    li.classList.add('category-list-item');
    li.dataset.categoryName = cat; // Store name for editing logic

    // Span to display the category name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name-display';
    nameSpan.textContent = cat;
    li.appendChild(nameSpan); // Add the name span first

    // Input field for editing (initially hidden)
    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'category-edit-input';
    inputField.value = cat; // Pre-fill with current name
    inputField.style.display = 'none'; // Hide initially
    inputField.style.marginRight = '10px'; // Add some spacing
    // *** Corrected: Insert input field into the list item 'li' ***
    li.insertBefore(inputField, nameSpan); // Insert input before the name span

    // Container for buttons
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'category-controls';

    if (cat !== 'Other') {
      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'edit-btn category-edit-btn';
      editBtn.dataset.category = cat;
      controlsDiv.appendChild(editBtn);

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn category-delete-btn';
      deleteBtn.dataset.category = cat;
      controlsDiv.appendChild(deleteBtn);

      // Save Button (initially hidden)
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.className = 'save-btn category-save-btn'; // Specific class
      saveBtn.style.display = 'none'; // Hide initially
      controlsDiv.appendChild(saveBtn);

      // Cancel Button (initially hidden)
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'cancel-btn category-cancel-btn'; // Specific class
      cancelBtn.style.display = 'none'; // Hide initially
      controlsDiv.appendChild(cancelBtn);
    } else {
      // Add placeholder space for 'Other' to align controls if needed
      controlsDiv.style.minWidth = '80px'; // Adjust as needed based on button sizes
    }

    li.appendChild(controlsDiv); // Add the controls div to the list item
    UIElements.categoryList.appendChild(li); // Add the completed list item to the list
  });
}

function populateCategorySelect() {
  if (!UIElements.categorySelect) return;
  UIElements.categorySelect.replaceChildren();
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select Category';
  UIElements.categorySelect.appendChild(defaultOption);
  AppState.categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    UIElements.categorySelect.appendChild(option);
  });
}

function populateAssignmentList() {
  if (!UIElements.assignmentList) return;
  UIElements.assignmentList.replaceChildren();
  if (Object.keys(AppState.categoryAssignments).length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No domains assigned yet.';
    UIElements.assignmentList.appendChild(li);
    return;
  }
  const sortedAssignments = Object.entries(AppState.categoryAssignments).sort((a, b) => a[0].localeCompare(b[0]));

  sortedAssignments.forEach(([domain, category]) => {
    const li = document.createElement('li');
    li.classList.add('assignment-list-item'); // Add class

    const domainSpan = document.createElement('span');
    domainSpan.textContent = domain;
    domainSpan.className = 'assignment-domain';
    li.appendChild(domainSpan); // Add domain first

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'assignment-controls'; // Class for styling controls together

    const categorySpan = document.createElement('span');
    categorySpan.textContent = category;
    categorySpan.className = 'assignment-category';
    controlsDiv.appendChild(categorySpan); // Add category to controls

    // *** ADDED: Edit Button for Assignments ***
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'edit-btn assignment-edit-btn'; // Specific class
    editBtn.dataset.domain = domain; // Store domain for handler
    controlsDiv.appendChild(editBtn);

    // Delete Button (no change, just ensure it's after edit)
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn assignment-delete-btn'; // Specific class
    deleteBtn.dataset.domain = domain; // Used by handler
    controlsDiv.appendChild(deleteBtn);

    li.appendChild(controlsDiv); // Append controls div to the list item
    UIElements.assignmentList.appendChild(li);
  });
}

function populateRuleCategorySelect() {
  if (UIElements.ruleCategorySelect) {
    UIElements.ruleCategorySelect.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Category';
    UIElements.ruleCategorySelect.appendChild(defaultOption);
    AppState.categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      UIElements.ruleCategorySelect.appendChild(option);
    });
  }
  if (UIElements.editRuleCategorySelect) {
    UIElements.editRuleCategorySelect.replaceChildren();
    const defaultEditOption = document.createElement('option');
    defaultEditOption.value = '';
    defaultEditOption.textContent = 'Select Category';
    UIElements.editRuleCategorySelect.appendChild(defaultEditOption);
    AppState.categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      UIElements.editRuleCategorySelect.appendChild(option);
    });
  } else {
    console.error('Edit rule category select element not found during population!');
  }
}

// *** NEW: Function to populate category select in Edit Assignment modal ***
function populateEditAssignmentCategorySelect() {
  if (!UIElements.editAssignmentCategorySelect) {
    console.error('Edit assignment category select element not found!');
    return;
  }
  UIElements.editAssignmentCategorySelect.replaceChildren(); // Clear existing options

  // Add current categories (excluding maybe 'Other' if you don't want direct assignment?)
  // For now, include 'Other'
  AppState.categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    UIElements.editAssignmentCategorySelect.appendChild(option);
  });
}

function populateRuleList() {
  if (!UIElements.ruleList) return;
  UIElements.ruleList.replaceChildren();
  if (!AppState.rules || !Array.isArray(AppState.rules)) {
    const li = document.createElement('li');
    li.textContent = 'Error: Rule data is invalid.';
    UIElements.ruleList.appendChild(li);
    return;
  }
  if (AppState.rules.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No blocking or limiting rules are currently set.';
    UIElements.ruleList.appendChild(li);
    return;
  }
  try {
    AppState.rules.forEach((rule, index) => {
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
      UIElements.ruleList.appendChild(li);
    });
  } catch (e) {
    console.error('Error populating rule list:', e);
    const li = document.createElement('li');
    li.textContent = 'Error displaying rules.';
    UIElements.ruleList.appendChild(li);
  }
}

// --- Calendar Rendering & Interaction ---
function renderCalendar(year, month) {
  if (!UIElements.calendarGrid || !UIElements.currentMonthYearSpan) return;
  const todayStr = getCurrentDateString(); // from utils.js
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
  UIElements.currentMonthYearSpan.textContent = `${monthNames[month]} ${year}`;
  UIElements.calendarGrid.querySelectorAll('.calendar-day, .empty').forEach((cell) => cell.remove());
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
    const dateStr = formatDate(date); // from utils.js
    if (dateStr === todayStr) dayCell.classList.add('today');
    dayCell.dataset.date = dateStr;
    const dayNumberSpan = document.createElement('span');
    dayNumberSpan.classList.add('day-number');
    dayNumberSpan.textContent = day;
    dayCell.appendChild(dayNumberSpan);
    const dailyTotalSeconds = Object.values(AppState.dailyDomainData[dateStr] || {}).reduce(
      (sum, time) => sum + time,
      0
    );
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('day-time');
    if (dailyTotalSeconds > 0) {
      timeSpan.textContent = formatTime(dailyTotalSeconds, false);
    } // from utils.js
    else {
      timeSpan.textContent = '-';
      timeSpan.classList.add('no-data');
    }
    dayCell.appendChild(timeSpan);
    if (dailyTotalSeconds > 0) {
      dayCell.addEventListener('mouseover', handleCalendarMouseOver);
      dayCell.addEventListener('focus', handleCalendarMouseOver);
      dayCell.addEventListener('mouseout', handleCalendarMouseOut);
      dayCell.addEventListener('blur', handleCalendarMouseOut);
      dayCell.addEventListener('click', handleCalendarDayClick);
      dayCell.setAttribute('tabindex', '0');
    } else {
      dayCell.style.cursor = 'default';
    }
    fragment.appendChild(dayCell);
  }
  UIElements.calendarGrid.appendChild(fragment);
}

function showDayDetailsPopup(event) {
  const dayCell = event.target.closest('.calendar-day');
  if (!dayCell || !UIElements.calendarDetailPopup) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;
  const dayDomainData = AppState.dailyDomainData[dateStr] || {};
  const totalSeconds = Object.values(dayDomainData).reduce((s, t) => s + t, 0);
  const topDomains = Object.entries(dayDomainData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  UIElements.calendarDetailPopup.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = formatDisplayDate(dateStr);
  UIElements.calendarDetailPopup.appendChild(heading); // from utils.js
  const totalText = document.createTextNode(`Total: ${formatTime(totalSeconds, true)}`);
  UIElements.calendarDetailPopup.appendChild(totalText);
  UIElements.calendarDetailPopup.appendChild(document.createElement('br')); // from utils.js
  if (topDomains.length > 0) {
    const sitesHeading = document.createTextNode('Top Sites:');
    const sitesList = document.createElement('ul');
    topDomains.forEach(([domain, time]) => {
      const li = document.createElement('li');
      li.textContent = `${domain}: ${formatTime(time, false)}`;
      sitesList.appendChild(li);
    }); // from utils.js
    UIElements.calendarDetailPopup.appendChild(document.createElement('br'));
    UIElements.calendarDetailPopup.appendChild(sitesHeading);
    UIElements.calendarDetailPopup.appendChild(sitesList);
  } else {
    const noData = document.createTextNode('No site data recorded.');
    UIElements.calendarDetailPopup.appendChild(noData);
  }
  // Positioning Logic
  const container = document.querySelector('.calendar-container');
  if (!container) return;
  const dayRect = dayCell.getBoundingClientRect();
  const contRect = container.getBoundingClientRect();
  let top = dayCell.offsetTop + dayCell.offsetHeight + 5;
  let left = dayCell.offsetLeft + dayCell.offsetWidth / 2;
  UIElements.calendarDetailPopup.style.position = 'absolute';
  UIElements.calendarDetailPopup.style.display = 'block';
  UIElements.calendarDetailPopup.style.left = `${left}px`;
  UIElements.calendarDetailPopup.style.top = `${top}px`;
  UIElements.calendarDetailPopup.style.transform = 'translateX(-50%)';
  const popupRect = UIElements.calendarDetailPopup.getBoundingClientRect();
  if (popupRect.bottom > window.innerHeight) top = dayCell.offsetTop - popupRect.height - 5;
  if (popupRect.right > window.innerWidth) {
    left = dayRect.right - popupRect.width;
    UIElements.calendarDetailPopup.style.transform = 'translateX(0)';
  } else if (popupRect.left < 0) {
    left = dayRect.left;
    UIElements.calendarDetailPopup.style.transform = 'translateX(0)';
  }
  UIElements.calendarDetailPopup.style.top = `${top}px`;
  UIElements.calendarDetailPopup.style.left = `${left}px`;
}

function hideDayDetailsPopup() {
  if (UIElements.calendarDetailPopup) UIElements.calendarDetailPopup.style.display = 'none';
}

function highlightSelectedCalendarDay(dateStrToSelect) {
  if (!UIElements.calendarGrid) return;
  UIElements.calendarGrid.querySelectorAll('.calendar-day').forEach((day) => {
    if (day.dataset.date === dateStrToSelect) day.classList.add('selected');
    else day.classList.remove('selected');
  });
}

// --- Chart Rendering ---
function renderChart(data, periodLabel = 'Selected Period', viewMode = 'domain') {
  if (typeof Chart === 'undefined') {
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
  if (AppState.timeChart) {
    AppState.timeChart.destroy();
    AppState.timeChart = null;
  }
  if (!data || Object.keys(data).length === 0) {
    clearChartOnError(`No data for ${periodLabel}`);
    return;
  }
  const maxSlices = 10;
  let sortedData, otherLabel;
  if (viewMode === 'category') {
    sortedData = Object.entries(data)
      .map(([n, t]) => ({ name: n, time: t }))
      .filter((i) => i.time > 0.1)
      .sort((a, b) => b.time - a.time);
    otherLabel = 'Other Categories';
  } else {
    sortedData = Object.entries(data)
      .map(([n, t]) => ({ name: n, time: t }))
      .filter((i) => i.time > 0.1)
      .sort((a, b) => b.time - a.time);
    otherLabel = 'Other Domains';
  }
  if (sortedData.length === 0) {
    clearChartOnError(`No significant data for ${periodLabel}`);
    return;
  }
  let labels = sortedData.map((i) => i.name),
    times = sortedData.map((i) => i.time);
  if (sortedData.length > maxSlices) {
    const top = sortedData.slice(0, maxSlices - 1);
    labels = top.map((i) => i.name);
    times = top.map((i) => i.time);
    const other = sortedData.slice(maxSlices - 1).reduce((s, i) => s + i.time, 0);
    if (other > 0.1) {
      labels.push(otherLabel);
      times.push(other);
    }
  }
  const defaultPalette = [
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
    backgroundColors = labels.map((l) => getCategoryColor(l));
    if (labels.includes(otherLabel)) backgroundColors[labels.indexOf(otherLabel)] = getCategoryColor('Other');
  } // from utils.js
  else {
    backgroundColors = labels.map((_, i) => defaultPalette[i % defaultPalette.length]);
    if (labels.includes(otherLabel)) backgroundColors[labels.indexOf(otherLabel)] = getCategoryColor('Other');
  } // from utils.js
  try {
    AppState.timeChart = new Chart(ctx, {
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
              label: (c) => {
                let l = c.label || '';
                if (l) l += ': ';
                if (c.parsed !== null && c.parsed !== undefined) l += formatTime(c.parsed, true);
                return l;
              },
            },
          }, // from utils.js
        },
      },
    });
  } catch (e) {
    console.error('Error creating chart:', e);
    clearChartOnError('Error rendering chart.');
  }
}

function clearChartOnError(message = 'Error loading chart data') {
  const canvas = document.getElementById('timeChartCanvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (AppState.timeChart) {
      AppState.timeChart.destroy();
      AppState.timeChart = null;
    }
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    const words = message.split(' ');
    let line = '';
    let y = canvas.height / 2 - 10;
    const maxW = canvas.width * 0.8;
    for (let n = 0; n < words.length; n++) {
      let tLine = line + words[n] + ' ';
      let mW = ctx.measureText(tLine).width;
      if (mW > maxW && n > 0) {
        ctx.fillText(line, canvas.width / 2, y);
        line = words[n] + ' ';
        y += 18;
      } else line = tLine;
    }
    ctx.fillText(line, canvas.width / 2, y);
  }
}

/**
 * Populates the Productivity Settings list in the options page.
 */
function populateProductivitySettings() {
  if (!UIElements.productivitySettingsList) {
    console.error('Productivity settings list UI element not found!');
    return;
  }
  // Ensure constants are accessible (they are global from options-state.js)
  if (typeof PRODUCTIVITY_TIERS === 'undefined' || typeof defaultCategoryProductivityRatings === 'undefined') {
    console.error('Productivity constants not found. Ensure options-state.js is loaded first.');
    UIElements.productivitySettingsList.innerHTML = '<li>Error loading settings.</li>';
    return;
  }

  const userRatings = AppState.categoryProductivityRatings || {}; // Use ratings loaded into AppState
  const categories = AppState.categories || [];

  UIElements.productivitySettingsList.replaceChildren(); // Clear previous items

  if (!categories || categories.length === 0) {
    UIElements.productivitySettingsList.innerHTML = '<li>No categories found.</li>';
    return;
  }

  // Sort categories alphabetically for display, maybe keep 'Other' last
  const sortedCategories = [...categories].sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  const fragment = document.createDocumentFragment();

  sortedCategories.forEach((category) => {
    const li = document.createElement('li');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    nameSpan.textContent = category;
    li.appendChild(nameSpan);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'rating-controls';

    // Determine current rating: User > Default > Neutral
    const currentRating =
      userRatings[category] ?? defaultCategoryProductivityRatings[category] ?? PRODUCTIVITY_TIERS.NEUTRAL;

    // Create radio buttons for Productive, Neutral, Distracting
    Object.entries(PRODUCTIVITY_TIERS).forEach(([tierName, tierValue]) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `rating-${category.replace(/[^a-zA-Z0-9]/g, '-')}`; // Create a unique name for the group
      radio.value = tierValue;
      radio.dataset.category = category; // Store category name
      radio.checked = currentRating === tierValue; // Check the current rating

      label.appendChild(radio);
      // Make tier names user-friendly (e.g., PRODUCTIVE -> Productive)
      const labelText = tierName.charAt(0) + tierName.slice(1).toLowerCase();
      label.appendChild(document.createTextNode(` ${labelText}`)); // Add space
      controlsDiv.appendChild(label);
    });

    li.appendChild(controlsDiv);
    fragment.appendChild(li);
  });

  UIElements.productivitySettingsList.appendChild(fragment);
}

console.log('[System] options-ui.js loaded (v0.7.4)');
