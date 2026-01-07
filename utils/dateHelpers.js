/**
 * Date Helper Utilities
 * Provides functions for calculating and formatting ticket ages
 */

/**
 * Calculate ticket age bucket from timestamp with a semantic color tone.
 * Returns a translation unit + count rather than rendered text, so callers
 * can localize via i18n (see tickets:table.age* keys).
 * @param {Date|string} timestamp - Created timestamp
 * @returns {Object} { unit: 'new'|'days'|'weeks', count: number, color: 'success'|'info'|'warning'|'danger' }
 */
function calculateTicketAge(timestamp) {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) {
    return { unit: 'new', count: 0, color: 'success' };
  } else if (diffDays <= 3) {
    return { unit: 'days', count: diffDays, color: 'info' };
  } else if (diffDays <= 7) {
    return { unit: 'days', count: diffDays, color: 'warning' };
  }

  return { unit: 'weeks', count: Math.floor(diffDays / 7), color: 'danger' };
}

module.exports = { calculateTicketAge };
