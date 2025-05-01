// options/options-handlers.js (v0.8.1 - Add Retention Handler - Complete File)

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
    saveCategoriesAndAssignments(); // This is fine as it doesn't need recalc for *new* assignments
    populateAssignmentList();
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
          `DELETE CATEGORY?\n"${categoryToDelete}"\nThis also removes related domain assignments and potentially rules.`
        )
      ) {
        const oldCategoryName = categoryToDelete;
        AppState.categories = AppState.categories.filter((cat) => cat !== oldCategoryName);
        let assignmentsChanged = false,
          rulesChanged = false;
        // Update assignments
        for (const domain in AppState.categoryAssignments) {
          if (AppState.categoryAssignments[domain] === oldCategoryName) {
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
        const savePromises = [];
        savePromises.push(saveCategoriesAndAssignments());
        if (rulesChanged) savePromises.push(saveRules());

        // Wait for saves then update UI
        Promise.all(savePromises)
          .then(() => {
            console.log('Category and related data deleted successfully.');
            // Refresh UI completely
            populateCategoryList();
            populateCategorySelect();
            populateRuleCategorySelect();
            populateAssignmentList();
            populateRuleList();
            updateDisplayForSelectedRangeUI();
          })
          .catch((error) => {
            console.error('Error saving after category deletion:', error);
            alert('Failed to save changes after deleting category. Please refresh.');
            loadAllData(); // Reload data as a simple recovery
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

  // Validation
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

  // Start Save Process
  const originalButtonText = saveButton.textContent;
  saveButton.textContent = 'Saving...';
  saveButton.disabled = true;
  const cancelButton = controlsDiv.querySelector('.category-cancel-btn');
  if (cancelButton) cancelButton.disabled = true;

  try {
    // Update State
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

    // Save Primary Changes
    console.log(`Category "${oldName}" renamed to "${newName}". Saving primary changes...`);
    const savePromises = [saveCategoriesAndAssignments()];
    if (rulesChanged) savePromises.push(saveRules());
    await Promise.all(savePromises);
    console.log('Primary changes saved.');

    // Recalculate Totals
    console.log(`Triggering category total recalculation for rename...`);
    await recalculateAndUpdateCategoryTotals({ type: 'categoryRename', oldCategory: oldName, newCategory: newName });
    console.log('Recalculation complete.');

    // Explicit Full UI Refresh
    console.log('Refreshing UI after category rename and recalculation...');
    populateCategoryList();
    populateCategorySelect();
    populateRuleCategorySelect();
    if (assignmentsChanged) populateAssignmentList();
    if (rulesChanged) populateRuleList();
    updateDisplayForSelectedRangeUI();
    console.log(`Category rename process complete for "${oldName}" -> "${newName}".`);
  } catch (error) {
    console.error('Error saving category rename:', error);
    alert(`Failed to save category rename: ${error.message || 'Unknown error'}`);
    if (saveButton) saveButton.textContent = originalButtonText;
    if (saveButton) saveButton.disabled = false;
    if (cancelButton) cancelButton.disabled = false;
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
              newCategory: null,
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
  // Validation
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
  // Start Save Process
  const originalButtonText = saveButton.textContent;
  saveButton.textContent = 'Saving...';
  saveButton.disabled = true;
  if (cancelButton) cancelButton.disabled = true;
  try {
    const oldCategory = AppState.categoryAssignments[originalDomain];
    let needsRecalculation = oldCategory !== newCategory;
    // Update State
    if (newDomain.toLowerCase() !== originalDomain.toLowerCase()) {
      delete AppState.categoryAssignments[originalDomain];
      needsRecalculation = true;
    }
    AppState.categoryAssignments[newDomain] = newCategory;
    // Save Primary Changes
    console.log(`Assignment updated: "${originalDomain}" -> "${newDomain}" : "${newCategory}". Saving assignment...`);
    await saveCategoriesAndAssignments();
    // Recalculate Totals
    if (needsRecalculation) {
      console.log(`Triggering category total recalculation for assignment change...`);
      await recalculateAndUpdateCategoryTotals({
        type: 'assignmentChange',
        domain: newDomain,
        oldCategory: oldCategory,
        newCategory: newCategory,
      });
      console.log('Recalculation complete.');
    }
    // UI Refresh
    console.log('Refreshing UI after assignment save...');
    populateAssignmentList();
    if (needsRecalculation) updateDisplayForSelectedRangeUI();
    console.log(`Assignment save process complete for "${newDomain}".`);
    handleCancelAssignmentEditClick();
  } catch (error) {
    console.error('Error saving assignment:', error);
    alert(`Failed to save assignment: ${error.message || 'Unknown error'}`);
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
      !UIElements.timeLimitInputDiv
    )
      return;
    const selectedType = UIElements.ruleTypeSelect.value;
    UIElements.rulePatternInput.style.display = selectedType.includes('-url') ? '' : 'none';
    UIElements.ruleCategorySelect.style.display = selectedType.includes('-category') ? '' : 'none';
    UIElements.timeLimitInputDiv.style.display = selectedType.includes('limit-') ? '' : 'none';
    if (selectedType.includes('-url')) UIElements.rulePatternInput.placeholder = 'e.g., badsite.com or *.social.com';
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
      !UIElements.ruleUnitSelect
    )
      return;
    const type = UIElements.ruleTypeSelect.value;
    let value = '',
      limitSeconds = null;
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
    const exists = AppState.rules.some(
      (rule) => rule.type === type && rule.value.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      alert(`A rule for this exact type and target ("${value}") already exists.`);
      return;
    }
    const newRule = { type, value };
    if (limitSeconds !== null) newRule.limitSeconds = limitSeconds;
    AppState.rules.push(newRule);
    console.log('[Options] Added rule:', newRule);
    saveRules();
    populateRuleList();
    UIElements.rulePatternInput.value = '';
    UIElements.ruleCategorySelect.value = '';
    UIElements.ruleLimitInput.value = '';
    UIElements.ruleUnitSelect.value = 'minutes';
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
  renderChartForSelectedDateUI();
}

function handleChartViewChange(event) {
  AppState.currentChartViewMode = event.target.value;
  console.log(`Chart view changed to: ${AppState.currentChartViewMode}`);
  renderChartForSelectedDateUI();
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
    !UIElements.editRuleIndexInput
  ) {
    alert('Error opening edit form. Please check console.');
    return;
  }
  UIElements.editRuleIndexInput.value = ruleIndex;
  UIElements.editRuleTypeDisplay.textContent = rule.type;
  UIElements.editRulePatternGroup.style.display = rule.type.includes('-url') ? '' : 'none';
  UIElements.editRuleCategoryGroup.style.display = rule.type.includes('-category') ? '' : 'none';
  UIElements.editRuleLimitGroup.style.display = rule.type.includes('limit-') ? '' : 'none';
  if (rule.type.includes('-url')) UIElements.editRulePatternInput.value = rule.value;
  else if (rule.type.includes('-category')) {
    populateRuleCategorySelect();
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
  if (rule.type.includes('limit-')) {
    const limitSec = rule.limitSeconds || 0;
    if (limitSec > 0 && limitSec % 3600 === 0 && limitSec / 3600 >= 1) {
      UIElements.editRuleLimitInput.value = limitSec / 3600;
      UIElements.editRuleUnitSelect.value = 'hours';
    } else {
      UIElements.editRuleLimitInput.value = Math.round(limitSec / 60);
      UIElements.editRuleUnitSelect.value = 'minutes';
    }
    if (limitSec > 0 && UIElements.editRuleLimitInput.value == 0) {
      UIElements.editRuleLimitInput.value = 1;
      UIElements.editRuleUnitSelect.value = 'minutes';
    }
  } else {
    UIElements.editRuleLimitInput.value = '';
    UIElements.editRuleUnitSelect.value = 'minutes';
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
  const updatedRule = { type: originalRule.type };
  if (originalRule.type.includes('-url')) {
    const newVal = UIElements.editRulePatternInput.value.trim();
    if (!newVal) {
      alert('Please enter a URL or pattern.');
      return;
    }
    updatedRule.value = newVal;
  } else if (originalRule.type.includes('-category')) {
    const newVal = UIElements.editRuleCategorySelect.value;
    const selOpt = UIElements.editRuleCategorySelect.options[UIElements.editRuleCategorySelect.selectedIndex];
    if (!newVal || selOpt.disabled) {
      alert('Please select a valid category.');
      return;
    }
    updatedRule.value = newVal;
  }
  if (originalRule.type.includes('limit-')) {
    const limitVal = parseInt(UIElements.editRuleLimitInput.value, 10);
    const unit = UIElements.editRuleUnitSelect.value;
    if (isNaN(limitVal) || limitVal <= 0) {
      alert('Please enter a valid positive time limit.');
      return;
    }
    updatedRule.limitSeconds = unit === 'hours' ? limitVal * 3600 : limitVal * 60;
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
  const selectedRange = UIElements.dateRangeSelect.value;
  const { domainData, label } = getFilteredDataForRange(selectedRange);
  if (!domainData || Object.keys(domainData).length === 0) {
    alert(`No domain data to export for the selected period: ${label}`);
    return;
  }
  const csvString = convertDataToCsv(domainData);
  const filename = `focusflow_export_${label.toLowerCase().replace(/\s+/g, '_')}_${formatDate(new Date())}.csv`;
  triggerCsvDownload(csvString, filename);
}

// *** ADDED: Handler for Data Retention Change ***
function handleDataRetentionChange() {
  if (!UIElements.dataRetentionSelect) return;
  const selectedValue = parseInt(UIElements.dataRetentionSelect.value, 10); // Value is in days or -1
  if (isNaN(selectedValue)) {
    console.error('Invalid data retention value selected:', UIElements.dataRetentionSelect.value);
    UIElements.dataRetentionSelect.value = DEFAULT_DATA_RETENTION_DAYS; // Reset to default
    return;
  }
  console.log(`[Options] Data retention setting changed to: ${selectedValue} days (-1 means forever)`);
  browser.storage.local
    .set({ [STORAGE_KEY_DATA_RETENTION_DAYS]: selectedValue })
    .then(() => {
      console.log('[Options] Data retention setting saved successfully.');
      // Optional: Notify background to possibly run prune check sooner than daily alarm?
      // browser.runtime.sendMessage({ action: 'checkPruning' });
    })
    .catch((error) => {
      console.error('Error saving data retention setting:', error);
      alert('Failed to save data retention setting.');
      // Consider reverting the dropdown selection on error
      // loadAllData(); // Or reload all settings if save failed
    });
}

// Add these functions to options-handlers.js

// --- Data Export Handler ---
// In options-handlers.js

// --- Data Export Handler ---
async function handleExportData() {
  console.log('[Data Export] Starting export...');
  try {
    // Define all keys to export (include settings)
    // *** CORRECTED: Use constants directly, not via FocusFlowState ***
    const keysToExport = [
      'trackedData',
      'categoryTimeData',
      'categories',
      'categoryAssignments',
      'rules',
      'dailyDomainData',
      'dailyCategoryData',
      'hourlyData',
      STORAGE_KEY_IDLE_THRESHOLD, // CORRECTED
      STORAGE_KEY_DATA_RETENTION_DAYS, // CORRECTED
    ];

    const storedData = await browser.storage.local.get(keysToExport);

    // Prepare the final object, ensuring all keys exist even if empty
    const dataToExport = {};
    keysToExport.forEach((key) => {
      // Provide sensible defaults for missing data
      if (key === 'categories') {
        dataToExport[key] = storedData[key] || ['Other'];
      } else if (key === 'rules') {
        dataToExport[key] = storedData[key] || [];
        // *** CORRECTED: Use constants directly in checks ***
      } else if (key === STORAGE_KEY_IDLE_THRESHOLD) {
        dataToExport[key] = storedData[key] ?? DEFAULT_IDLE_SECONDS; // CORRECTED
      } else if (key === STORAGE_KEY_DATA_RETENTION_DAYS) {
        dataToExport[key] = storedData[key] ?? DEFAULT_DATA_RETENTION_DAYS; // CORRECTED
      } else {
        dataToExport[key] = storedData[key] || {}; // Default to empty object for tracking data
      }
    });

    // Create JSON string
    const jsonString = JSON.stringify(dataToExport, null, 2); // Pretty print JSON
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

    // Create filename
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `focusflow_backup_${dateStr}.ffm`;

    // Trigger download (similar to CSV export)
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

// --- Data Import Handlers ---
function handleImportDataClick() {
  // Trigger the hidden file input
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
  // if (!file.type || file.type !== 'application/json') {
  //   alert('Import failed: Please select a valid JSON (.json) backup file.');
  //   // Reset file input
  //   event.target.value = null;
  //   return;
  // }
  if (!file.name || !file.name.toLowerCase().endsWith('.ffm')) {
    alert('Import failed: Please select a valid FocusFlow backup (.ffm) file.');
    // Reset file input
    event.target.value = null;
    return;
  }

  const reader = new FileReader();

  reader.onload = async (e) => {
    let importedData;
    try {
      importedData = JSON.parse(e.target.result);
      console.log('[Data Import] File parsed successfully.');

      // *** Basic Validation ***
      const requiredKeys = [
        'trackedData',
        'categoryTimeData',
        'categories',
        'categoryAssignments',
        'rules',
        'dailyDomainData',
        'dailyCategoryData',
        'hourlyData',
      ];
      const missingKeys = requiredKeys.filter((key) => !(key in importedData));

      if (missingKeys.length > 0) {
        throw new Error(`Import file is missing required data keys: ${missingKeys.join(', ')}`);
      }
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
      // Add more specific validation if needed (e.g., check rule structure)

      // --- Confirmation ---
      const confirmation = confirm(
        'IMPORT WARNING:\n\nThis will OVERWRITE all your current FocusFlow Monitor settings and tracking data with the data from the selected file.\n\nAre you sure you want to proceed?'
      );

      if (!confirmation) {
        console.log('[Data Import] User cancelled import.');
        if (UIElements.importStatus) {
          UIElements.importStatus.textContent = 'Import cancelled by user.';
          UIElements.importStatus.className = 'status-message'; // Reset class
          UIElements.importStatus.style.display = 'block';
        }
        // Reset file input
        event.target.value = null;
        return;
      }

      // --- Apply Data ---
      console.log('[Data Import] User confirmed. Applying imported data...');
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = 'Importing... Please wait.';
        UIElements.importStatus.className = 'status-message';
        UIElements.importStatus.style.display = 'block';
      }

      await applyImportedData(importedData); // Call the function to save and refresh
    } catch (error) {
      console.error('[Data Import] Error processing import file:', error);
      alert(`Import failed: ${error.message}`);
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = `Import failed: ${error.message}`;
        UIElements.importStatus.className = 'status-message error';
        UIElements.importStatus.style.display = 'block';
      }
      // Reset file input on error too
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
    // Reset file input
    event.target.value = null;
  };

  reader.readAsText(file);
}

// Function to save imported data and trigger refreshes
async function applyImportedData(dataToImport) {
  try {
    // Use browser.storage.local.set to save the entire imported object
    // This will overwrite existing values for these keys.
    await browser.storage.local.set(dataToImport);
    console.log('[Data Import] Data successfully saved to storage.');

    // Notify background script to reload its state from storage
    await browser.runtime.sendMessage({ action: 'importedData' });
    console.log('[Data Import] Sent message to background script to reload state.');

    // Show success message
    if (UIElements.importStatus) {
      UIElements.importStatus.textContent = 'Import successful! Reloading options page...';
      UIElements.importStatus.className = 'status-message success';
      UIElements.importStatus.style.display = 'block';
    }

    // Reload the options page to reflect the changes
    // A short delay allows the user to see the success message
    setTimeout(() => {
      location.reload();
    }, 1500); // Reload after 1.5 seconds
  } catch (error) {
    console.error('[Data Import] Error applying imported data:', error);
    alert(`Failed to apply imported data: ${error.message}`);
    if (UIElements.importStatus) {
      UIElements.importStatus.textContent = `Import failed: ${error.message}`;
      UIElements.importStatus.className = 'status-message error';
      UIElements.importStatus.style.display = 'block';
    }
  } finally {
    // Reset file input in case of error during apply/save
    if (UIElements.importFileInput) UIElements.importFileInput.value = null;
  }
}
// *** END ADDED ***

/**
 * Handles changes to productivity rating radio buttons.
 * Saves the updated rating to storage immediately.
 * @param {Event} event - The input change event.
 */
async function handleProductivityRatingChange(event) {
  // Ensure the event target is one of our radio buttons
  if (event.target.type !== 'radio' || !event.target.name.startsWith('rating-')) {
    return;
  }

  const category = event.target.dataset.category;
  const newRating = parseInt(event.target.value, 10); // Value is -1, 0, or 1

  if (!category || isNaN(newRating)) {
    console.error('Could not get category or rating from event:', event.target);
    return;
  }

  console.log(`[Productivity] Rating changed for "${category}" to ${newRating}`);

  try {
    // Get current user ratings from storage
    const result = await browser.storage.local.get(STORAGE_KEY_PRODUCTIVITY_RATINGS);
    const currentRatings = result[STORAGE_KEY_PRODUCTIVITY_RATINGS] || {};

    // Update the specific category rating
    currentRatings[category] = newRating;

    // Save the updated ratings object back to storage
    await browser.storage.local.set({ [STORAGE_KEY_PRODUCTIVITY_RATINGS]: currentRatings });
    console.log(`[Productivity] Saved updated ratings.`);

    // Update AppState immediately (optional but good for responsiveness)
    AppState.categoryProductivityRatings = currentRatings;

    // Trigger a recalculation and display update for the score
    // This re-fetches data for the current range and recalculates the score
    updateDisplayForSelectedRangeUI();
  } catch (error) {
    console.error('Error saving productivity rating:', error);
    alert('Failed to save productivity setting. Please try again.');
    // Optional: Revert the radio button state? (more complex)
  }
}

console.log('[System] options-handlers.js loaded (v0.8.1)');
