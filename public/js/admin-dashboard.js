/**
 * Admin dashboard interactivity: bulk ticket selection/update and quick-assign.
 * Uses event listeners instead of inline onclick/onchange (blocked by CSP).
 * Confirmation/validation copy is read from data-* attributes so it stays
 * translated via the EJS template rather than being hardcoded here.
 */
document.addEventListener('DOMContentLoaded', function () {
  var selectAll = document.getElementById('selectAll');
  var checkboxes = document.querySelectorAll('.ticket-checkbox');
  var bulkBtn = document.getElementById('bulkUpdateBtn');
  var selectedCount = document.getElementById('selectedCount');
  var bulkForm = document.getElementById('bulkUpdateForm');

  function updateBulkButton() {
    if (!bulkBtn || !selectedCount) return;
    var checked = document.querySelectorAll('.ticket-checkbox:checked');
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
      var checked = document.querySelectorAll('.ticket-checkbox:checked');
      if (checked.length === 0) {
        e.preventDefault();
        window.alert(bulkForm.dataset.selectAtLeastOneTicket);
        return;
      }

      var status = bulkForm.querySelector('select[name="status"]').value;
      var priority = bulkForm.querySelector('select[name="priority"]').value;
      var assignedTo = bulkForm.querySelector('select[name="assigned_to"]').value;

      if (!status && !priority && assignedTo === '') {
        e.preventDefault();
        window.alert(bulkForm.dataset.selectAtLeastOneField);
        return;
      }

      var confirmMessage = (bulkForm.dataset.confirmUpdateTemplate || '').replace(
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
