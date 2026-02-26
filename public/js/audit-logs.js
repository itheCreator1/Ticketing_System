/**
 * Audit Logs Dashboard - Client-side interactions
 * - Expand/collapse detail rows
 * - Custom date range toggle
 * - Load more (keyset pagination)
 */

document.addEventListener('DOMContentLoaded', function () {
  // --- Expand/collapse detail rows ---
  document.querySelectorAll('[data-toggle-detail]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = this.getAttribute('data-toggle-detail');
      var detailRow = document.getElementById(targetId);
      var chevron = this.querySelector('.bi');

      if (detailRow) {
        var isHidden = detailRow.classList.contains('hidden');
        detailRow.classList.toggle('hidden');

        if (chevron) {
          chevron.classList.toggle('bi-chevron-right', !isHidden);
          chevron.classList.toggle('bi-chevron-down', isHidden);
        }
      }
    });
  });

  // --- Custom date range toggle ---
  var dateRangeSelect = document.getElementById('dateRange');
  var customDateFields = document.getElementById('customDateFields');

  if (dateRangeSelect && customDateFields) {
    function toggleCustomDates() {
      if (dateRangeSelect.value === 'custom') {
        customDateFields.classList.remove('hidden');
      } else {
        customDateFields.classList.add('hidden');
      }
    }

    dateRangeSelect.addEventListener('change', toggleCustomDates);
    // Set initial state
    toggleCustomDates();
  }

  // --- Load more button ---
  var loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      var url = this.getAttribute('data-url');
      if (url) {
        window.location.href = '/admin/audit-logs' + url;
      }
    });
  }
});
