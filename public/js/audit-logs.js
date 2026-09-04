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
      const targetId = this.getAttribute('data-toggle-detail');
      const detailRow = document.getElementById(targetId);
      const chevron = this.querySelector('.bi');

      if (detailRow) {
        const isHidden = detailRow.classList.contains('hidden');
        detailRow.classList.toggle('hidden');

        if (chevron) {
          chevron.classList.toggle('bi-chevron-right', !isHidden);
          chevron.classList.toggle('bi-chevron-down', isHidden);
        }
      }
    });
  });

  // --- Custom date range toggle ---
  const dateRangeSelect = document.getElementById('dateRange');
  const customDateFields = document.getElementById('customDateFields');

  if (dateRangeSelect && customDateFields) {
    const toggleCustomDates = function () {
      if (dateRangeSelect.value === 'custom') {
        customDateFields.classList.remove('hidden');
      } else {
        customDateFields.classList.add('hidden');
      }
    };

    dateRangeSelect.addEventListener('change', toggleCustomDates);
    // Set initial state
    toggleCustomDates();
  }

  // --- Load more button ---
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      const url = this.getAttribute('data-url');
      if (url) {
        window.location.href = '/admin/audit-logs' + url;
      }
    });
  }
});
