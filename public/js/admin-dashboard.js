/**
 * Admin dashboard interactivity: bulk ticket selection/update and quick-assign.
 * Uses event listeners instead of inline onclick/onchange (blocked by CSP).
 * Confirmation/validation copy is read from data-* attributes so it stays
 * translated via the EJS template rather than being hardcoded here.
 */
document.addEventListener('DOMContentLoaded', function () {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.ticket-checkbox');
  const bulkBtn = document.getElementById('bulkUpdateBtn');
  const selectedCount = document.getElementById('selectedCount');
  const bulkForm = document.getElementById('bulkUpdateForm');

  function updateBulkButton() {
    if (!bulkBtn || !selectedCount) {
      return;
    }
    const checked = document.querySelectorAll('.ticket-checkbox:checked');
    selectedCount.textContent = checked.length;
    bulkBtn.disabled = checked.length === 0;
  }

  if (selectAll) {
    selectAll.addEventListener('change', function () {
      checkboxes.forEach(function (cb) {
        cb.checked = selectAll.checked;
      });
      updateBulkButton();
    });
  }

  checkboxes.forEach(function (cb) {
    cb.addEventListener('change', updateBulkButton);
  });

  if (bulkForm) {
    bulkForm.addEventListener('submit', function (e) {
      const checked = document.querySelectorAll('.ticket-checkbox:checked');
      if (checked.length === 0) {
        e.preventDefault();
        window.alert(bulkForm.dataset.selectAtLeastOneTicket);
        return;
      }

      const status = bulkForm.querySelector('select[name="status"]').value;
      const priority = bulkForm.querySelector('select[name="priority"]').value;
      const assignedTo = bulkForm.querySelector('select[name="assigned_to"]').value;

      if (!status && !priority && assignedTo === '') {
        e.preventDefault();
        window.alert(bulkForm.dataset.selectAtLeastOneField);
        return;
      }

      const confirmMessage = (bulkForm.dataset.confirmUpdateTemplate || '').replace(
        '__COUNT__',
        checked.length
      );
      if (!window.confirm(confirmMessage)) {
        e.preventDefault();
      }
    });
  }

  document.querySelectorAll('.quick-assign-select').forEach(function (select) {
    select.addEventListener('change', function () {
      select.closest('form').submit();
    });
  });
});
