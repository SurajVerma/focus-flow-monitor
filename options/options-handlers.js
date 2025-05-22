// options-handlers.js (v0.8.13 - Fix assign success msg, Add rule validation msgs)

// --- Helper to reset category list item UI ---
function resetCategoryItemUI(listItem) {
  if (!listItem) return;
  const categoryNameSpan = listItem.querySelector('.category-name-display');
  const inputField = listItem.querySelector('.category-edit-input');
  const controlsDiv = listItem.querySelector('.category-controls');

  if (!categoryNameSpan || !controlsDiv || !inputField) {
    console.warn('Could not find expected elements in category list item for UI reset.');
    return;
  }

  inputField.style.display = 'none';
  if (listItem.dataset.originalName) {
    inputField.value = listItem.dataset.originalName; // Restore original value on cancel
  }
  categoryNameSpan.style.display = 'inline-block';

  const editBtn = controlsDiv.querySelector('.category-edit-btn');
  const deleteBtn = controlsDiv.querySelector('.category-delete-btn');
  const saveBtn = controlsDiv.querySelector('.category-save-btn');
  const cancelBtn = controlsDiv.querySelector('.category-cancel-btn');

  if (editBtn) editBtn.style.display = 'inline-block';
  if (deleteBtn) deleteBtn.style.display = 'inline-block';
  if (saveBtn) saveBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';

  if (listItem.dataset.originalName) delete listItem.dataset.originalName;
  listItem.classList.remove('editing'); // Ensure editing class is removed
}

// --- Helper for displaying/clearing error messages ---
/**
 * Displays a message in a specified error element.
 * @param {string} elementId - The ID of the HTML element to display the error in.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message (styled red), false for success/info.
 */
function displayMessage(elementId, message, isError = true) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = message ? 'block' : 'none';
    errorElement.style.color = isError ? 'var(--accent-color-red, #dc3545)' : 'var(--accent-color-green, #28a745)';
    // Clear message after a delay if it's not an error that requires user action
    if (!isError || (message && message.toLowerCase().includes('success'))) {
      setTimeout(() => {
        // Only clear if the message currently shown is the one we set
        if (errorElement.textContent === message) {
          errorElement.textContent = '';
          errorElement.style.display = 'none';
        }
      }, 3000);
    }
  }
}

/**
 * Clears a message from a specified error element.
 * @param {string} elementId - The ID of the HTML element.
 */
function clearMessage(elementId) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
}

// --- Event Handlers ---

// Category Management Handlers
const ADD_CATEGORY_ERROR_ID = 'newCategoryNameError';

function handleAddCategory() {
  try {
    clearMessage(ADD_CATEGORY_ERROR_ID); // Clear previous messages for this specific action

    if (!UIElements.newCategoryNameInput) {
      console.warn('UIElements.newCategoryNameInput not found in handleAddCategory');
      displayMessage(ADD_CATEGORY_ERROR_ID, 'An unexpected error occurred.', true);
      return;
    }
    const name = UIElements.newCategoryNameInput.value.trim();
    if (!name) {
      displayMessage(ADD_CATEGORY_ERROR_ID, 'Please enter a category name.', true);
      return;
    }
    if (AppState.categories.some((cat) => cat.toLowerCase() === name.toLowerCase())) {
      displayMessage(ADD_CATEGORY_ERROR_ID, `Category "${name}" already exists.`, true);
      return;
    }
    AppState.categories.push(name);
    AppState.categories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    UIElements.newCategoryNameInput.value = '';

    saveCategoriesAndAssignments();

    if (typeof populateCategoryList === 'function') populateCategoryList();
    if (typeof populateCategorySelect === 'function') populateCategorySelect();
    if (typeof populateRuleCategorySelect === 'function') populateRuleCategorySelect();
    if (typeof populateProductivitySettings === 'function') populateProductivitySettings();

    displayMessage(ADD_CATEGORY_ERROR_ID, `Category "${name}" added successfully.`, false);
  } catch (e) {
    console.error('Error adding category:', e);
    displayMessage(ADD_CATEGORY_ERROR_ID, 'Failed to add category. See console for details.', true);
  }
}

function handleDeleteCategory(event) {
  try {
    clearMessage(ADD_CATEGORY_ERROR_ID); // Clear category messages before this action
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

        for (const domain in AppState.categoryAssignments) {
          if (AppState.categoryAssignments[domain] === oldCategoryName) {
            delete AppState.categoryAssignments[domain];
            assignmentsChanged = true;
          }
        }

        const originalRulesLength = AppState.rules.length;
        AppState.rules = AppState.rules.filter(
          (rule) => !(rule.type.includes('-category') && rule.value === oldCategoryName)
        );
        rulesChanged = AppState.rules.length !== originalRulesLength;

        const savePromises = [saveCategoriesAndAssignments()];
        if (rulesChanged && typeof saveRules === 'function') savePromises.push(saveRules());

        Promise.all(savePromises)
          .then(() => {
            if (typeof recalculateAndUpdateCategoryTotals === 'function') {
              return recalculateAndUpdateCategoryTotals({
                type: 'categoryDelete',
                oldCategory: oldCategoryName,
                newCategory: 'Other',
              });
            }
          })
          .then(() => {
            if (typeof populateCategoryList === 'function') populateCategoryList();
            if (typeof populateCategorySelect === 'function') populateCategorySelect();
            if (typeof populateRuleCategorySelect === 'function') populateRuleCategorySelect();
            if (typeof populateAssignmentList === 'function') populateAssignmentList();
            if (typeof populateRuleList === 'function') populateRuleList();
            if (typeof populateProductivitySettings === 'function') populateProductivitySettings();
            if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI();
            displayMessage(ADD_CATEGORY_ERROR_ID, `Category "${oldCategoryName}" deleted successfully.`, false);
          })
          .catch((error) => {
            console.error('Error saving or recalculating after category deletion:', error);
            displayMessage(
              ADD_CATEGORY_ERROR_ID,
              'Failed to save changes after deleting category. Please refresh.',
              true
            );
            if (typeof loadAllData === 'function') loadAllData();
          });
      }
    }
  } catch (e) {
    console.error('Error deleting category:', e);
    displayMessage(ADD_CATEGORY_ERROR_ID, 'An error occurred while trying to delete the category.', true);
  }
}

function handleEditCategoryClick(event) {
  clearMessage(ADD_CATEGORY_ERROR_ID); // Clear general category messages

  if (!event.target.classList.contains('category-edit-btn')) return;
  const listItem = event.target.closest('.category-list-item');
  if (!listItem) return;

  const categoryNameSpan = listItem.querySelector('.category-name-display');
  const inputField = listItem.querySelector('.category-edit-input');
  const controlsDiv = listItem.querySelector('.category-controls');

  if (!categoryNameSpan || !inputField || !controlsDiv) {
    console.warn('Required elements for editing category not found.', listItem);
    return;
  }

  // Reset any other item that might be in edit mode
  const currentlyEditingItem = document.querySelector('.category-list-item.editing');
  if (currentlyEditingItem && currentlyEditingItem !== listItem) {
    resetCategoryItemUI(currentlyEditingItem);
  }

  listItem.classList.add('editing'); // Add class for styling edit mode

  const currentName = categoryNameSpan.textContent;
  listItem.dataset.originalName = currentName;

  inputField.value = currentName;
  inputField.style.display = 'inline-block';
  inputField.select();
  categoryNameSpan.style.display = 'none';

  const editBtn = controlsDiv.querySelector('.category-edit-btn');
  const deleteBtn = controlsDiv.querySelector('.category-delete-btn');
  const saveBtn = controlsDiv.querySelector('.category-save-btn');
  const cancelBtn = controlsDiv.querySelector('.category-cancel-btn');

  if (editBtn) editBtn.style.display = 'none';
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'inline-block';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function handleCancelCategoryEditClick(event) {
  if (!event.target.classList.contains('category-cancel-btn')) return;
  const listItem = event.target.closest('.category-list-item');
  resetCategoryItemUI(listItem);
  clearMessage(ADD_CATEGORY_ERROR_ID); // Clear any messages related to category form
}

async function handleSaveCategoryClick(event) {
  if (!event.target.classList.contains('category-save-btn')) return;
  clearMessage(ADD_CATEGORY_ERROR_ID); // Clear previous messages specifically for category operations

  const saveButton = event.target;
  const listItem = saveButton.closest('.category-list-item');
  const inputField = listItem.querySelector('.category-edit-input');
  const controlsDiv = listItem.querySelector('.category-controls');

  if (!listItem || !inputField || !controlsDiv) return;

  const oldName = listItem.dataset.originalName;
  const newName = inputField.value.trim();

  if (!newName) {
    displayMessage(ADD_CATEGORY_ERROR_ID, 'Category name cannot be empty.', true);
    inputField.focus();
    return;
  }
  if (newName === oldName) {
    resetCategoryItemUI(listItem);
    return;
  }
  if (newName === 'Other') {
    displayMessage(
      ADD_CATEGORY_ERROR_ID,
      'Cannot rename a category to "Other". "Other" is a default fallback category.',
      true
    );
    inputField.value = oldName;
    inputField.focus();
    return;
  }
  if (AppState.categories.some((cat) => cat.toLowerCase() === newName.toLowerCase() && cat !== oldName)) {
    displayMessage(ADD_CATEGORY_ERROR_ID, `Category "${newName}" already exists.`, true);
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
    if (categoryIndex > -1) {
      AppState.categories[categoryIndex] = newName;
      AppState.categories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } else {
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
    if (AppState.categoryProductivityRatings.hasOwnProperty(oldName)) {
      AppState.categoryProductivityRatings[newName] = AppState.categoryProductivityRatings[oldName];
      delete AppState.categoryProductivityRatings[oldName];
      await browser.storage.local.set({ [STORAGE_KEY_PRODUCTIVITY_RATINGS]: AppState.categoryProductivityRatings });
    }

    const savePromises = [saveCategoriesAndAssignments()];
    if (rulesChanged && typeof saveRules === 'function') savePromises.push(saveRules());
    await Promise.all(savePromises);

    if (typeof recalculateAndUpdateCategoryTotals === 'function') {
      await recalculateAndUpdateCategoryTotals({ type: 'categoryRename', oldCategory: oldName, newCategory: newName });
    }

    // Repopulate lists which might depend on the changed category name
    if (typeof populateCategoryList === 'function') populateCategoryList();
    if (typeof populateCategorySelect === 'function') populateCategorySelect();
    if (typeof populateRuleCategorySelect === 'function') populateRuleCategorySelect();
    if (assignmentsChanged && typeof populateAssignmentList === 'function') populateAssignmentList();
    if (rulesChanged && typeof populateRuleList === 'function') populateRuleList();
    if (typeof populateProductivitySettings === 'function') populateProductivitySettings();
    if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI();

    console.log(`Category "${oldName}" renamed to "${newName}" and changes saved.`);
    displayMessage(ADD_CATEGORY_ERROR_ID, `Category "${oldName}" successfully renamed to "${newName}".`, false);
  } catch (error) {
    console.error('Error saving category rename:', error);
    displayMessage(ADD_CATEGORY_ERROR_ID, `Failed to save category rename: ${error.message || 'Unknown error'}`, true);
  } finally {
    saveButton.textContent = originalButtonText;
    saveButton.disabled = false;
    if (cancelButton) cancelButton.disabled = false;
    // If an error occurred and we are not repopulating the list, ensure edit mode is exited
    if (listItem.classList.contains('editing')) {
      resetCategoryItemUI(listItem); // Ensures UI reset
    }
  }
}

// Assignment Management Handlers
const ASSIGN_DOMAIN_ERROR_ID = 'assignDomainError';

function resetAssignDomainForm() {
  if (UIElements.domainPatternInput) UIElements.domainPatternInput.value = '';
  if (UIElements.categorySelect) UIElements.categorySelect.value = '';
  if (UIElements.assignDomainBtn) UIElements.assignDomainBtn.textContent = 'Assign Domain';
  if (UIElements.cancelAssignDomainBtn) UIElements.cancelAssignDomainBtn.style.display = 'none';
  AppState.editingAssignmentOriginalDomain = null;
  // The message span (ASSIGN_DOMAIN_ERROR_ID) is cleared at the beginning of handleAssignDomainOrSaveChanges
  // or by displayMessage's own timeout for success messages.

  const currentlyEditedItem = document.querySelector('#assignmentList .list-item-editing');
  if (currentlyEditedItem) {
    currentlyEditedItem.classList.remove('list-item-editing');
  }
}

function handleAssignDomainOrSaveChanges() {
  clearMessage(ASSIGN_DOMAIN_ERROR_ID); // Clear previous errors/messages for this action

  if (!UIElements.domainPatternInput || !UIElements.categorySelect || !UIElements.assignDomainBtn) {
    displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Form elements missing. Cannot proceed.', true);
    return;
  }

  const domainPattern = UIElements.domainPatternInput.value.trim();
  const category = UIElements.categorySelect.value;

  if (!domainPattern) {
    displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Please enter a domain pattern (e.g., google.com or *.example.com).', true);
    return;
  }
  if (!category) {
    displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Please select a category.', true);
    return;
  }

  // Use the new isValidDomainPattern function from options-utils.js
  if (typeof isValidDomainPattern === 'function' && !isValidDomainPattern(domainPattern)) {
    // isValidDomainPattern is from options-utils.js
    displayMessage(
      ASSIGN_DOMAIN_ERROR_ID,
      'Invalid domain pattern format. Use "example.com", "*.example.com", or a simple hostname like "localhost". Paths are not allowed.',
      true
    );
    return;
  } else if (typeof isValidDomainPattern !== 'function') {
    // Fallback or warning if function isn't loaded, though it should be
    console.warn('isValidDomainPattern function not found, using basic checks for assignment.');
    // Basic regex from previous version if needed as a fallback, though less ideal
    const domainRegexBasic = /^(?:([\w\-*]+)\.)?([\w\-]+)\.([a-z\.]{2,})$/i;
    const hostnameRegexBasic = /^[\w\-]+$/i;
    const isValidDomainBasic = domainRegexBasic.test(domainPattern);
    const isValidWildcardBasic = domainPattern.startsWith('*.') && domainRegexBasic.test(domainPattern.substring(2));
    const isValidHostnameBasic = hostnameRegexBasic.test(domainPattern);
    if (!(isValidDomainBasic || isValidWildcardBasic || isValidHostnameBasic)) {
      displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Invalid domain pattern format (basic check failed).', true);
      return;
    }
  }

  const isEditMode = !!AppState.editingAssignmentOriginalDomain;
  const originalDomain = AppState.editingAssignmentOriginalDomain;

  // Check for conflicts only if the domain pattern has changed or it's a new assignment
  if (!isEditMode || (isEditMode && domainPattern.toLowerCase() !== originalDomain.toLowerCase())) {
    const conflictingDomainKey = Object.keys(AppState.categoryAssignments).find(
      (key) => key.toLowerCase() === domainPattern.toLowerCase()
    );
    if (conflictingDomainKey) {
      displayMessage(
        ASSIGN_DOMAIN_ERROR_ID,
        `The pattern "${domainPattern}" is already assigned. Please edit that entry or use a different pattern.`,
        true
      );
      return;
    }
  }

  let oldCategoryForRecalc = 'Other';
  let successMessage = '';

  if (isEditMode) {
    // --- Edit Mode ---
    if (originalDomain && AppState.categoryAssignments.hasOwnProperty(originalDomain)) {
      oldCategoryForRecalc = AppState.categoryAssignments[originalDomain];
      // If domain pattern changed, delete old one.
      if (domainPattern.toLowerCase() !== originalDomain.toLowerCase()) {
        delete AppState.categoryAssignments[originalDomain];
      }
    } else {
      displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Error: Original assignment not found for editing.', true);
      resetAssignDomainForm(); // Reset form to avoid inconsistent state
      return;
    }
    AppState.categoryAssignments[domainPattern] = category;
    successMessage = `Assignment for "${domainPattern}" updated successfully.`;
  } else {
    // --- Add Mode ---
    if (
      AppState.categoryAssignments.hasOwnProperty(domainPattern) &&
      AppState.categoryAssignments[domainPattern] === category
    ) {
      displayMessage(
        ASSIGN_DOMAIN_ERROR_ID,
        `"${domainPattern}" is already assigned to the "${category}" category.`,
        true
      );
      return;
    }
    if (AppState.categoryAssignments.hasOwnProperty(domainPattern)) {
      oldCategoryForRecalc = AppState.categoryAssignments[domainPattern];
    }
    AppState.categoryAssignments[domainPattern] = category;
    successMessage = `Domain "${domainPattern}" assigned to "${category}" successfully.`;
  }

  saveCategoriesAndAssignments()
    .then(() => {
      if (typeof populateAssignmentList === 'function') populateAssignmentList();
      if (typeof recalculateAndUpdateCategoryTotals === 'function') {
        return recalculateAndUpdateCategoryTotals({
          type: 'assignmentChange',
          domain: domainPattern,
          oldDomain: isEditMode && domainPattern.toLowerCase() !== originalDomain.toLowerCase() ? originalDomain : null,
          oldCategory: oldCategoryForRecalc,
          newCategory: category,
        });
      }
    })
    .then(() => {
      if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI();
      displayMessage(ASSIGN_DOMAIN_ERROR_ID, successMessage, false);
    })
    .catch((error) => {
      console.error('Error saving/assigning domain or recalculating:', error);
      displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Failed to save assignment. Check console for details.', true);
    })
    .finally(() => {
      resetAssignDomainForm();
    });
}

function handleDeleteAssignment(event) {
  try {
    clearMessage(ASSIGN_DOMAIN_ERROR_ID); // Clear messages for this section
    if (!event.target.classList.contains('assignment-delete-btn') || !event.target.closest('#assignmentList')) return;
    const domainToDelete = event.target.dataset.domain;

    // If the form is in edit mode for the item being deleted, reset the form.
    if (AppState.editingAssignmentOriginalDomain === domainToDelete) {
      resetAssignDomainForm();
    }

    if (domainToDelete && AppState.categoryAssignments.hasOwnProperty(domainToDelete)) {
      if (
        confirm(
          `DELETE ASSIGNMENT?\n"${domainToDelete}" will no longer be specifically assigned and may fall into 'Other' or match a wildcard.`
        )
      ) {
        const oldCategory = AppState.categoryAssignments[domainToDelete];
        delete AppState.categoryAssignments[domainToDelete];

        saveCategoriesAndAssignments()
          .then(() => {
            if (typeof populateAssignmentList === 'function') populateAssignmentList();
            if (typeof recalculateAndUpdateCategoryTotals === 'function') {
              return recalculateAndUpdateCategoryTotals({
                type: 'assignmentChange',
                domain: domainToDelete,
                oldCategory: oldCategory,
                newCategory: null, // Indicates deletion or falling back to 'Other'
              });
            }
          })
          .then(() => {
            if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI();
            displayMessage(ASSIGN_DOMAIN_ERROR_ID, `Assignment for "${domainToDelete}" deleted successfully.`, false);
          })
          .catch((error) => {
            console.error('Error deleting assignment or recalculating:', error);
            displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Failed to delete assignment. Check console for errors.', true);
            if (typeof loadAllData === 'function') loadAllData();
          });
      }
    }
  } catch (e) {
    console.error('Error deleting assignment:', e);
    displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'An error occurred while trying to delete the assignment.', true);
  }
}

function handleEditAssignmentClick(event) {
  if (!event.target.classList.contains('assignment-edit-btn') || !event.target.closest('#assignmentList')) return;

  clearMessage(ASSIGN_DOMAIN_ERROR_ID);
  const listItem = event.target.closest('.assignment-list-item');
  const domainSpan = listItem.querySelector('.assignment-domain');
  const categorySpan = listItem.querySelector('.assignment-category');
  const originalDomain = domainSpan ? domainSpan.textContent : null;
  const originalCategory = categorySpan ? categorySpan.textContent : null;

  if (
    !originalDomain ||
    !originalCategory ||
    !UIElements.domainPatternInput ||
    !UIElements.categorySelect ||
    !UIElements.assignDomainBtn ||
    !UIElements.cancelAssignDomainBtn
  ) {
    displayMessage(ASSIGN_DOMAIN_ERROR_ID, 'Error preparing for edit. UI elements missing.', true);
    return;
  }

  document
    .querySelectorAll('#assignmentList .list-item-editing')
    .forEach((li) => li.classList.remove('list-item-editing'));
  listItem.classList.add('list-item-editing');

  AppState.editingAssignmentOriginalDomain = originalDomain;
  UIElements.domainPatternInput.value = originalDomain;
  UIElements.categorySelect.value = originalCategory;
  UIElements.assignDomainBtn.textContent = 'Save Changes';
  UIElements.cancelAssignDomainBtn.style.display = 'inline-block';

  UIElements.domainPatternInput.focus();
  UIElements.domainPatternInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function handleCancelAssignDomainEdit() {
  resetAssignDomainForm(); // This will now NOT clear the message span by default
  clearMessage(ASSIGN_DOMAIN_ERROR_ID); // Explicitly clear if cancel is hit.
}

// Rule Management Handlers
const ADD_RULE_ERROR_ID = 'addRuleError';

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
  clearMessage(ADD_RULE_ERROR_ID);
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
      displayMessage(ADD_RULE_ERROR_ID, 'Error: UI elements missing for rule creation.', true);
      return;
    }
    const type = UIElements.ruleTypeSelect.value;
    let value = '',
      limitSeconds = null,
      startTime = null,
      endTime = null,
      days = null;

    if (type.includes('-url')) {
      value = UIElements.rulePatternInput.value.trim();
      if (!value) {
        displayMessage(ADD_RULE_ERROR_ID, 'Please enter a URL pattern (e.g., example.com or *.example.com).', true);
        return;
      }
      // Use the new isValidDomainPattern function from options-utils.js
      if (typeof isValidDomainPattern === 'function' && !isValidDomainPattern(value)) {
        // isValidDomainPattern is from options-utils.js
        displayMessage(
          ADD_RULE_ERROR_ID,
          'Invalid URL pattern. Please use a valid domain (e.g., example.com) or wildcard (e.g., *.example.com). Paths are not allowed.',
          true
        );
        return;
      } else if (typeof isValidDomainPattern !== 'function') {
        console.warn('isValidDomainPattern function not found, skipping advanced URL validation for adding rule.');
      }
    } else if (type.includes('-category')) {
      value = UIElements.ruleCategorySelect.value;
      if (!value) {
        displayMessage(ADD_RULE_ERROR_ID, 'Please select a category for the rule.', true);
        return;
      }
    } else {
      displayMessage(ADD_RULE_ERROR_ID, 'Invalid rule type selected.', true);
      return;
    }

    if (type.includes('limit-')) {
      const limitValue = parseInt(UIElements.ruleLimitInput.value, 10);
      const unit = UIElements.ruleUnitSelect.value;
      if (isNaN(limitValue) || limitValue <= 0) {
        displayMessage(ADD_RULE_ERROR_ID, 'Please enter a valid positive time limit.', true);
        return;
      }
      limitSeconds = unit === 'hours' ? limitValue * 3600 : limitValue * 60;
    }
    if (type.includes('block-')) {
      startTime = UIElements.ruleStartTimeInput.value || null;
      endTime = UIElements.ruleEndTimeInput.value || null;
      if (startTime && !endTime) {
        displayMessage(ADD_RULE_ERROR_ID, 'Please provide an End Time if Start Time is set for the schedule.', true);
        return;
      }
      if (!startTime && endTime) {
        displayMessage(ADD_RULE_ERROR_ID, 'Please provide a Start Time if End Time is set for the schedule.', true);
        return;
      }
      if (startTime && endTime && startTime >= endTime) {
        displayMessage(ADD_RULE_ERROR_ID, 'Scheduled Start Time must be before End Time.', true);
        return;
      }
      const selectedDays = Array.from(UIElements.ruleDayCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      if (selectedDays.length > 0 && selectedDays.length < 7) {
        days = selectedDays;
      }
    }
    const exists = AppState.rules.some(
      (rule) => rule.type === type && rule.value.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      displayMessage(ADD_RULE_ERROR_ID, `A rule for this exact type and target ("${value}") already exists.`, true);
      return;
    }

    const newRule = { type, value };
    if (limitSeconds !== null) newRule.limitSeconds = limitSeconds;
    if (startTime) newRule.startTime = startTime;
    if (endTime) newRule.endTime = endTime;
    if (days) newRule.days = days;

    AppState.rules.push(newRule);
    console.log('[Options] Added rule:', newRule);
    if (typeof saveRules === 'function') saveRules();
    if (typeof populateRuleList === 'function') populateRuleList();

    UIElements.rulePatternInput.value = '';
    UIElements.ruleCategorySelect.value = '';
    UIElements.ruleLimitInput.value = '';
    UIElements.ruleUnitSelect.value = 'minutes';
    UIElements.ruleStartTimeInput.value = '';
    UIElements.ruleEndTimeInput.value = '';
    UIElements.ruleDayCheckboxes.forEach((cb) => (cb.checked = false));
    displayMessage(ADD_RULE_ERROR_ID, 'Rule added successfully.', false);
  } catch (e) {
    console.error('Error adding rule:', e);
    displayMessage(ADD_RULE_ERROR_ID, 'Failed to add rule. See console for details.', true);
  }
}

function handleDeleteRule(event) {
  clearMessage(ADD_RULE_ERROR_ID); // Clear messages for this section
  try {
    const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
    if (!isNaN(ruleIndex) && ruleIndex >= 0 && ruleIndex < AppState.rules.length) {
      const ruleToDelete = AppState.rules[ruleIndex];
      let confirmMessage = `DELETE RULE?\n\nType: ${ruleToDelete.type}\nTarget: ${ruleToDelete.value}`;
      if (ruleToDelete.limitSeconds !== undefined && typeof formatTime === 'function')
        confirmMessage += `\nLimit: ${formatTime(ruleToDelete.limitSeconds, false)}/day`;
      if (ruleToDelete.startTime || ruleToDelete.days) {
        const timePart =
          ruleToDelete.startTime && ruleToDelete.endTime && typeof formatTimeToAMPM === 'function'
            ? `${formatTimeToAMPM(ruleToDelete.startTime)}-${formatTimeToAMPM(ruleToDelete.endTime)}`
            : 'All Day';
        const daysPart = ruleToDelete.days ? ruleToDelete.days.join(',') : 'All Week';
        confirmMessage += `\nSchedule: ${timePart}, ${daysPart}`;
      }

      if (confirm(confirmMessage)) {
        AppState.rules.splice(ruleIndex, 1);
        console.log('[Options] Deleted rule at index:', ruleIndex);
        if (typeof saveRules === 'function') saveRules();
        if (typeof populateRuleList === 'function') populateRuleList();
        displayMessage(ADD_RULE_ERROR_ID, 'Rule deleted successfully.', false);
      }
    } else {
      console.warn('Delete button clicked, but rule index not found or invalid:', event.target.dataset.ruleIndex);
      displayMessage(ADD_RULE_ERROR_ID, 'Could not delete rule: invalid index.', true);
    }
  } catch (e) {
    console.error('Error deleting rule:', e);
    displayMessage(ADD_RULE_ERROR_ID, 'An error occurred while trying to delete the rule.', true);
  }
}

function handleEditRuleClick(event) {
  clearMessage(ADD_RULE_ERROR_ID); // Clear add rule errors when starting an edit
  const ruleIndex = parseInt(event.target.dataset.ruleIndex, 10);
  if (isNaN(ruleIndex) || ruleIndex < 0 || ruleIndex >= AppState.rules.length) {
    alert('Could not find rule to edit.'); // Modal will not open, so alert is okay here.
    return;
  }
  AppState.editingRuleIndex = ruleIndex;
  const rule = AppState.rules[ruleIndex];

  // Ensure modal UI elements are correctly referenced from UIElements
  if (
    !UIElements.editRuleModal ||
    !UIElements.editRuleTypeDisplay ||
    !UIElements.editRulePatternInput ||
    !UIElements.editRuleCategorySelect ||
    !UIElements.editRuleLimitInput ||
    !UIElements.editRuleUnitSelect ||
    !UIElements.editRuleIndexInput ||
    !UIElements.editRuleStartTimeInput ||
    !UIElements.editRuleEndTimeInput ||
    !UIElements.editRuleDayCheckboxes
  ) {
    alert('Error opening edit form for rule. UI elements missing. Please check console.');
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
  if (isCategoryType) {
    if (typeof populateRuleCategorySelect === 'function') populateRuleCategorySelect(); // Ensures edit modal's select is populated
    UIElements.editRuleCategorySelect.value = rule.value;
    // If category was deleted, show it as disabled
    if (!AppState.categories.includes(rule.value)) {
      const tempOpt = document.createElement('option');
      tempOpt.value = rule.value;
      tempOpt.textContent = `${rule.value} (Deleted)`;
      tempOpt.disabled = true;
      UIElements.editRuleCategorySelect.appendChild(tempOpt);
      UIElements.editRuleCategorySelect.value = rule.value; // Ensure it's selected
    }
  }
  if (isLimitType) {
    const limitSec = rule.limitSeconds || 0;
    if (limitSec > 0 && limitSec % 3600 === 0 && limitSec / 3600 >= 1) {
      // Check for whole hours
      UIElements.editRuleLimitInput.value = limitSec / 3600;
      UIElements.editRuleUnitSelect.value = 'hours';
    } else {
      UIElements.editRuleLimitInput.value = Math.round(limitSec / 60); // Default to minutes
      UIElements.editRuleUnitSelect.value = 'minutes';
    }
    if (limitSec > 0 && UIElements.editRuleLimitInput.value == 0) {
      // Ensure small limits (e.g. 30s) are shown as 1 min
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
    UIElements.editRuleDayCheckboxes.forEach((cb) => (cb.checked = false)); // Reset first
    if (rule.days && Array.isArray(rule.days)) {
      rule.days.forEach((dayValue) => {
        const cb = document.querySelector(`#editRuleModal input[name="editRuleDay"][value="${dayValue}"]`);
        if (cb) cb.checked = true;
      });
    }
  } else {
    // Ensure schedule fields are clear if not a block rule
    UIElements.editRuleStartTimeInput.value = '';
    UIElements.editRuleEndTimeInput.value = '';
    UIElements.editRuleDayCheckboxes.forEach((cb) => (cb.checked = false));
  }
  UIElements.editRuleModal.style.display = 'flex';
}

function handleCancelEditClick() {
  // For Edit Rule Modal
  if (UIElements.editRuleModal) UIElements.editRuleModal.style.display = 'none';
  AppState.editingRuleIndex = -1;
}

function handleSaveChangesClick() {
  // For Edit Rule Modal
  const editIndex = AppState.editingRuleIndex;
  if (editIndex < 0 || editIndex >= AppState.rules.length) {
    alert('Error: No rule selected for saving.');
    return;
  }
  const originalRule = AppState.rules[editIndex];
  const updatedRule = { type: originalRule.type };

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
    // Use the new isValidDomainPattern function from options-utils.js
    if (typeof isValidDomainPattern === 'function' && !isValidDomainPattern(newVal)) {
      // isValidDomainPattern is from options-utils.js
      alert(
        'Invalid URL pattern. Please use a valid domain (e.g., example.com) or wildcard (e.g., *.example.com). Paths are not allowed.'
      );
      return;
    } else if (typeof isValidDomainPattern !== 'function') {
      console.warn('isValidDomainPattern function not found, skipping advanced URL validation for editing rule.');
    }
    updatedRule.value = newVal;
  } else if (isCategoryType) {
    const newVal = UIElements.editRuleCategorySelect.value;
    const selOpt = UIElements.editRuleCategorySelect.options[UIElements.editRuleCategorySelect.selectedIndex];
    if (!newVal || (selOpt && selOpt.disabled)) {
      alert('Please select a valid category. The previously assigned category may have been deleted.');
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
    if (startTime) updatedRule.startTime = startTime;
    else delete updatedRule.startTime;
    if (endTime) updatedRule.endTime = endTime;
    else delete updatedRule.endTime;
    if (selectedDays.length > 0 && selectedDays.length < 7) updatedRule.days = selectedDays;
    else delete updatedRule.days;
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
  if (typeof saveRules === 'function') saveRules();
  if (typeof populateRuleList === 'function') populateRuleList();

  handleCancelEditClick(); // Close modal
  displayMessage(ADD_RULE_ERROR_ID, `Rule for "${updatedRule.value}" updated successfully.`, false);
}

// Stats Display Handlers
function handleDomainPrev() {
  if (AppState.domainCurrentPage > 1) {
    AppState.domainCurrentPage--;
    if (typeof updateDomainDisplayAndPagination === 'function') updateDomainDisplayAndPagination();
  }
}
function handleDomainNext() {
  const totalItems = AppState.fullDomainDataSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / AppState.domainItemsPerPage));
  if (AppState.domainCurrentPage < totalPages) {
    AppState.domainCurrentPage++;
    if (typeof updateDomainDisplayAndPagination === 'function') updateDomainDisplayAndPagination();
  }
}
function handlePrevMonth() {
  AppState.calendarDate.setMonth(AppState.calendarDate.getMonth() - 1);
  if (typeof renderCalendar === 'function')
    renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth());
  if (typeof highlightSelectedCalendarDay === 'function') highlightSelectedCalendarDay(AppState.selectedDateStr);
}
function handleNextMonth() {
  AppState.calendarDate.setMonth(AppState.calendarDate.getMonth() + 1);
  if (typeof renderCalendar === 'function')
    renderCalendar(AppState.calendarDate.getFullYear(), AppState.calendarDate.getMonth());
  if (typeof highlightSelectedCalendarDay === 'function') highlightSelectedCalendarDay(AppState.selectedDateStr);
}
function handleCalendarDayClick(event) {
  const dayCell = event.target.closest('.calendar-day');
  if (!dayCell) return;
  const dateStr = dayCell.dataset.date;
  if (!dateStr) return;
  AppState.selectedDateStr = dateStr;
  if (typeof highlightSelectedCalendarDay === 'function') highlightSelectedCalendarDay(dateStr);
  const domainDataForDay = AppState.dailyDomainData[dateStr] || {};
  const categoryDataForDay = AppState.dailyCategoryData[dateStr] || {};
  const displayDateLabel = typeof formatDisplayDate === 'function' ? formatDisplayDate(dateStr) : dateStr;
  const totalSeconds = Object.values(domainDataForDay).reduce((sum, time) => sum + (time || 0), 0);
  if (UIElements.dateRangeSelect) UIElements.dateRangeSelect.value = '';
  if (totalSeconds < 1) {
    if (typeof displayNoDataForDate === 'function') displayNoDataForDate(displayDateLabel);
  } else {
    if (typeof updateStatsDisplay === 'function')
      updateStatsDisplay(domainDataForDay, categoryDataForDay, displayDateLabel, dateStr);
  }
}
function handleCalendarMouseOver(event) {
  if (typeof showDayDetailsPopup === 'function') showDayDetailsPopup(event);
}
function handleCalendarMouseOut() {
  if (typeof hideDayDetailsPopup === 'function') hideDayDetailsPopup();
}
function handleChartViewChange(event) {
  AppState.currentChartViewMode = event.target.value;
  console.log(`Chart view changed to: ${AppState.currentChartViewMode}`);
  if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI();
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
    rangeToProcess = AppState.selectedDateStr;
    labelForFilename = AppState.selectedDateStr;
  } else if (selectedRangeOption === '') {
    rangeToProcess = 'today';
    labelForFilename = 'Today';
  }
  const { domainData } = getFilteredDataForRange(rangeToProcess, /^\d{4}-\d{2}-\d{2}$/.test(rangeToProcess));
  if (!domainData || Object.keys(domainData).length === 0) {
    alert(`No domain data to export for the selected period: ${labelForFilename}`);
    return;
  }
  const csvString = convertDataToCsv(domainData);
  const filename = `focusflow_export_${labelForFilename.toLowerCase().replace(/\s+/g, '_')}_${formatDate(
    new Date()
  )}.csv`;
  triggerCsvDownload(csvString, filename);
}

// General Settings Handlers
function handleIdleThresholdChange() {
  if (!UIElements.idleThresholdSelect) return;
  const selectedValue = parseInt(UIElements.idleThresholdSelect.value, 10);
  if (isNaN(selectedValue)) {
    UIElements.idleThresholdSelect.value = DEFAULT_IDLE_SECONDS;
    return;
  }
  browser.storage.local
    .set({ [STORAGE_KEY_IDLE_THRESHOLD]: selectedValue })
    .then(() => console.log('[Options] Idle threshold saved successfully.'))
    .catch((error) => {
      console.error('Error saving idle threshold:', error);
      alert('Failed to save idle threshold setting.');
    });
}
function handleDataRetentionChange() {
  if (!UIElements.dataRetentionSelect) return;
  const selectedValue = parseInt(UIElements.dataRetentionSelect.value, 10);
  if (isNaN(selectedValue)) {
    UIElements.dataRetentionSelect.value = DEFAULT_DATA_RETENTION_DAYS;
    return;
  }
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

// Data Management Handlers
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
      STORAGE_KEY_PRODUCTIVITY_RATINGS,
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
      STORAGE_KEY_POMODORO_SETTINGS,
    ];
    const storedData = await browser.storage.local.get(keysToExport);
    const dataToExport = {};
    keysToExport.forEach((key) => {
      if (key === 'categories') dataToExport[key] = storedData[key] || ['Other'];
      else if (key === 'rules') dataToExport[key] = storedData[key] || [];
      else if (key === STORAGE_KEY_IDLE_THRESHOLD) dataToExport[key] = storedData[key] ?? DEFAULT_IDLE_SECONDS;
      else if (key === STORAGE_KEY_DATA_RETENTION_DAYS)
        dataToExport[key] = storedData[key] ?? DEFAULT_DATA_RETENTION_DAYS;
      else if (key === STORAGE_KEY_PRODUCTIVITY_RATINGS) dataToExport[key] = storedData[key] || {};
      else if (key === STORAGE_KEY_POMODORO_SETTINGS)
        dataToExport[key] = storedData[key] || {
          notifyEnabled: true,
          durations: { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
          sessionsBeforeLongBreak: 4,
        };
      else if (key.startsWith('blockPage_')) {
        if (key.includes('show')) dataToExport[key] = storedData[key] ?? true;
        else if (key === STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE) dataToExport[key] = storedData[key] ?? false;
        else if (key === STORAGE_KEY_BLOCK_PAGE_USER_QUOTES) dataToExport[key] = storedData[key] || [];
        else dataToExport[key] = storedData[key] || '';
      } else dataToExport[key] = storedData[key] || {};
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
    } else {
      alert('Data export might not be fully supported by your browser.');
    }
  } catch (error) {
    console.error('[Data Export] Error exporting data:', error);
    alert(`An error occurred during data export: ${error.message}`);
  }
}
function handleImportDataClick() {
  if (UIElements.importFileInput) UIElements.importFileInput.click();
  else alert('Import button error. Please refresh.');
}
function handleImportFileChange(event) {
  const file = event.target.files ? event.target.files[0] : null;
  if (!file) return;
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
      const requiredKeys = [
        'trackedData',
        'categories',
        'categoryAssignments',
        'rules',
        'dailyDomainData',
        'dailyCategoryData',
        'hourlyData',
      ];
      const missingKeys = requiredKeys.filter((key) => !(key in importedData));
      if (missingKeys.length > 0)
        throw new Error(`Import file is missing required data keys: ${missingKeys.join(', ')}`);
      if (
        !Array.isArray(importedData.categories) ||
        !Array.isArray(importedData.rules) ||
        typeof importedData.trackedData !== 'object'
      ) {
        throw new Error('Import file has incorrect data types.');
      }
      if (!confirm('IMPORT WARNING:\n\nThis will OVERWRITE all current settings and data. Are you sure?')) {
        event.target.value = null;
        return;
      }
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = 'Importing...';
        UIElements.importStatus.className = 'status-message';
        UIElements.importStatus.style.display = 'block';
      }
      const pomodoroDefaults = {
        notifyEnabled: true,
        durations: { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
        sessionsBeforeLongBreak: 4,
      };
      importedData[STORAGE_KEY_POMODORO_SETTINGS] = {
        ...pomodoroDefaults,
        ...(importedData[STORAGE_KEY_POMODORO_SETTINGS] || {}),
      };
      await browser.storage.local.set(importedData);
      await browser.runtime.sendMessage({ action: 'importedData' });
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = 'Import successful! Reloading...';
        UIElements.importStatus.className = 'status-message success';
      }
      setTimeout(() => location.reload(), 1500);
    } catch (error) {
      console.error('[Data Import] Error processing import file:', error);
      alert(`Import failed: ${error.message}`);
      if (UIElements.importStatus) {
        UIElements.importStatus.textContent = `Import failed: ${error.message}`;
        UIElements.importStatus.className = 'status-message error';
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
    }
    event.target.value = null;
  };
  reader.readAsText(file);
}

// Productivity Settings Handlers
async function handleProductivityRatingChange(event) {
  if (event.target.type !== 'radio' || !event.target.name.startsWith('rating-')) return;
  const category = event.target.dataset.category;
  const newRating = parseInt(event.target.value, 10);
  if (!category || isNaN(newRating)) {
    console.error('Could not get category or rating from event:', event.target);
    return;
  }
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_PRODUCTIVITY_RATINGS);
    const currentRatings = result[STORAGE_KEY_PRODUCTIVITY_RATINGS] || {};
    currentRatings[category] = newRating;
    await browser.storage.local.set({ [STORAGE_KEY_PRODUCTIVITY_RATINGS]: currentRatings });
    AppState.categoryProductivityRatings = currentRatings;
    if (typeof updateDisplayForSelectedRangeUI === 'function') updateDisplayForSelectedRangeUI();
  } catch (error) {
    console.error('Error saving productivity rating:', error);
    alert('Failed to save productivity setting. Please try again.');
  }
}

// Block Page Customization Handlers
function handleBlockPageSettingChange(storageKey, value) {
  browser.storage.local
    .set({ [storageKey]: value })
    .then(() => console.log(`[Options] Saved ${storageKey}:`, value))
    .catch((err) => console.error(`[Options] Error saving ${storageKey}:`, err));
}
function handleBlockPageShowQuoteChange() {
  if (!UIElements.blockPageShowQuoteCheckbox || !UIElements.blockPageUserQuotesContainer) return;
  const isChecked = UIElements.blockPageShowQuoteCheckbox.checked;
  handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_SHOW_QUOTE, isChecked);
  UIElements.blockPageUserQuotesContainer.style.display = isChecked ? 'block' : 'none';
}
function handleBlockPageUserQuotesChange() {
  if (!UIElements.blockPageUserQuotesTextarea) return;
  const quotesText = UIElements.blockPageUserQuotesTextarea.value;
  const quotesArray = quotesText
    .split('\n')
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  handleBlockPageSettingChange(STORAGE_KEY_BLOCK_PAGE_USER_QUOTES, quotesArray);
}

// Pomodoro Settings Handlers
let isHandlingPomodoroNotificationToggle = false;
async function handlePomodoroNotificationToggle() {
  if (isHandlingPomodoroNotificationToggle) {
    console.log('[Options Handlers] Toggle already in progress. Ignoring.');
    return;
  }
  isHandlingPomodoroNotificationToggle = true;
  if (!UIElements.pomodoroEnableNotificationsCheckbox || !UIElements.pomodoroNotificationPermissionStatus) {
    console.warn('[Options Handlers] Pomodoro notification UI elements not found.');
    isHandlingPomodoroNotificationToggle = false;
    return;
  }
  const wantsNotifications = UIElements.pomodoroEnableNotificationsCheckbox.checked;
  console.log(`[Options Handlers] Pomodoro checkbox changed. User wants notifications: ${wantsNotifications}`);
  if (AppState.isRequestingPermission && wantsNotifications) {
    console.log('[Options Handlers] Permission request already in progress. Ignoring click.');
    isHandlingPomodoroNotificationToggle = false;
    return;
  }
  let finalNotifyEnabledState = wantsNotifications;
  try {
    if (wantsNotifications) {
      AppState.isRequestingPermission = true;
      console.log('[Options Handlers] Attempting to request/confirm notification permission...');
      const permissionGrantedByUser = await browser.permissions.request({ permissions: ['notifications'] });
      console.log(`[Options Handlers] Notification permission request/check result: ${permissionGrantedByUser}`);
      if (!permissionGrantedByUser) {
        UIElements.pomodoroEnableNotificationsCheckbox.checked = false;
        finalNotifyEnabledState = false;
      }
    }
    AppState.pomodoroNotifyEnabled = finalNotifyEnabledState;
    const settingsResult = await browser.storage.local.get(STORAGE_KEY_POMODORO_SETTINGS);
    let pomodoroSettings = settingsResult[STORAGE_KEY_POMODORO_SETTINGS] || {};
    const defaultDurations = { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
    const defaultSessions = 4;
    pomodoroSettings.durations = pomodoroSettings.durations || defaultDurations;
    pomodoroSettings.sessionsBeforeLongBreak = pomodoroSettings.sessionsBeforeLongBreak || defaultSessions;
    pomodoroSettings.notifyEnabled = AppState.pomodoroNotifyEnabled;
    await browser.storage.local.set({ [STORAGE_KEY_POMODORO_SETTINGS]: pomodoroSettings });
    console.log('[Options Handlers] Pomodoro notification setting saved:', pomodoroSettings);
    if (typeof updatePomodoroPermissionStatusDisplay === 'function') {
      await updatePomodoroPermissionStatusDisplay();
    }
    browser.runtime
      .sendMessage({ action: 'pomodoroSettingsChanged' })
      .then((response) => console.log('[Options Handlers] Notified background of Pomodoro settings change:', response))
      .catch((err) => console.error('[Options Handlers] Error notifying background:', err));
  } catch (error) {
    console.error('[Options Handlers] Error:', error);
    if (UIElements.pomodoroEnableNotificationsCheckbox) {
      UIElements.pomodoroEnableNotificationsCheckbox.checked = AppState.pomodoroNotifyEnabled;
    }
    if (typeof updatePomodoroPermissionStatusDisplay === 'function') {
      updatePomodoroPermissionStatusDisplay();
    }
  } finally {
    setTimeout(() => {
      AppState.isRequestingPermission = false;
      console.log('[Options Handlers] isRequestingPermission flag reset.');
    }, 300);
    isHandlingPomodoroNotificationToggle = false;
  }
}

console.log('[System] options-handlers.js loaded (v0.8.13 - Fix assign success msg, Add rule validation msgs)');
