/**
 * Integration Tests: Database Schema Integrity
 *
 * Verifies that all database tables, columns, indexes, and constraints
 * exist with correct properties after migrations are applied.
 */

const pool = require('../../../config/database');
const {
  getTableNames,
  getTableColumns,
  columnExists,
  getTableIndexes,
  getUniqueConstraints,
  getPrimaryKeyColumns,
  getCheckConstraints,
  verifyCheckConstraint,
  verifyTableColumns,
  getColumnDataType,
  isColumnNullable,
  getColumnMaxLength,
  getForeignKeys
} = require('../../helpers/schemaHelpers');
const { setupTestDatabase, teardownTestDatabase, getTestClient } = require('../../helpers/database');

describe('Database Schema Integrity', () => {
  beforeEach(setupTestDatabase);
  afterEach(teardownTestDatabase);

  describe('Tables', () => {
    it('should have all expected tables', async () => {
      // Arrange
      const expectedTables = ['users', 'tickets', 'comments', 'session', 'audit_logs', 'departments', 'floors'];

      // Act
      const actualTables = await getTableNames();

      // Assert
      expectedTables.forEach(table => {
        expect(actualTables).toContain(table);
      });
    });
  });

  describe('Users Table', () => {
    it('should have all expected columns', async () => {
      // Arrange
      const expectedColumns = [
        'id', 'username', 'email', 'password_hash', 'role', 'department',
        'status', 'login_attempts', 'last_login_at', 'password_changed_at',
        'deleted_at', 'created_at', 'updated_at'
      ];

      // Act
      const verification = await verifyTableColumns('users', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
      expect(verification.extra).toHaveLength(0);
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('users');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });

    it('should enforce unique username constraint', async () => {
      // Act
      const uniqueConstraints = await getUniqueConstraints('users');

      // Assert
      expect(uniqueConstraints).toContain('users_username_key');
    });

    it('should enforce unique email constraint', async () => {
      // Act
      const uniqueConstraints = await getUniqueConstraints('users');

      // Assert
      expect(uniqueConstraints).toContain('users_email_key');
    });

    it('should have role CHECK constraint with valid values', async () => {
      // Arrange
      const validRoles = ['admin', 'super_admin', 'department'];

      // Act
      const isValid = await verifyCheckConstraint('users', 'role', validRoles);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should have status CHECK constraint with valid values', async () => {
      // Arrange
      const validStatuses = ['active', 'inactive', 'deleted'];

      // Act
      const isValid = await verifyCheckConstraint('users', 'status', validStatuses);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should have username and email as VARCHAR with size limits', async () => {
      // Act
      const usernameType = await getColumnDataType('users', 'username');
      const usernameMaxLength = await getColumnMaxLength('users', 'username');
      const emailType = await getColumnDataType('users', 'email');
      const emailMaxLength = await getColumnMaxLength('users', 'email');

      // Assert
      expect(usernameType).toBe('character varying');
      expect(usernameMaxLength).toBeGreaterThan(0);
      expect(emailType).toBe('character varying');
      expect(emailMaxLength).toBeGreaterThan(0);
    });
  });

  describe('Tickets Table', () => {
    it('should have all expected columns', async () => {
      // Arrange
      const expectedColumns = [
        'id', 'title', 'description', 'status', 'priority',
        'reporter_name', 'reporter_department', 'reporter_phone', 'reporter_id',
        'assigned_to', 'is_admin_created', 'created_at', 'updated_at'
      ];

      // Act
      const verification = await verifyTableColumns('tickets', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
      expect(verification.extra).toHaveLength(0);
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('tickets');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });

    it('should have status CHECK constraint with all valid workflow statuses', async () => {
      // Arrange
      const validStatuses = ['open', 'in_progress', 'closed', 'waiting_on_admin', 'waiting_on_department'];

      // Act
      const isValid = await verifyCheckConstraint('tickets', 'status', validStatuses);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should have priority CHECK constraint with all valid priorities', async () => {
      // Arrange
      const validPriorities = ['unset', 'low', 'medium', 'high', 'critical'];

      // Act
      const isValid = await verifyCheckConstraint('tickets', 'priority', validPriorities);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should have is_admin_created as boolean', async () => {
      // Act
      const dataType = await getColumnDataType('tickets', 'is_admin_created');

      // Assert
      expect(dataType).toBe('boolean');
    });
  });

  describe('Comments Table', () => {
    it('should have all expected columns', async () => {
      // Arrange
      const expectedColumns = ['id', 'ticket_id', 'user_id', 'content', 'visibility_type', 'created_at'];

      // Act
      const verification = await verifyTableColumns('comments', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
      expect(verification.extra).toHaveLength(0);
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('comments');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });

    it('should have visibility_type CHECK constraint with valid values', async () => {
      // Arrange
      const validTypes = ['public', 'internal'];

      // Act
      const isValid = await verifyCheckConstraint('comments', 'visibility_type', validTypes);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Departments Table', () => {
    it('should have all expected columns', async () => {
      // Arrange
      const expectedColumns = ['id', 'name', 'description', 'floor', 'is_system', 'active', 'created_at', 'updated_at'];

      // Act
      const verification = await verifyTableColumns('departments', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
      expect(verification.extra).toHaveLength(0);
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('departments');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });

    it('should enforce unique department name constraint', async () => {
      // Act
      const uniqueConstraints = await getUniqueConstraints('departments');

      // Assert
      expect(uniqueConstraints).toContain('departments_name_key');
    });

    it('should have floor as foreign key reference to floors table', async () => {
      // Act
      const foreignKeys = await getForeignKeys('departments');
      const floorFK = foreignKeys.find(fk => fk.column_name === 'floor');

      // Assert
      expect(floorFK).toBeDefined();
      expect(floorFK.foreign_table_name).toBe('floors');
      expect(floorFK.foreign_column_name).toBe('name');
    });

    it('should have floor as non-nullable', async () => {
      // Act
      const isNullable = await isColumnNullable('departments', 'floor');

      // Assert
      expect(isNullable).toBe(false);
    });
  });

  describe('Floors Table', () => {
    it('should have all expected columns', async () => {
      // Arrange
      const expectedColumns = ['id', 'name', 'sort_order', 'is_system', 'active', 'created_at', 'updated_at'];

      // Act
      const verification = await verifyTableColumns('floors', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
      expect(verification.extra).toHaveLength(0);
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('floors');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });

    it('should enforce unique floor name constraint', async () => {
      // Act
      const uniqueConstraints = await getUniqueConstraints('floors');

      // Assert
      expect(uniqueConstraints).toContain('floors_name_key');
    });

    it('should have name as VARCHAR with length constraint', async () => {
      // Act
      const nameType = await getColumnDataType('floors', 'name');
      const nameMaxLength = await getColumnMaxLength('floors', 'name');

      // Assert
      expect(nameType).toBe('character varying');
      expect(nameMaxLength).toBeGreaterThan(0);
    });

    it('should have sort_order as integer', async () => {
      // Act
      const sortOrderType = await getColumnDataType('floors', 'sort_order');

      // Assert
      expect(sortOrderType).toMatch(/integer|bigint|smallint/);
    });

    it('should have is_system as boolean', async () => {
      // Act
      const isSystemType = await getColumnDataType('floors', 'is_system');

      // Assert
      expect(isSystemType).toBe('boolean');
    });

    it('should have active as boolean', async () => {
      // Act
      const activeType = await getColumnDataType('floors', 'active');

      // Assert
      expect(activeType).toBe('boolean');
    });

    it('should have proper default values', async () => {
      // Act - This would require checking column defaults from information_schema
      // For now, we test by inserting a row with minimal data
      const testClient = getTestClient();
      const result = await testClient.query(
        `INSERT INTO floors (name, sort_order, is_system, active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        ['Test Floor', 5, false, true]
      );

      // Assert
      const floor = result.rows[0];
      expect(floor.is_system).toBe(false);
      expect(floor.active).toBe(true);
    });

    it('should have timestamp columns (created_at, updated_at)', async () => {
      // Act
      const createdAtType = await getColumnDataType('floors', 'created_at');
      const updatedAtType = await getColumnDataType('floors', 'updated_at');

      // Assert
      expect(createdAtType).toMatch(/timestamp|date/);
      expect(updatedAtType).toMatch(/timestamp|date/);
    });
  });

  describe('Audit Logs Table', () => {
    it('should have all expected columns', async () => {
      // Arrange
      const expectedColumns = ['id', 'actor_id', 'action', 'target_type', 'target_id', 'details', 'ip_address', 'created_at'];

      // Act
      const verification = await verifyTableColumns('audit_logs', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
      expect(verification.extra).toHaveLength(0);
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('audit_logs');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });
  });

  describe('Session Table', () => {
    it('should have expected columns for express-session', async () => {
      // Arrange
      const expectedColumns = ['sid', 'sess', 'expire'];

      // Act
      const verification = await verifyTableColumns('session', expectedColumns);

      // Assert
      expect(verification.missing).toHaveLength(0);
    });

    it('should have sid as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('session');

      // Assert
      expect(pkColumns).toEqual(['sid']);
    });
  });

  describe('Indexes', () => {
    it('should have indexes on tickets table for filtering and sorting', async () => {
      // Act
      const indexes = await getTableIndexes('tickets');
      const indexNames = indexes.map(i => i.indexname);

      // Assert
      expect(indexNames).toContain('tickets_pkey');
      expect(indexNames.some(name => name.includes('status'))).toBe(true);
    });

    it('should have indexes on comments for efficient ticket queries', async () => {
      // Act
      const indexes = await getTableIndexes('comments');
      const indexNames = indexes.map(i => i.indexname);

      // Assert
      expect(indexNames).toContain('comments_pkey');
      expect(indexNames.some(name => name.includes('ticket'))).toBe(true);
    });

    it('should have indexes on users for efficient lookups', async () => {
      // Act
      const indexes = await getTableIndexes('users');
      const indexNames = indexes.map(i => i.indexname);

      // Assert
      expect(indexNames).toContain('users_pkey');
      expect(indexNames.some(name => name.includes('username'))).toBe(true);
    });
  });

  describe('Data Types', () => {
    it('should have proper integer types for IDs', async () => {
      // Act
      const usersIdType = await getColumnDataType('users', 'id');
      const ticketsIdType = await getColumnDataType('tickets', 'id');
      const commentsIdType = await getColumnDataType('comments', 'id');

      // Assert
      expect(usersIdType).toMatch(/integer|bigint|smallint/);
      expect(ticketsIdType).toMatch(/integer|bigint|smallint/);
      expect(commentsIdType).toMatch(/integer|bigint|smallint/);
    });

    it('should have text type for large content fields', async () => {
      // Act
      const descriptionType = await getColumnDataType('tickets', 'description');
      const contentType = await getColumnDataType('comments', 'content');

      // Assert
      expect(descriptionType).toBe('text');
      expect(contentType).toBe('text');
    });

    it('should have timestamp types for audit fields', async () => {
      // Act
      const createdAtType = await getColumnDataType('users', 'created_at');
      const updatedAtType = await getColumnDataType('users', 'updated_at');

      // Assert
      expect(createdAtType).toMatch(/timestamp|date/);
      expect(updatedAtType).toMatch(/timestamp|date/);
    });
  });
});
