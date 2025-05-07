// options/options-handlers.js (v0.8.2 - Block Page Customization Handlers)

// --- Helper to reset category list item UI ---
function resetCategoryItemUI(listItem) {
  if (!listItem) return;
  const categoryNameSpan = listItem.querySelector('.category-name-display');
  const inputField = listItem.querySelector('.category-edit-input');
  const controlsDiv = listItem.querySelector('.category-controls');
  if (!categoryNameSpan || !controlsDiv) {
    console.warn('Could not find expected elements in category list item for UI reset.');
    return;
  }
  if (inputField) {
    inputField.style.display = 'none';
  }
  categoryNameSpan.style.display = 'inline-block'; // Use inline-block or block as appropriate

  const editBtn = controlsDiv.querySelector('.category-edit-btn');
  const deleteBtn = controlsDiv.querySelector('.category-delete-btn');
  const saveBtn = controlsDiv.querySelector('.category-save-btn');
  const cancelBtn = controlsDiv.querySelector('.category-cancel-btn');

  if (editBtn) editBtn.style.display = 'inline-block';
  if (deleteBtn) deleteBtn.style.display = 'inline-block';
  if (saveBtn) saveBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';

  // Clean up temporary data
  if (listItem.dataset.originalName) delete listItem.dataset.originalName;
}

// --- Event Handlers ---
function handleAddCategory() {
  try {
    if (!UIElements.newCategoryNameInput) return;
    const name = UIElements.newCategoryNameInput.value.trim();
    if (!name) {
      alert('Please enter a category name.');
      return;
    }
    if (AppState.categories.some((cat) => cat.toLowerCase() === name.toLowerCase())) {
      alert(`Category "${name}" already exists.`);
      return;
    }
    AppState.categories.push(name);
    AppState.categories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    UIElements.newCategoryNameInput.value = '';
    // Save and update UI
    saveCategoriesAndAssignments(); // from main.js
    populateCategoryList();
    populateCategorySelect();
    populateRuleCategorySelect(); // from ui.js
    populateProductivitySettings(); // Also update productivity settings list
  } catch (e) {
    console.error('Error adding category:', e);
    alert('Failed to add category.');
  }
}

function handleAssignDomain() {
  try {
    if (!UIElements.domainPatternInput || !UIElements.categorySelect) return;
    const domainPattern = UIElements.domainPatternInput.value.trim();
    const category = UIElements.categorySelect.value;
    if (!domainPattern) {
      alert('Please enter a domain pattern (e.g., google.com or *.example.com).');
      return;
    }
    if (!category) {
      alert('Please select a category.');
      return;
    }
    // Basic pattern validation (can be enhanced)
    const domainRegex = /^(?:([\w\-*]+)\.)?([\w\-]+)\.([a-z\.]{2,})$/i; // Allows *. and basic domain/TLD
    const hostnameRegex = /^[\w\-]+$/i; // Allows simple hostname without TLD (e.g., localhost)
    const isValidDomain = domainRegex.test(domainPattern);
    const isValidWildcard = domainPattern.startsWith('*.') && domainRegex.test(domainPattern.substring(2));
    const isValidHostname = hostnameRegex.test(domainPattern); // Allow simple hostnames
    const allowPattern = isValidDomain || isValidWildcard || isValidHostname;
    if (!allowPattern) {
      alert(
        'Invalid domain/pattern format.\nPlease use format like "example.com", "*.example.com", or "subdomain.example.com".'
      );
      return;
    }

    const existingPattern = Object.keys(AppState.categoryAssignments).find(
      (key) => key.toLowerCase() === domainPattern.toLowerCase()
    );

    if (existingPattern && AppState.categoryAssignments[existingPattern] === category) {
      alert(`"${domainPattern}" is already assigned to the "${category}" category.`);
      return;
    }

    // Handle re-assignment explicitly
    if (existingPattern && AppState.categoryAssignments[existingPattern] !== category) {
      if (
        !confirm(
          `"${domainPattern}" is already assigned to "${AppState.categoryAssignments[existingPattern]}".\nDo you want to reassign it to "${category}"?`
        )
      ) {
        return;
      }
      const oldCategory = AppState.categoryAssignments[existingPattern];
      AppState.categoryAssignments[domainPattern] = category; // Update state first

      saveCategoriesAndAssignments()
        .then(() => {
          // Save async
          populateAssignmentList(); // Refresh list UI
          // Recalculate totals after save
          return recalculateAndUpdateCategoryTotals({
            // Async recalculate
            type: 'assignmentChange',
            domain: domainPattern, // Use the pattern saved
            oldCategory: oldCategory,
            newCategory: category,
          });
        })
        .then(() => {
          updateDisplayForSelectedRangeUI(); // Refresh stats UI after recalc
        })
        .catch((error) => {
          console.error('Error reassigning domain or recalculating:', error);
          alert('Failed to reassign domain. Check console for errors.');
        });
      UIElements.domainPatternInput.value = '';
      UIElements.categorySelect.value = '';
      return; // Exit here as async ops handle UI refresh
    }

    // If it's a new assignment
    AppState.categoryAssignments[domainPattern] = category;
    UIElements.domainPatternInput.value = '';
    UIElements.categorySelect.value = '';
    saveCategoriesAndAssignments();
    populateAssignmentList();
    // For new assignments, a full recalc might be needed if the domain was previously tracked under "Other"
    recalculateAndUpdateCategoryTotals({
      type: 'assignmentChange',
      domain: domainPattern,
      oldCategory: 'Other', // Assume it might have been "Other"
      newCategory: category,
    }).then(() => {
      updateDisplayForSelectedRangeUI();
    });
  } catch (e) {
    console.error('Error assigning domain:', e);
    alert('Failed to assign domain.');
  }
}

function handleDeleteCategory(event) {
  try {
    if (!event.target.classList.contains('category-delete-btn') || !event.target.closest('#categoryList')) return;
    const categoryToDelete = event.target.dataset.category;
    if (categoryToDelete && categoryToDelete !== 'Other') {
      if (
        confirm(
          `DELETE CATEGORY?\n"${categoryToDelete}"\nThis also removes related domain assignments and potentially rules. Tracked time for these domains will be moved to 'Other'.`
        )
      ) {
        const oldCategoryName = categoryToDelete;
        AppState.categories = AppState.categories.filter((cat) => cat !== oldCategoryName);
        let assignmentsChanged = false,
          rulesChanged = false;

        // Update assignments: move to 'Other'
        for (const domain in AppState.categoryAssignments) {
          if (AppState.categoryAssignments[domain] === oldCategoryName) {
            // Instead of deleting, reassign to 'Other' or a user-selected category
            // For simplicity here, let's assume we might delete or reassign to 'Other'
            // If reassigning, the recalculate function will handle it.
            // If just deleting the assignment, then time would naturally fall to 'Other' if no other rule matches.
            // Let's assume for now we delete the assignment, and time will be recategorized by getCategoryForDomain.
            delete AppState.categoryAssignments[domain];
            assignmentsChanged = true;
          }
        }
        // Update rules
        const originalRulesLength = AppState.rules.length;
        AppState.rules = AppState.rules.filter(
          (rule) => !(rule.type.includes('-category') && rule.value === oldCategoryName)
        );
        rulesChanged = AppState.rules.length !== originalRulesLength;

        // Save changes
        const savePromises = [saveCategoriesAndAssignments()];
        if (rulesChanged) savePromises.push(saveRules());

        Promise.all(savePromises)
          .then(() => {
            console.log('Category and related data updated/deleted successfully.');
            // Recalculate totals as assignments have changed
            return recalculateAndUpdateCategoryTotals({
              type: 'categoryDelete',
              oldCategory: oldCategoryName,
              newCategory: 'Other', // Indicate time should effectively move
            });
          })
          .then(() => {
            // Refresh UI completely
            populateCategoryList();
            populateCategorySelect();
            populateRuleCategorySelect();
            populateAssignmentList();
            populateRuleList();
            populateProductivitySettings();
            updateDisplayForSelectedRangeUI();
          })
          .catch((error) => {
            console.error('Error saving or recalculating after category deletion:', error);
            alert('Failed to save changes after deleting category. Please refresh.');
            loadAllData();
          });
      }
    }
  } catch (e) {
    console.error('Error deleting category:', e);
    alert('An error occurred while trying to delete the category.');
  }
}

function handleEditCategoryClick(event) {
  if (!event.target.classList.contains('category-edit-btn')) return;
  const listItem = event.target.closest('.category-list-item');
  const categoryNameSpan = listItem.querySelector('.category-name-display');
  const controlsDiv = listItem.querySelector('.category-controls');
  if (!listItem || !categoryNameSpan || !controlsDiv) return;

  const currentlyEditing = document.querySelector(
    '.category-list-item .category-edit-input:not([style*="display: none"])'
  );
  if (currentlyEditing && currentlyEditing.closest('.category-list-item') !== listItem) {
    const otherCancelBtn = currentlyEditing.closest('.category-list-item').querySelector('.category-cancel-btn');
    if (otherCancelBtn) otherCancelBtn.click();
  }

  const currentName = categoryNameSpan.textContent;
  listItem.dataset.originalName = currentName;

  let inputField = listItem.querySelector('.category-edit-input');
  if (!inputField) {
    console.error('Edit input field not found in category list item.');
    return;
  }

  inputField.value = currentName;
  inputField.style.display = 'inline-block';
  inputField.select();
  categoryNameSpan.style.display = 'none';
  controlsDiv.querySelector('.category-edit-btn').style.display = 'none';
  controlsDiv.querySelector('.category-delete-btn').style.display = 'none';
  controlsDiv.querySelector('.category-save-btn').style.display = 'inline-block';
  controlsDiv.querySelector('.category-cancel-btn').style.display = 'inline-block';
}

function handleCancelCategoryEditClick(event) {
  if (!event.target.classList.contains('category-cancel-btn')) return;
  const listItem = event.target.closest('.category-list-item');
  resetCategoryItemUI(listItem);
}

async function handleSaveCategoryClick(event) {
  if (!event.target.classList.contains('category-save-btn')) return;

  const saveButton = event.target;
  const listItem = saveButton.closest('.category-list-item');
  const inputField = listItem.querySelector('.category-edit-input');
  const controlsDiv = listItem.querySelector('.category-controls');
  if (!listItem || !inputField || !controlsDiv) return;

  const oldName = listItem.dataset.originalName;
  const newName = inputField.value.trim();

  if (!newName) {
    alert('Category name cannot be empty.');
    inputField.focus();
    return;
  }
  if (newName === oldName) {
    resetCategoryItemUI(listItem);
    return;
  }
  if (newName === 'Other') {
    alert('Cannot rename a category to "Other".');
    inputField.value = oldName;
    inputField.focus();
    return;
  }
  if (AppState.categories.some((cat) => cat.toLowerCase() === newName.toLowerCase() && cat !== oldName)) {
    alert(`Category "${newName}" already exists.`);
    inputField.focus();
    return;
  }

  const originalButtonText = saveButton.textContent;
  saveButton.textContent = 'Saving...';
  saveButton.disabled = true;
  const cancelButton = controlsDiv.querySelector('.category-cancel-btn');
  if (cancelButton) cancelButton.disabled = true;

  try {
    let assignmentsChanged = false;
    let rulesChanged = false;
    const categoryIndex = AppState.categories.indexOf(oldName);
    if (categoryIndex > -1) AppState.categories[categoryIndex] = newName;
    else {
      throw new Error(`Could not find old category name in state: ${oldName}`);
    }
    for (const domain in AppState.categoryAssignments) {
      if (AppState.categoryAssignments[domain] === oldName) {
        AppState.categoryAssignments[domain] = newName;
        assignmentsChanged = true;
      }
    }
    AppState.rules.forEach((rule) => {
      if (rule.type.includes('-category') && rule.value === oldName) {
        rule.value = newName;
        rulesChanged = true;
      }
    });
    // Update productivity ratings
    if (AppState.categoryProductivityRatings.hasOwnProperty(oldName)) {
      AppState.categoryProductivityRatings[newName] = AppState.categoryProductivityRatings[oldName];
      delete AppState.categoryProductivityRatings[oldName];
      // Need to save this separately or as part of a general settings save
      await browser.storage.local.set({ [STORAGE_KEY_PRODUCTIVITY_RATINGS]: AppState.categoryProductivityRatings });
    }

    console.log(`Category "${oldName}" renamed to "${newName}". Saving primary changes...`);
    const savePromises = [saveCategoriesAndAssignments()];
    if (rulesChanged) savePromises.push(saveRules());
    await Promise.all(savePromises);
    console.log('Primary changes saved.');

    console.log(`Triggering category total recalculation for rename...`);
    await recalculateAndUpdateCategoryTotals({ type: 'categoryRename', oldCategory: oldName, newCategory: newName });
    console.log('Recalculation complete.');

    console.log('Refreshing UI after category rename and recalculation...');
    populateCategoryList();
    populateCategorySelect();
    populateRuleCategorySelect();
    if (assignmentsChanged) populateAssignmentList();
    if (rulesChanged) populateRuleList();
    populateProductivitySettings(); // Refresh productivity settings
    updateDisplayForSelectedRangeUI();
    console.log(`Category rename process complete for "${oldName}" -> "${newName}".`);
  } catch (error) {
    console.error('Error saving category rename:', error);
    alert(`Failed to save category rename: ${error.message || 'Unknown error'}`);
    // Restore button state on error
    saveButton.textContent = originalButtonText;
    saveButton.disabled = false;
    if (cancelButton) cancelButton.disabled = false;
    // Potentially revert AppState changes if critical, or reload all data
    // loadAllData();
  }
}

function handleDeleteAssignment(event) {
  try {
    if (!event.target.classList.contains('assignment-delete-btn') || !event.target.closest('#assignmentList')) return;
    const domainToDelete = event.target.dataset.domain;
    if (domainToDelete && AppState.categoryAssignments.hasOwnProperty(domainToDelete)) {
      if (confirm(`DELETE ASSIGNMENT?\n"${domainToDelete}"`)) {
        const oldCategory = AppState.categoryAssignments[domainToDelete];
        delete AppState.categoryAssignments[domainToDelete];

        saveCategoriesAndAssignments()
          .then(() => {
            populateAssignmentList();
            return recalculateAndUpdateCategoryTotals({
              type: 'assignmentChange',
              domain: domainToDelete,
              oldCategory: oldCategory,
              newCategory: null, // Or 'Other' if it should fall back
            });
          })
          .then(() => {
            updateDisplayForSelectedRangeUI();
            console.log(`Assignment for ${domainToDelete} deleted and totals recalculated.`);
          })
          .catch((error) => {
            console.error('Error deleting assignment or recalculating:', error);
            alert('Failed to delete assignment. Check console for errors.');
            loadAllData();
          });
      }
    }
  } catch (e) {
    console.error('Error deleting assignment:', e);
    alert('An error occurred while trying to delete the assignment.');
  }
}

function handleEditAssignmentClick(event) {
  if (!event.target.classList.contains('assignment-edit-btn') || !event.target.closest('#assignmentList')) return;
  const listItem = event.target.closest('.assignment-list-item');
  const domainSpan = listItem.querySelector('.assignment-domain');
  const categorySpan = listItem.querySelector('.assignment-category');
  const originalDomain = domainSpan ? domainSpan.textContent : null;
  const originalCategory = categorySpan ? categorySpan.textContent : null;
  if (!originalDomain || !originalCategory || !UIElements.editAssignmentModal) {
    alert('Error preparing assignment for editing.');
    return;
  }
  AppState.editingAssignmentOriginalDomain = originalDomain;
  UIElements.editAssignmentOriginalDomain.value = originalDomain;
  UIElements.editAssignmentDomainInput.value = originalDomain;
  populateEditAssignmentCategorySelect();
  UIElements.editAssignmentCategorySelect.value = originalCategory;
  UIElements.editAssignmentModal.style.display = 'flex';
}

function handleCancelAssignmentEditClick() {
  if (UIElements.editAssignmentModal) UIElements.editAssignmentModal.style.display = 'none';
  AppState.editingAssignmentOriginalDomain = null;
}

async function handleSaveAssignmentClick() {
  const saveButton = UIElements.saveAssignmentChangesBtn;
  const cancelButton = UIElements.cancelEditAssignmentBtn;
  const originalDomain = AppState.editingAssignmentOriginalDomain;
  const newDomain = UIElements.editAssignmentDomainInput.value.trim();
  const newCategory = UIElements.editAssignmentCategorySelect.value;

  if (!originalDomain) {
    alert('Error saving assignment: Original domain not found.');
    handleCancelAssignmentEditClick();
    return;
  }
  if (!newDomain) {
    alert('Domain pattern cannot be empty.');
    return;
  }
  if (!newCategory) {
    alert('Please select a category.');
    return;
  }
  const domainRegex = /^(?:([\w\-*]+)\.)?([\w\-]+)\.([a-z\.]{2,})$/i;
  const hostnameRegex = /^[\w\-]+$/i;
  const isValidDomain = domainRegex.test(newDomain);
  const isValidWildcard = newDomain.startsWith('*.') && domainRegex.test(newDomain.substring(2));
  const isValidHostname = hostnameRegex.test(newDomain);
  const allowPattern = isValidDomain || isValidWildcard || isValidHostname;
  if (!allowPattern) {
    alert('Invalid domain/pattern format.');
    return;
  }
  if (newDomain.toLowerCase() !== originalDomain.toLowerCase()) {
    const conflictingDomain = Object.keys(AppState.categoryAssignments).find(
      (key) => key.toLowerCase() === newDomain.toLowerCase()
    );
    if (conflictingDomain) {
      alert(
        `The domain pattern "${newDomain}" is already assigned to category "${AppState.categoryAssignments[conflictingDomain]}".`
      );
      return;
    }
  }

  const originalButtonText = saveButton.textContent;
  saveButton.textContent = 'Saving...';
  saveButton.disabled = true;
  if (cancelButton) cancelButton.disabled = true;
  try {
    const oldCategory = AppState.categoryAssignments[originalDomain];
    let needsRecalculation = oldCategory !== newCategory || newDomain.toLowerCase() !== originalDomain.toLowerCase();

    if (newDomain.toLowerCase() !== originalDomain.toLowerCase()) {
      delete AppState.categoryAssignments[originalDomain];
    }
    AppState.categoryAssignments[newDomain] = newCategory;

    console.log(`Assignment updated: "${originalDomain}" -> "${newDomain}" : "${newCategory}". Saving assignment...`);
    await saveCategoriesAndAssignments();

    if (needsRecalculation) {
      console.log(`Triggering category total recalculation for assignment change...`);
      await recalculateAndUpdateCategoryTotals({
        type: 'assignmentChange',
        domain: newDomain, // Use new domain for recalc context
        oldDomain: originalDomain !== newDomain ? originalDomain : null, // Pass old domain if it changed
        oldCategory: oldCategory,
        newCategory: newCategory,
      });
      console.log('Recalculation complete.');
    }

    console.log('Refreshing UI after assignment save...');
    populateAssignmentList();
    if (needsRecalculation) updateDisplayForSelectedRangeUI();
    console.log(`Assignment save process complete for "${newDomain}".`);
    handleCancelAssignmentEditClick();
  } catch (error) {
    console.error('Error saving assignment:', error);
    alert(`Failed to save assignment: ${error.message || 'Unknown error'}`);
  } finally {
    saveButton.textContent = originalButtonText;
    saveButton.disabled = false;
    if (cancelButton) cancelButton.disabled = false;
  }
}

function handleRuleTypeChange() {
  try {
    if (
      !UIElements.ruleTypeSelect ||
      !UIElements.rulePatternInput ||
      !UIElements.ruleCategorySelect ||
      !UIElements.timeLimitInputDiv ||
      !UIElements.addRuleScheduleInputsDiv
    ) {
      console.error('Missing UI elements for rule type change handling.');
      return;
    }
    const selectedType = UIElements.ruleTypeSelect.value;
    const isUrlType = selectedType.includes('-url');
    const isCategoryType = selectedType.includes('-category');
    const isLimitType = selectedType.includes('limit-');
    const isBlockType = selectedType.includes('block-');

    UIElements.rulePatternInput.style.display = isUrlType ? '' : 'none';
    UIElements.ruleCategorySelect.style.display = isCategoryType ? '' : 'none';
    UIElements.timeLimitInputDiv.style.display = isLimitType ? '' : 'none';
    UIElements.addRuleScheduleInputsDiv.style.display = isBlockType ? '' : 'none';

    if (isUrlType) UIElements.rulePatternInput.placeholder = 'e.g., badsite.com or *.social.com';
  } catch (e) {
    console.error('Error changing rule type view:', e);
  }
}

function handleAddRule() {
  try {
    if (
      !UIElements.ruleTypeSelect ||
      !UIElements.rulePatternInput ||
      !UIElements.ruleCategorySelect ||
      !UIElements.ruleLimitInput ||
      !UIElements.ruleUnitSelect ||
      !UIElements.ruleStartTimeInput ||
      !UIElements.ruleEndTimeInput ||
      !UIElements.ruleDayCheckboxes
    ) {
      console.error('Missing UI elements for adding a rule.');
      return;
    }
    const type = UIElements.ruleTypeSelect.value;
    let value = '',
      limitSeconds = null;
    let startTime = null,
      endTime = null,
      days = null;
    if (type.includes('-url')) {
      value = UIElements.rulePatternInput.value.trim();
      if (!value) {
        alert('Please enter a URL or pattern.');
        return;
      }
    } else if (type.includes('-category')) {
      value = UIElements.ruleCategorySelect.value;
      if (!value) {
        alert('Please select a category.');
        return;
      }
    } else return;
    if (type.includes('limit-')) {
      const limitValue = parseInt(UIElements.ruleLimitInput.value, 10);
      const unit = UIElements.ruleUnitSelect.value;
      if (isNaN(limitValue) || limitValue <= 0) {
        alert('Please enter a valid positive time limit.');
        return;
      }
      limitSeconds = unit === 'hours' ? limitValue * 3600 : limitValue * 60;
    }
    if (type.includes('block-')) {
      startTime = UIElements.ruleStartTimeInput.value || null;
      endTime = UIElements.ruleEndTimeInput.value || null;

      if (startTime && !endTime) {
        alert('Please provide an End Time if Start Time is set.');
        return;
      }
      if (!startTime && endTime) {
        alert('Please provide a Start Time if End Time is set.');
        return;
      }
      if (startTime && endTime && startTime >= endTime) {
        alert('Start Time must be before End Time.');
        return;
      }

      const selectedDays = Array.from(UIElements.ruleDayCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      if (selectedDays.length > 0 && selectedDays.length < 7) {
        days = selectedDays;
      } else if (selectedDays.length === 7) {
        days = null;
      }
    }

    const exists = AppState.rules.some(
      (rule) => rule.type === type && rule.value.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      alert(`A rule for this exact type and target ("${value}") already exists.`);
      return;
    }
    const newRule = { type, value };
    if (limitSeconds !== null) newRule.limitSeconds = limitSeconds;
    if (startTime) newRule.startTime = startTime;
    if (endTime) newRule.endTime = endTime;
    if (days) newRule.days = days;

    AppState.rules.push(newRule);
    console.log('[Options] Added rule:', newRule);
    saveRules();
    populateRuleList();
    UIElements.rulePatternInput.value = '';
    UIElements.ruleCategorySelect.value = '';
    UIElements.ruleLimitInput.value = '';
    UIElements.ruleUnitSelect.value = 'minutes';
    UIElements.ruleStartTimeInput.value = '';
    UIElements.ruleEndTimeInput.value = '';
    UIElements.ruleDayCheckboxes.forEach((cb) => (cb.checked = false));
  } catch (e) {
    console.error('Error adding rule:', e);
    alert('Failed to add rule.');
  }
}

function handleDeleteRule(event) {
  try {
    const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
    if (!isNaN(ruleIndex) && ruleIndex >= 0 && ruleIndex < AppState.rules.length) {
      const ruleToDelete = AppState.rules[ruleIndex];
      let confirmMessage = `DELETE RULE?\n\nType: ${ruleToDelete.type}\nTarget: ${ruleToDelete.value}`;
      if (ruleToDelete.limitSeconds !== undefined)
        confirmMessage += `\nLimit: ${formatTime(ruleToDelete.limitSeconds, false)}/day`;
      if (confirm(confirmMessage)) {
        AppState.rules.splice(ruleIndex, 1);
        console.log('[Options] Deleted rule at index:', ruleIndex);
        saveRules();
        populateRuleList();
      }
    } else console.warn('Delete button clicked, but rule index not found or invalid:', event.target.dataset.ruleIndex);
  } catch (e) {
    console.error('Error deleting rule:', e);
    alert('An error occurred while trying to delete the rule.');
  }
}

function handleDomainPrev() {
  if (AppState.domainCurrentPage > 1) {
    AppState.domainCurrentPage--;
    updateDomainDisplayAndPagination();
  }
}
function handleDomainNext() {
  const totalItems = AppState.fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / AppState.domainItemsPerPage));
  if (AppState.domainCurrentPage < totalPages) {
    AppState.domainCurrentPage++;
    updateDomainDisplayAndPagination();
  }
}

function handlePrevMonth() {
  AppState.calendarDate.setMonth(AppState.calendarDate.getMonth() - 1);
  renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth());
  highlightSelectedCalendarDay(AppState.selectedDateStr);
}
function handleNextMonth() {
  AppState.calendarDate.setMonth(AppState.calendarDate.getMonth() + 1);
  renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth());
  highlightSelectedCalendarDay(AppState.selectedDateStr);
}

function handleCalendarMouseOver(event) {
  showDayDetailsPopup(event);
}
function handleCalendarMouseOut() {
  hideDayDetailsPopup();
}

function handleCalendarDayClick(event) {
  const dayCell = event.target.closest('.calendar-day');
  if (!dayCell) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;

  console.log(`[Calendar] Day clicked: ${dateStr}`);
  AppState.selectedDateStr = dateStr;
  highlightSelectedCalendarDay(dateStr);

  const domainDataForDay = AppState.dailyDomainData[dateStr] || {};
  const categoryDataForDay = AppState.dailyCategoryData[dateStr] || {};
  const displayDateLabel = formatDisplayDate(dateStr);

  const totalSeconds = Object.values(domainDataForDay).reduce((sum, time) => sum + (time || 0), 0);

  if (UIElements.dateRangeSelect) {
    UIElements.dateRangeSelect.value = '';
  }
  console.log('Total seconds for day click:', totalSeconds);
  if (totalSeconds < 1) {
    displayNoDataForDate(displayDateLabel);
  } else {
    updateStatsDisplay(domainDataForDay, categoryDataForDay, displayDateLabel, dateStr);
  }
}

function handleChartViewChange(event) {
  AppState.currentChartViewMode = event.target.value;
  console.log(`Chart view changed to: ${AppState.currentChartViewMode}`);
  // Instead of renderChartForSelectedDateUI, call the main update function
  // to ensure all stats (including lists and score) are consistent with the chart.
  updateDisplayForSelectedRangeUI();
}

function handleEditRuleClick(event) {
  const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
  if (isNaN(ruleIndex) || ruleIndex < 0 || ruleIndex >= AppState.rules.length) {
    alert('Could not find rule to edit.');
    return;
  }
  AppState.editingRuleIndex = ruleIndex;
  const rule = AppState.rules[ruleIndex];
  console.log('Editing rule:', rule);
  if (
    !UIElements.editRuleModal ||
    !UIElements.editRuleTypeDisplay ||
    !UIElements.editRulePatternGroup ||
    !UIElements.editRulePatternInput ||
    !UIElements.editRuleCategoryGroup ||
    !UIElements.editRuleCategorySelect ||
    !UIElements.editRuleLimitGroup ||
    !UIElements.editRuleLimitInput ||
    !UIElements.editRuleUnitSelect ||
    !UIElements.editRuleIndexInput ||
    !UIElements.editRuleScheduleGroup ||
    !UIElements.editRuleStartTimeInput ||
    !UIElements.editRuleEndTimeInput ||
    !UIElements.editRuleDayCheckboxes
  ) {
    alert('Error opening edit form. Please check console.');
    return;
  }
  UIElements.editRuleIndexInput.value = ruleIndex;
  UIElements.editRuleTypeDisplay.textContent = rule.type;
  const isUrlType = rule.type.includes('-url');
  const isCategoryType = rule.type.includes('-category');
  const isLimitType = rule.type.includes('limit-');
  const isBlockType = rule.type.includes('block-');

  UIElements.editRulePatternGroup.style.display = isUrlType ? '' : 'none';
  UIElements.editRuleCategoryGroup.style.display = isCategoryType ? '' : 'none';
  UIElements.editRuleLimitGroup.style.display = isLimitType ? '' : 'none';
  UIElements.editRuleScheduleGroup.style.display = isBlockType ? '' : 'none';

  if (isUrlType) UIElements.editRulePatternInput.value = rule.value;
  else if (isCategoryType) {
    populateRuleCategorySelect(); // Ensures the select is up-to-date
    UIElements.editRuleCategorySelect.value = rule.value;
    if (!AppState.categories.includes(rule.value)) {
      const tempOpt = document.createElement('option');
      tempOpt.value = rule.value;
      tempOpt.textContent = `${rule.value} (Deleted)`;
      tempOpt.disabled = true;
      UIElements.editRuleCategorySelect.appendChild(tempOpt);
      UIElements.editRuleCategorySelect.value = rule.value;
    }
  }
  if (isLimitType) {
    const limitSec = rule.limitSeconds || 0;
    if (limitSec > 0 && limitSec % 3600 === 0 && limitSec / 3600 >= 1) {
      UIElements.editRuleLimitInput.value = limitSec / 3600;
      UIElements.editRuleUnitSelect.value = 'hours';
    } else {
      UIElements.editRuleLimitInput.value = Math.round(limitSec / 60);
      UIElements.editRuleUnitSelect.value = 'minutes';
    }
    if (limitSec > 0 && UIElements.editRuleLimitInput.value == 0) {
      // Ensure non-zero display for small limits
      UIElements.editRuleLimitInput.value = 1;
      UIElements.editRuleUnitSelect.value = 'minutes';
    }
  } else {
    UIElements.editRuleLimitInput.value = '';
    UIElements.editRuleUnitSelect.value = 'minutes';
  }

  if (isBlockType) {
    UIElements.editRuleStartTimeInput.value = rule.startTime || '';
    UIElements.editRuleEndTimeInput.value = rule.endTime || '';
    UIElements.editRuleDayCheckboxes.forEach((cb) => (cb.checked = false));
    if (rule.days && Array.isArray(rule.days)) {
      rule.days.forEach((dayValue) => {
        const cb = document.querySelector(`#editRuleModal input[name="editRuleDay"][value="${dayValue}"]`);
        if (cb) cb.checked = true;
      });
    }
  } else {
    UIElements.editRuleStartTimeInput.value = '';
    UIElements.editRuleEndTimeInput.value = '';
    UIElements.editRuleDayCheckboxes.forEach((cb) => (cb.checked = false));
  }

  UIElements.editRuleModal.style.display = 'flex';
}

function handleCancelEditClick() {
  if (UIElements.editRuleModal) UIElements.editRuleModal.style.display = 'none';
  AppState.editingRuleIndex = -1;
}

function handleSaveChangesClick() {
  const editIndex = AppState.editingRuleIndex;
  if (editIndex < 0 || editIndex >= AppState.rules.length) {
    alert('Error: No rule selected for saving.');
    return;
  }
  const originalRule = AppState.rules[editIndex];
  const updatedRule = { type: originalRule.type }; // Keep original type
  const isUrlType = originalRule.type.includes('-url');
  const isCategoryType = originalRule.type.includes('-category');
  const isLimitType = originalRule.type.includes('limit-');
  const isBlockType = originalRule.type.includes('block-');

  if (isUrlType) {
    const newVal = UIElements.editRulePatternInput.value.trim();
    if (!newVal) {
      alert('Please enter a URL or pattern.');
      return;
    }
    updatedRule.value = newVal;
  } else if (isCategoryType) {
    const newVal = UIElements.editRuleCategorySelect.value;
    const selOpt = UIElements.editRuleCategorySelect.options[UIElements.editRuleCategorySelect.selectedIndex];
    if (!newVal || (selOpt && selOpt.disabled)) {
      // Check if selected option is disabled (deleted category)
      alert('Please select a valid category.');
      return;
    }
    updatedRule.value = newVal;
  }
  if (isLimitType) {
    const limitVal = parseInt(UIElements.editRuleLimitInput.value, 10);
    const unit = UIElements.editRuleUnitSelect.value;
    if (isNaN(limitVal) || limitVal <= 0) {
      alert('Please enter a valid positive time limit.');
      return;
    }
    updatedRule.limitSeconds = unit === 'hours' ? limitVal * 3600 : limitVal * 60;
  }

  if (isBlockType) {
    const startTime = UIElements.editRuleStartTimeInput.value || null;
    const endTime = UIElements.editRuleEndTimeInput.value || null;

    if (startTime && !endTime) {
      alert('Please provide an End Time if Start Time is set.');
      return;
    }
    if (!startTime && endTime) {
      alert('Please provide a Start Time if End Time is set.');
      return;
    }
    if (startTime && endTime && startTime >= endTime) {
      alert('Start Time must be before End Time.');
      return;
    }

    const selectedDays = Array.from(UIElements.editRuleDayCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    // Only add schedule properties if they are set
    if (startTime) updatedRule.startTime = startTime;
    else delete updatedRule.startTime;
    if (endTime) updatedRule.endTime = endTime;
    else delete updatedRule.endTime;
    if (selectedDays.length > 0 && selectedDays.length < 7) {
      updatedRule.days = selectedDays;
    } else {
      delete updatedRule.days; // If no days or all days selected, remove property (treat as default)
    }
  }

  const exists = AppState.rules.some(
    (r, i) =>
      i !== editIndex && r.type === updatedRule.type && r.value.toLowerCase() === updatedRule.value.toLowerCase()
  );
  if (exists) {
    alert(`Another rule for this exact type and target ("${updatedRule.value}") already exists.`);
    return;
  }
  AppState.rules[editIndex] = updatedRule;
  console.log(`Rule at index ${editIndex} updated:`, updatedRule);
  saveRules();
  populateRuleList();
  handleCancelEditClick();
}

function handleIdleThresholdChange() {
  if (!UIElements.idleThresholdSelect) return;
  const selectedValue = parseInt(UIElements.idleThresholdSelect.value, 10);
  if (isNaN(selectedValue)) {
    UIElements.idleThresholdSelect.value = DEFAULT_IDLE_SECONDS;
    return;
  }
  console.log(`[Options] Idle threshold changed to: ${selectedValue} seconds`);
  browser.storage.local
    .set({ [STORAGE_KEY_IDLE_THRESHOLD]: selectedValue })
    .then(() => console.log('[Options] Idle threshold saved successfully.'))
    .catch((error) => {
      console.error('Error saving idle threshold:', error);
      alert('Failed to save idle threshold setting.');
    });
}

function handleExportCsv() {
  if (!UIElements.dateRangeSelect) {
    alert('Error: Cannot determine selected date range.');
    return;
  }
  const selectedRangeOption = UIElements.dateRangeSelect.value;
  let rangeToProcess = selectedRangeOption;
  let labelForFilename = UIElements.dateRangeSelect.options[UIElements.dateRangeSelect.selectedIndex].text;

  if (selectedRangeOption === '' && AppState.selectedDateStr) {
    // Calendar date selected
    rangeToProcess = AppState.selectedDateStr; // This will make getFilteredDataForRange use the specific date
    labelForFilename = AppState.selectedDateStr;
  } else if (selectedRangeOption === '') {
    // Placeholder selected, default to today
    rangeToProcess = 'today';
    labelForFilename = 'Today';
  }

  const { domainData, label } = getFilteredDataForRange(rangeToProcess, true); // Pass true to get specific date data if rangeToProcess is a date string

  if (!domainData || Object.keys(domainData).length === 0) {
    alert(`No domain data to export for the selected period: ${labelForFilename}`);
    return;
  }
  const csvString = convertDataToCsv(domainData); // convertDataToCsv needs AppState for categories
  const filename = `focusflow_export_${labelForFilename.toLowerCase().replace(/\s+/g, '_')}_${formatDate(
    new Date()
  )}.csv`;
  triggerCsvDownload(csvString, filename);
}

function handleDataRetentionChange() {
  if (!UIElements.dataRetentionSelect) return;
  const selectedValue = parseInt(UIElements.dataRetentionSelect.value, 10);
  if (isNaN(selectedValue)) {
    console.error('Invalid data retention value selected:', UIElements.dataRetentionSelect.value);
    UIElements.dataRetentionSelect.value = DEFAULT_DATA_RETENTION_DAYS;
    return;
  }
  console.log(`[Options] Data retention setting changed to: ${selectedValue} days (-1 means forever)`);
  browser.storage.local
    .set({ [STORAGE_KEY_DATA_RETENTION_DAYS]: selectedValue })
    .then(() => {
      console.log('[Options] Data retention setting saved successfully.');
    })
    .catch((error) => {
      console.error('Error saving data retention setting:', error);
      alert('Failed to save data retention setting.');
    });
}

async function handleExportData() {
  console.log('[Data Export] Starting export...');
  try {
    const keysToExport = [
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
      STORAGE_KEY_IDLE_THRESHOLD,
      STORAGE_KEY_DATA_RETENTION_DAYS,
      STORAGE_KEY_PRODUCTIVITY_RATINGS, // Include productivity ratings
      // NEW: Include block page customization keys
      STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
      STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
      STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
      STORAGE_KEY_BLOCK_PAGE_SHOW_URL,
      STORAGE_KEY_BLOCK_PAGE_SHOW_REASON,
      STORAGE_KEY_BLOCK_PAGE_SHOW_RULE,
      STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
      STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
      STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE,
      STORAGE_KEY_BLOCK_PAGE_USER_QUOTES,
    ];

    const storedData = await browser.storage.local.get(keysToExport);
    const dataToExport = {};
    keysToExport.forEach((key) => {
      // Provide sensible defaults for missing data
      if (key === 'categories') dataToExport[key] = storedData[key] || ['Other'];
      else if (key === 'rules') dataToExport[key] = storedData[key] || [];
      else if (key === STORAGE_KEY_IDLE_THRESHOLD) dataToExport[key] = storedData[key] ?? DEFAULT_IDLE_SECONDS;
      else if (key === STORAGE_KEY_DATA_RETENTION_DAYS)
        dataToExport[key] = storedData[key] ?? DEFAULT_DATA_RETENTION_DAYS;
      else if (key === STORAGE_KEY_PRODUCTIVITY_RATINGS) dataToExport[key] = storedData[key] || {};
      // Defaults for new block page settings
      else if (key === STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING) dataToExport[key] = storedData[key] || '';
      else if (key === STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE) dataToExport[key] = storedData[key] || '';
      else if (key === STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT) dataToExport[key] = storedData[key] || '';
      else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_URL) dataToExport[key] = storedData[key] ?? true;
      else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_REASON) dataToExport[key] = storedData[key] ?? true;
      else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_RULE) dataToExport[key] = storedData[key] ?? true;
      else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO) dataToExport[key] = storedData[key] ?? true;
      else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO) dataToExport[key] = storedData[key] ?? true;
      else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE) dataToExport[key] = storedData[key] ?? false;
      else if (key === STORAGE_KEY_BLOCK_PAGE_USER_QUOTES) dataToExport[key] = storedData[key] || [];
      else dataToExport[key] = storedData[key] || {}; // Default for tracking data objects
    });

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `focusflow_backup_${dateStr}.ffm`;
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('[Data Export] Export successful, download triggered:', filename);
    } else {
      alert('Data export might not be fully supported by your browser.');
    }
  } catch (error) {
    console.error('[Data Export] Error exporting data:', error);
    alert(`An error occurred during data export: ${error.message}`);
  }
}

function handleImportDataClick() {
  if (UIElements.importFileInput) {
    UIElements.importFileInput.click();
  } else {
    console.error('Import file input not found!');
    alert('Import button error. Please refresh.');
  }
}

function handleImportFileChange(event) {
  const file = event.target.files ? event.target.files[0] : null;
  if (!file) {
    console.log('[Data Import] No file selected.');
    return;
  }
  if (!file.name || !file.name.toLowerCase().endsWith('.ffm')) {
    alert('Import failed: Please select a valid FocusFlow backup (.ffm) file.');
    event.target.value = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    let importedData;
    try {
      importedData = JSON.parse(e.target.result);
      console.log('[Data Import] File parsed successfully.');

      const requiredKeys = [
        'trackedData',
        'categoryTimeData',
        'categories',
        'categoryAssignments',
        'rules',
        'dailyDomainData',
        'dailyCategoryData',
        'hourlyData',
        // Optionally check for new settings keys, but allow import if they are missing (use defaults)
      ];
      const missingKeys = requiredKeys.filter((key) => !(key in importedData));
      if (missingKeys.length > 0) {
        throw new Error(`Import file is missing required data keys: ${missingKeys.join(', ')}`);
      }
      // Basic type checks
      if (
        !Array.isArray(importedData.categories) ||
        !Array.isArray(importedData.rules) ||
        typeof importedData.trackedData !== 'object' ||
        typeof importedData.categoryAssignments !== 'object' ||
        typeof importedData.dailyDomainData !== 'object' ||
        typeof importedData.dailyCategoryData !== 'object' ||
        typeof importedData.hourlyData !== 'object'
      ) {
        throw new Error('Import file has incorrect data types for one or more keys.');
      }

      const confirmation = confirm(
        'IMPORT WARNING:\n\nThis will OVERWRITE all your current FocusFlow Monitor settings and tracking data with the data from the selected file.\n\nAre you sure you want to proceed?'
      );
      if (!confirmation) {
        console.log('[Data Import] User cancelled import.');
        if (UIElements.importStatus) {
          UIElements.importStatus.textContent = 'Import cancelled by user.';
          UIElements.importStatus.className = 'status-message';
          UIElements.importStatus.style.display = 'block';
        }
        event.target.value = null;
        return;
      }

      console.log('[Data Import] User confirmed. Applying imported data...');
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = 'Importing... Please wait.';
        UIElements.importStatus.className = 'status-message';
        UIElements.importStatus.style.display = 'block';
      }
      await applyImportedData(importedData);
    } catch (error) {
      console.error('[Data Import] Error processing import file:', error);
      alert(`Import failed: ${error.message}`);
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = `Import failed: ${error.message}`;
        UIElements.importStatus.className = 'status-message error';
        UIElements.importStatus.style.display = 'block';
      }
      event.target.value = null;
    }
  };
  reader.onerror = (e) => {
    console.error('[Data Import] Error reading file:', e);
    alert('Error reading the selected file.');
    if (UIElements.importStatus) {
      UIElements.importStatus.textContent = 'Import failed: Could not read file.';
      UIElements.importStatus.className = 'status-message error';
      UIElements.importStatus.style.display = 'block';
    }
    event.target.value = null;
  };
  reader.readAsText(file);
}

async function applyImportedData(dataToImport) {
  try {
    await browser.storage.local.set(dataToImport);
    console.log('[Data Import] Data successfully saved to storage.');
    await browser.runtime.sendMessage({ action: 'importedData' });
    console.log('[Data Import] Sent message to background script to reload state.');
    if (UIElements.importStatus) {
      UIElements.importStatus.textContent = 'Import successful! Reloading options page...';
      UIElements.importStatus.className = 'status-message success';
      UIElements.importStatus.style.display = 'block';
    }
    setTimeout(() => {
      location.reload();
    }, 1500);
  } catch (error) {
    console.error('[Data Import] Error applying imported data:', error);
    alert(`Failed to apply imported data: ${error.message}`);
    if (UIElements.importStatus) {
      UIElements.importStatus.textContent = `Import failed: ${error.message}`;
      UIElements.importStatus.className = 'status-message error';
      UIElements.importStatus.style.display = 'block';
    }
  } finally {
    if (UIElements.importFileInput) UIElements.importFileInput.value = null;
  }
}

async function handleProductivityRatingChange(event) {
  if (event.target.type !== 'radio' || !event.target.name.startsWith('rating-')) {
    return;
  }
  const category = event.target.dataset.category;
  const newRating = parseInt(event.target.value, 10);
  if (!category || isNaN(newRating)) {
    console.error('Could not get category or rating from event:', event.target);
    return;
  }
  console.log(`[Productivity] Rating changed for "${category}" to ${newRating}`);
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_PRODUCTIVITY_RATINGS);
    const currentRatings = result[STORAGE_KEY_PRODUCTIVITY_RATINGS] || {};
    currentRatings[category] = newRating;
    await browser.storage.local.set({ [STORAGE_KEY_PRODUCTIVITY_RATINGS]: currentRatings });
    console.log(`[Productivity] Saved updated ratings.`);
    AppState.categoryProductivityRatings = currentRatings;
    updateDisplayForSelectedRangeUI();
  } catch (error) {
    console.error('Error saving productivity rating:', error);
    alert('Failed to save productivity setting. Please try again.');
  }
}

// --- NEW: Handlers for Block Page Customization ---
function handleBlockPageSettingChange(storageKey, value) {
  browser.storage.local
    .set({ [storageKey]: value })
    .then(() => console.log(`[Options] Saved ${storageKey}:`, value))
    .catch((err) => console.error(`[Options] Error saving ${storageKey}:`, err));
}

function handleBlockPageShowQuoteChange() {
  const isChecked = UIElements.blockPageShowQuoteCheckbox.checked;
  handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE, isChecked);
  // Toggle visibility of the custom quotes textarea
  if (UIElements.blockPageUserQuotesContainer) {
    UIElements.blockPageUserQuotesContainer.style.display = isChecked ? 'block' : 'none';
  }
}

function handleBlockPageUserQuotesChange() {
  const quotesText = UIElements.blockPageUserQuotesTextarea.value;
  // Split by newline, trim whitespace, and filter out empty lines
  const quotesArray = quotesText
    .split('\n')
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_USER_QUOTES, quotesArray);
}
// --- END NEW HANDLERS ---

// --- Event Listener Setup ---
function setupEventListeners() {
  console.log('[Options Main] Setting up event listeners...');
  try {
    if (UIElements.addCategoryBtn) UIElements.addCategoryBtn.addEventListener('click', handleAddCategory);
    if (UIElements.assignDomainBtn) UIElements.assignDomainBtn.addEventListener('click', handleAssignDomain);
    if (UIElements.categoryList) {
      UIElements.categoryList.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-delete-btn')) handleDeleteCategory(event);
        else if (event.target.classList.contains('category-edit-btn')) handleEditCategoryClick(event);
        else if (event.target.classList.contains('category-save-btn')) handleSaveCategoryClick(event);
        else if (event.target.classList.contains('category-cancel-btn')) handleCancelCategoryEditClick(event);
      });
    }
    if (UIElements.assignmentList) {
      UIElements.assignmentList.addEventListener('click', (event) => {
        if (event.target.classList.contains('assignment-delete-btn')) handleDeleteAssignment(event);
        else if (event.target.classList.contains('assignment-edit-btn')) handleEditAssignmentClick(event);
      });
    }
    if (UIElements.ruleList) {
      UIElements.ruleList.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) handleDeleteRule(event);
        else if (event.target.classList.contains('edit-btn')) handleEditRuleClick(event);
      });
    }
    if (UIElements.ruleTypeSelect) UIElements.ruleTypeSelect.addEventListener('change', handleRuleTypeChange);
    if (UIElements.addRuleBtn) UIElements.addRuleBtn.addEventListener('click', handleAddRule);
    if (UIElements.dateRangeSelect)
      UIElements.dateRangeSelect.addEventListener('change', updateDisplayForSelectedRangeUI);
    if (UIElements.domainPrevBtn) UIElements.domainPrevBtn.addEventListener('click', handleDomainPrev);
    if (UIElements.domainNextBtn) UIElements.domainNextBtn.addEventListener('click', handleDomainNext);
    if (UIElements.prevMonthBtn) UIElements.prevMonthBtn.addEventListener('click', handlePrevMonth);
    if (UIElements.nextMonthBtn) UIElements.nextMonthBtn.addEventListener('click', handleNextMonth);
    if (UIElements.chartViewRadios) {
      UIElements.chartViewRadios.forEach((radio) => radio.addEventListener('change', handleChartViewChange));
    }
    if (UIElements.exportCsvBtn) UIElements.exportCsvBtn.addEventListener('click', handleExportCsv);

    if (UIElements.closeEditModalBtn) UIElements.closeEditModalBtn.addEventListener('click', handleCancelEditClick);
    if (UIElements.cancelEditRuleBtn) UIElements.cancelEditRuleBtn.addEventListener('click', handleCancelEditClick);
    if (UIElements.saveRuleChangesBtn) UIElements.saveRuleChangesBtn.addEventListener('click', handleSaveChangesClick);
    if (UIElements.editRuleModal)
      UIElements.editRuleModal.addEventListener('click', (event) => {
        if (event.target === UIElements.editRuleModal) handleCancelEditClick();
      });

    if (UIElements.closeEditAssignmentModalBtn)
      UIElements.closeEditAssignmentModalBtn.addEventListener('click', handleCancelAssignmentEditClick);
    if (UIElements.cancelEditAssignmentBtn)
      UIElements.cancelEditAssignmentBtn.addEventListener('click', handleCancelAssignmentEditClick);
    if (UIElements.saveAssignmentChangesBtn)
      UIElements.saveAssignmentChangesBtn.addEventListener('click', handleSaveAssignmentClick);
    if (UIElements.editAssignmentModal)
      UIElements.editAssignmentModal.addEventListener('click', (event) => {
        if (event.target === UIElements.editAssignmentModal) handleCancelAssignmentEditClick();
      });

    if (UIElements.idleThresholdSelect)
      UIElements.idleThresholdSelect.addEventListener('change', handleIdleThresholdChange);
    if (UIElements.dataRetentionSelect) {
      UIElements.dataRetentionSelect.addEventListener('change', handleDataRetentionChange);
    } else {
      console.warn('Data retention select element not found, cannot add listener.');
    }

    if (UIElements.exportDataBtn) UIElements.exportDataBtn.addEventListener('click', handleExportData);
    if (UIElements.importDataBtn) UIElements.importDataBtn.addEventListener('click', handleImportDataClick);
    if (UIElements.importFileInput) UIElements.importFileInput.addEventListener('change', handleImportFileChange);

    if (UIElements.productivitySettingsList) {
      UIElements.productivitySettingsList.addEventListener('change', handleProductivityRatingChange);
    }

    // NEW: Event Listeners for Block Page Customization
    if (UIElements.blockPageCustomHeadingInput) {
      UIElements.blockPageCustomHeadingInput.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_HEADING,
          UIElements.blockPageCustomHeadingInput.value.trim()
        )
      );
    }
    if (UIElements.blockPageCustomMessageTextarea) {
      UIElements.blockPageCustomMessageTextarea.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_MESSAGE,
          UIElements.blockPageCustomMessageTextarea.value.trim()
        )
      );
    }
    if (UIElements.blockPageCustomButtonTextInput) {
      UIElements.blockPageCustomButtonTextInput.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_CUSTOM_BUTTON_TEXT,
          UIElements.blockPageCustomButtonTextInput.value.trim()
        )
      );
    }
    if (UIElements.blockPageShowUrlCheckbox) {
      UIElements.blockPageShowUrlCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_URL, UIElements.blockPageShowUrlCheckbox.checked)
      );
    }
    if (UIElements.blockPageShowReasonCheckbox) {
      UIElements.blockPageShowReasonCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_REASON, UIElements.blockPageShowReasonCheckbox.checked)
      );
    }
    if (UIElements.blockPageShowRuleCheckbox) {
      UIElements.blockPageShowRuleCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_RULE, UIElements.blockPageShowRuleCheckbox.checked)
      );
    }
    if (UIElements.blockPageShowLimitInfoCheckbox) {
      UIElements.blockPageShowLimitInfoCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_SHOW_LIMIT_INFO,
          UIElements.blockPageShowLimitInfoCheckbox.checked
        )
      );
    }
    if (UIElements.blockPageShowScheduleInfoCheckbox) {
      UIElements.blockPageShowScheduleInfoCheckbox.addEventListener('change', () =>
        handleBlockPageSettingChange(
          STORAGE_KEY_BLOCK_PAGE_SHOW_SCHEDULE_INFO,
          UIElements.blockPageShowScheduleInfoCheckbox.checked
        )
      );
    }
    if (UIElements.blockPageShowQuoteCheckbox) {
      UIElements.blockPageShowQuoteCheckbox.addEventListener('change', handleBlockPageShowQuoteChange);
    }
    if (UIElements.blockPageUserQuotesTextarea) {
      UIElements.blockPageUserQuotesTextarea.addEventListener('change', handleBlockPageUserQuotesChange);
    }
    // --- END NEW Event Listeners ---

    handleRuleTypeChange();
    console.log('[Options Main] Event listeners setup complete.');
  } catch (e) {
    console.error('[Options Main] Error setting up event listeners:', e);
  }
}

console.log('[System] options-handlers.js loaded (v0.8.2)');
