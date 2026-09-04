/**
 * Mobile navigation toggle functionality
 * Uses event listener instead of inline onclick (blocked by CSP).
 */
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('navToggleBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (btn && mobileNav) {
    btn.addEventListener('click', function () {
      mobileNav.classList.toggle('hidden');
    });
  }
});
