/**
 * Error Reporting Service Unit Tests
 *
 * Tests the Error Reporting Service in isolation.
 * Since this is a singleton service using in-memory Map storage,
 * we clear the Map between tests for isolation.
 */

const errorReportingService = require('../../../services/errorReportingService');
const logger = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../utils/logger');

describe('Error Reporting Service', () => {
  beforeEach(() => {
    // Clear the in-memory reports Map before each test
    errorReportingService.reports.clear();
    jest.clearAllMocks();
  });

  describe('reportError', () => {
    it('should create error report with full context', async () => {
      // Arrange
      const correlationId = 'test-error-123';
      const category = 'JAVASCRIPT_ERROR';
      const userContext = {
        userId: 42,
        userAgent: 'Mozilla/5.0',
        url: '/tickets/123',
        ip: '192.168.1.1',
      };
      const userDescription = 'The form submission failed unexpectedly';
      const additionalData = { stackTrace: 'Error at line 123' };

      // Act
      const result = await errorReportingService.reportError(
        correlationId,
        category,
        userContext,
        userDescription,
        additionalData
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.reportId).toBe(correlationId);
      expect(result.message).toBe('Error report submitted successfully');

      const storedReport = errorReportingService.getReport(correlationId);
      expect(storedReport).toBeDefined();
      expect(storedReport.category).toBe(category);
      expect(storedReport.userContext.userId).toBe(42);
      expect(storedReport.userDescription).toBe(userDescription);
      expect(storedReport.additionalData).toEqual(additionalData);
      expect(storedReport.status).toBe('reported');
    });

    it('should create error report with minimal data (anonymous user)', async () => {
      // Arrange
      const correlationId = 'anon-error-456';
      const category = 'NETWORK_ERROR';

      // Act
      const result = await errorReportingService.reportError(correlationId, category);

      // Assert
      expect(result.success).toBe(true);

      const storedReport = errorReportingService.getReport(correlationId);
      expect(storedReport.userContext.userId).toBe('anonymous');
      expect(storedReport.userContext.userAgent).toBe('unknown');
      expect(storedReport.userContext.url).toBe('unknown');
      expect(storedReport.userContext.ip).toBe('unknown');
      expect(storedReport.userDescription).toBe('');
    });

    it('should trim user description whitespace', async () => {
      // Arrange
      const correlationId = 'trim-test-789';
      const category = 'UI_ERROR';
      const descriptionWithSpaces = '   Description with leading and trailing spaces   ';

      // Act
      await errorReportingService.reportError(correlationId, category, {}, descriptionWithSpaces);

      // Assert
      const storedReport = errorReportingService.getReport(correlationId);
      expect(storedReport.userDescription).toBe('Description with leading and trailing spaces');
    });

    it('should include timestamp in ISO format', async () => {
      // Arrange
      const correlationId = 'timestamp-test';
      const category = 'TEST_ERROR';

      // Act
      await errorReportingService.reportError(correlationId, category);

      // Assert
      const storedReport = errorReportingService.getReport(correlationId);
      expect(storedReport.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should log error report submission', async () => {
      // Arrange
      const correlationId = 'log-test';
      const category = 'TEST_ERROR';
      const userContext = { userId: 10 };
      const userDescription = 'Test description';

      // Act
      await errorReportingService.reportError(
        correlationId,
        category,
        userContext,
        userDescription
      );

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Error report submitted',
        expect.objectContaining({
          correlationId,
          category,
          userId: 10,
          hasDescription: true,
        })
      );
    });

    it('should return failure on internal error', async () => {
      // Arrange
      const correlationId = null; // Will cause error in Map.set
      const category = 'TEST_ERROR';

      // Mock Map.set to throw error
      const originalSet = errorReportingService.reports.set;
      errorReportingService.reports.set = jest.fn(() => {
        throw new Error('Map error');
      });

      // Act
      const result = await errorReportingService.reportError(correlationId, category);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to submit error report');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process error report',
        expect.objectContaining({
          correlationId,
          error: 'Map error',
        })
      );

      // Restore original method
      errorReportingService.reports.set = originalSet;
    });
  });

  describe('getReport', () => {
    it('should return error report when found', async () => {
      // Arrange
      const correlationId = 'existing-report';
      await errorReportingService.reportError(correlationId, 'TEST');

      // Act
      const result = errorReportingService.getReport(correlationId);

      // Assert
      expect(result).toBeDefined();
      expect(result.correlationId).toBe(correlationId);
      expect(result.category).toBe('TEST');
    });

    it('should return null when report not found', () => {
      // Act
      const result = errorReportingService.getReport('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should return complete report structure', async () => {
      // Arrange
      const correlationId = 'structure-test';
      await errorReportingService.reportError(correlationId, 'TEST', { userId: 5 }, 'Description');

      // Act
      const result = errorReportingService.getReport(correlationId);

      // Assert
      expect(result).toHaveProperty('correlationId');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('userContext');
      expect(result).toHaveProperty('userDescription');
      expect(result).toHaveProperty('additionalData');
      expect(result).toHaveProperty('status');
    });
  });

  describe('getAllReports', () => {
    it('should return empty array when no reports exist', () => {
      // Act
      const result = errorReportingService.getAllReports();

      // Assert
      expect(result).toEqual([]);
    });

    it('should return all stored reports as array', async () => {
      // Arrange
      await errorReportingService.reportError('error-1', 'CAT_A');
      await errorReportingService.reportError('error-2', 'CAT_B');
      await errorReportingService.reportError('error-3', 'CAT_C');

      // Act
      const result = errorReportingService.getAllReports();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.correlationId)).toEqual(
        expect.arrayContaining(['error-1', 'error-2', 'error-3'])
      );
    });

    it('should return array of complete report objects', async () => {
      // Arrange
      await errorReportingService.reportError('test-report', 'TEST', { userId: 1 }, 'Description');

      // Act
      const result = errorReportingService.getAllReports();

      // Assert
      expect(result[0]).toHaveProperty('correlationId');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('userContext');
      expect(result[0]).toHaveProperty('status');
    });
  });

  describe('getErrorStats', () => {
    it('should return empty stats when no reports exist', () => {
      // Act
      const stats = errorReportingService.getErrorStats();

      // Assert
      expect(stats).toEqual({
        total: 0,
        byCategory: {},
        byDate: {},
        unresolved: 0,
      });
    });

    it('should aggregate reports by category', async () => {
      // Arrange
      await errorReportingService.reportError('e1', 'JAVASCRIPT_ERROR');
      await errorReportingService.reportError('e2', 'JAVASCRIPT_ERROR');
      await errorReportingService.reportError('e3', 'NETWORK_ERROR');

      // Act
      const stats = errorReportingService.getErrorStats();

      // Assert
      expect(stats.total).toBe(3);
      expect(stats.byCategory['JAVASCRIPT_ERROR']).toBe(2);
      expect(stats.byCategory['NETWORK_ERROR']).toBe(1);
    });

    it('should aggregate reports by date', async () => {
      // Arrange
      await errorReportingService.reportError('e1', 'TEST');
      await errorReportingService.reportError('e2', 'TEST');

      // Act
      const stats = errorReportingService.getErrorStats();

      // Assert
      const today = new Date().toISOString().split('T')[0];
      expect(stats.byDate[today]).toBe(2);
    });

    it('should count unresolved reports', async () => {
      // Arrange
      await errorReportingService.reportError('e1', 'TEST');
      await errorReportingService.reportError('e2', 'TEST');
      await errorReportingService.reportError('e3', 'TEST');
      errorReportingService.resolveReport('e1', 'Fixed');

      // Act
      const stats = errorReportingService.getErrorStats();

      // Assert
      expect(stats.total).toBe(3);
      expect(stats.unresolved).toBe(2); // e2 and e3 are still unresolved
    });

    it('should handle resolved reports correctly in stats', async () => {
      // Arrange
      await errorReportingService.reportError('e1', 'CAT_A');
      await errorReportingService.reportError('e2', 'CAT_B');
      errorReportingService.resolveReport('e1', 'Resolved');

      // Act
      const stats = errorReportingService.getErrorStats();

      // Assert
      expect(stats.total).toBe(2);
      expect(stats.byCategory['CAT_A']).toBe(1);
      expect(stats.byCategory['CAT_B']).toBe(1);
      expect(stats.unresolved).toBe(1);
    });
  });

  describe('resolveReport', () => {
    it('should mark report as resolved successfully', async () => {
      // Arrange
      const correlationId = 'resolve-test';
      await errorReportingService.reportError(correlationId, 'TEST');

      // Act
      const result = errorReportingService.resolveReport(correlationId, 'Issue was fixed in v2.0');

      // Assert
      expect(result).toBe(true);

      const report = errorReportingService.getReport(correlationId);
      expect(report.status).toBe('resolved');
      expect(report.resolution).toBe('Issue was fixed in v2.0');
      expect(report.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should mark report as resolved with empty resolution', async () => {
      // Arrange
      const correlationId = 'no-resolution';
      await errorReportingService.reportError(correlationId, 'TEST');

      // Act
      const result = errorReportingService.resolveReport(correlationId);

      // Assert
      expect(result).toBe(true);

      const report = errorReportingService.getReport(correlationId);
      expect(report.status).toBe('resolved');
      expect(report.resolution).toBe('');
    });

    it('should return false when report not found', () => {
      // Act
      const result = errorReportingService.resolveReport('non-existent-id', 'Fix');

      // Assert
      expect(result).toBe(false);
    });

    it('should log resolution', async () => {
      // Arrange
      const correlationId = 'log-resolution';
      await errorReportingService.reportError(correlationId, 'TEST');
      jest.clearAllMocks(); // Clear reportError logs

      // Act
      errorReportingService.resolveReport(correlationId, 'Fixed the issue');

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Error report resolved',
        expect.objectContaining({
          correlationId,
          resolution: 'Fixed the issue',
        })
      );
    });

    it('should truncate long resolutions in log (first 100 chars)', async () => {
      // Arrange
      const correlationId = 'long-resolution';
      await errorReportingService.reportError(correlationId, 'TEST');
      const longResolution = 'a'.repeat(200);
      jest.clearAllMocks();

      // Act
      errorReportingService.resolveReport(correlationId, longResolution);

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        'Error report resolved',
        expect.objectContaining({
          resolution: 'a'.repeat(100),
        })
      );
    });
  });
});
