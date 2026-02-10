const logger = require('../utils/logger');

class ErrorReportingService {
  constructor(maxSize = 500) {
    this.reports = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Evict the oldest entry when the map is at capacity.
   * Map preserves insertion order, so the first key is the oldest.
   */
  _evictOldest() {
    if (this.reports.size >= this.maxSize) {
      const oldestKey = this.reports.keys().next().value;
      this.reports.delete(oldestKey);
      logger.debug('Error report evicted due to size limit', { evictedId: oldestKey });
    }
  }

  /**
   * Report an error with user context
   * @param {string} correlationId - Unique error identifier
   * @param {string} category - Error category
   * @param {Object} userContext - User information and context
   * @param {string} userDescription - User's description of what happened
   * @param {Object} additionalData - Any additional debugging data
   */
  async reportError(
    correlationId,
    category,
    userContext = {},
    userDescription = '',
    additionalData = {}
  ) {
    try {
      const report = {
        correlationId,
        category,
        timestamp: new Date().toISOString(),
        userContext: {
          userId: userContext.userId || 'anonymous',
          userAgent: userContext.userAgent || 'unknown',
          url: userContext.url || 'unknown',
          ip: userContext.ip || 'unknown',
        },
        userDescription: userDescription.trim(),
        additionalData,
        status: 'reported',
      };

      // Evict oldest entry if at capacity
      this._evictOldest();
      this.reports.set(correlationId, report);

      // Log the error report
      logger.info('Error report submitted', {
        correlationId,
        category,
        userId: report.userContext.userId,
        hasDescription: !!userDescription,
      });

      // In production, you might want to:
      // - Send email notifications to developers
      // - Create tickets in issue tracking systems
      // - Send to error monitoring services (Sentry, etc.)
      // - Aggregate error reports for analysis

      return {
        success: true,
        reportId: correlationId,
        message: 'Error report submitted successfully',
      };
    } catch (error) {
      logger.error('Failed to process error report', {
        correlationId,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        message: 'Failed to submit error report',
      };
    }
  }

  /**
   * Get error report by correlation ID
   * @param {string} correlationId
   */
  getReport(correlationId) {
    return this.reports.get(correlationId) || null;
  }

  /**
   * Get all error reports (for admin purposes)
   */
  getAllReports() {
    return Array.from(this.reports.values());
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const reports = Array.from(this.reports.values());
    const stats = {
      total: reports.length,
      byCategory: {},
      byDate: {},
      unresolved: 0,
    };

    reports.forEach((report) => {
      // Count by category
      stats.byCategory[report.category] = (stats.byCategory[report.category] || 0) + 1;

      // Count by date
      const date = report.timestamp.split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;

      // Count unresolved
      if (report.status !== 'resolved') {
        stats.unresolved++;
      }
    });

    return stats;
  }

  /**
   * Mark an error report as resolved
   * @param {string} correlationId
   * @param {string} resolution - Description of how it was resolved
   */
  resolveReport(correlationId, resolution = '') {
    const report = this.reports.get(correlationId);
    if (report) {
      report.status = 'resolved';
      report.resolution = resolution;
      report.resolvedAt = new Date().toISOString();

      logger.info('Error report resolved', {
        correlationId,
        resolution: resolution.substring(0, 100), // Truncate for logging
      });

      return true;
    }
    return false;
  }
}

module.exports = new ErrorReportingService();
module.exports.ErrorReportingService = ErrorReportingService;
