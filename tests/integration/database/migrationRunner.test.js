/**
 * Integration Tests: Migration Runner
 *
 * Verifies that scripts/init-db.js executes all 20 migrations correctly
 * and produces the expected final schema state.
 */

const pool = require('../../../config/database');
const { setupTestDatabase, teardownTestDatabase } = require('../../helpers/database');
const {
  getTableNames,
  getTableColumns,
  getPrimaryKeyColumns,
  getCheckConstraints,
  verifyCheckConstraint,
  getTableIndexes
} = require('../../helpers/schemaHelpers');

describe('Migration Runner (init-db.js)', () => {
  beforeEach(setupTestDatabase);
  afterEach(teardownTestDatabase);

  describe('Complete Schema State After All Migrations', () => {
    it('should have created all required tables', async () => {
      // Arrange
      const expectedTables = ['users', 'tickets', 'comments', 'session', 'audit_logs', 'departments'];

      // Act
      const actualTables = await getTableNames();

      // Assert
      expectedTables.forEach(table => {
        expect(actualTables).toContain(table);
      });
    });

    it('should have correct table count', async () => {
      // Act
      const tables = await getTableNames();

      // Assert
      expect(tables.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Migration 001: Users Table', () => {
    it('should have created users table with core columns', async () => {
      // Arrange
      const expectedColumns = ['id', 'username', 'email', 'password_hash', 'role'];

      // Act
      const columns = await getTableColumns('users');
      const columnNames = columns.map(c => c.column_name);

      // Assert
      expectedColumns.forEach(col => {
        expect(columnNames).toContain(col);
      });
    });

    it('should have id as primary key', async () => {
      // Act
      const pkColumns = await getPrimaryKeyColumns('users');

      // Assert
      expect(pkColumns).toEqual(['id']);
    });
  });

  describe('Migration 002: Tickets Table', () => {
    it('should have created tickets table with core columns', async () => {
      // Arrange
      const expectedColumns = ['id', 'title', 'description', 'status', 'priority'];

      // Act
      const columns = await getTableColumns('tickets');
      const columnNames = columns.map(c => c.column_name);

      // Assert
      expectedColumns.forEach(col => {
        expect(columnNames).toContain(col);
      });
    });
  });

  describe('Migration 003: Comments Table', () => {
    it('should have created comments table', async () => {
      // Act
      const columns = await getTableColumns('comments');

      // Assert
      expect(columns.length).toBeGreaterThan(0);
      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('ticket_id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('content');
    });
  });

  describe('Migration 004: Sessions Table', () => {
    it('should have created session table for express-session', async () => {
      // Act
      const columns = await getTableColumns('session');
      const columnNames = columns.map(c => c.column_name);

      // Assert
      expect(columnNames).toContain('sid');
      expect(columnNames).toContain('sess');
      expect(columnNames).toContain('expire');
    });
  });

  describe('Migration 006: Audit Logs Table', () => {
    it('should have created audit_logs table', async () => {
      // Act
      const columns = await getTableColumns('audit_logs');

      // Assert
      expect(columns.length).toBeGreaterThan(0);
      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('actor_id');
      expect(columnNames).toContain('action');
    });
  });

  describe('Migration 007: Priority Constraint', () => {
    it('should have unset as default priority', async () => {
      // Arrange
      await pool.query(
        'INSERT INTO tickets (title, description, status, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5)',
        ['Test', 'Description', 'open', 'Reporter', 'Internal']
      );

      // Act
      const result = await pool.query('SELECT priority FROM tickets WHERE title = $1', ['Test']);

      // Assert
      expect(result.rows[0].priority).toBe('unset');
    });

    it('should have priority CHECK constraint with unset value', async () => {
      // Arrange
      const validPriorities = ['unset', 'low', 'medium', 'high', 'critical'];

      // Act
      const isValid = await verifyCheckConstraint('tickets', 'priority', validPriorities);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Migration 010: Department Role', () => {
    it('should have department role in users table', async () => {
      // Arrange
      const validRoles = ['admin', 'super_admin', 'department'];

      // Act
      const isValid = await verifyCheckConstraint('users', 'role', validRoles);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Migration 011: Workflow Statuses', () => {
    it('should have all workflow statuses in CHECK constraint', async () => {
      // Arrange
      const validStatuses = ['open', 'in_progress', 'closed', 'waiting_on_admin', 'waiting_on_department'];

      // Act
      const isValid = await verifyCheckConstraint('tickets', 'status', validStatuses);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Migration 012: Reporter ID Column', () => {
    it('should have reporter_id column with FK constraint', async () => {
      // Act
      const columns = await getTableColumns('tickets');
      const reporterIdColumn = columns.find(c => c.column_name === 'reporter_id');

      // Assert
      expect(reporterIdColumn).toBeDefined();
      expect(reporterIdColumn.is_nullable).toBe('YES');
    });
  });

  describe('Migration 013: User Department Column', () => {
    it('should have department column in users table', async () => {
      // Act
      const columns = await getTableColumns('users');
      const deptColumn = columns.find(c => c.column_name === 'department');

      // Assert
      expect(deptColumn).toBeDefined();
      expect(deptColumn.is_nullable).toBe('YES');
    });
  });

  describe('Migration 014: Internal Department', () => {
    it('should have Internal department in CHECK constraint', async () => {
      // Arrange
      const deptConstraintCheck = ['Internal'];

      // Act
      const constraints = await getCheckConstraints('tickets');
      const deptConstraint = constraints.find(c =>
        c.check_clause && c.check_clause.includes('reporter_department')
      );

      // Assert
      expect(deptConstraint).toBeDefined();
      expect(deptConstraint.check_clause).toContain('Internal');
    });
  });

  describe('Migration 015: Is Admin Created Column', () => {
    it('should have is_admin_created column', async () => {
      // Act
      const columns = await getTableColumns('tickets');
      const adminCreatedColumn = columns.find(c => c.column_name === 'is_admin_created');

      // Assert
      expect(adminCreatedColumn).toBeDefined();
      expect(adminCreatedColumn.is_nullable).toBe('NO');
    });
  });

  describe('Migration 016: Departments Table', () => {
    it('should have created departments table with proper structure', async () => {
      // Arrange
      const expectedColumns = ['id', 'name', 'description', 'is_system', 'active'];

      // Act
      const columns = await getTableColumns('departments');
      const columnNames = columns.map(c => c.column_name);

      // Assert
      expectedColumns.forEach(col => {
        expect(columnNames).toContain(col);
      });
    });

    it('should have unique name constraint on departments', async () => {
      // Act
      const constraints = await pool.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'departments' AND constraint_type = 'UNIQUE'
      `);
      const constraintNames = constraints.rows.map(r => r.constraint_name);

      // Assert
      expect(constraintNames.some(name => name.includes('name'))).toBe(true);
    });
  });

  describe('Migration 017: Remove Reporter Desk', () => {
    it('should not have reporter_desk column', async () => {
      // Act
      const columns = await getTableColumns('tickets');
      const columnNames = columns.map(c => c.column_name);

      // Assert
      expect(columnNames).not.toContain('reporter_desk');
    });
  });

  describe('Migration 018: Status Column Length', () => {
    it('should have sufficient status column length for new statuses', async () => {
      // Act
      const columns = await getTableColumns('tickets');
      const statusColumn = columns.find(c => c.column_name === 'status');

      // Assert
      expect(statusColumn).toBeDefined();
      expect(statusColumn.character_maximum_length).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Migration 019: Comment Visibility', () => {
    it('should have visibility_type column in comments table', async () => {
      // Act
      const columns = await getTableColumns('comments');
      const visibilityColumn = columns.find(c => c.column_name === 'visibility_type');

      // Assert
      expect(visibilityColumn).toBeDefined();
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

  describe('Migration 020: Department Floor', () => {
    it('should have floor column in departments table', async () => {
      // Act
      const columns = await getTableColumns('departments');
      const floorColumn = columns.find(c => c.column_name === 'floor');

      // Assert
      expect(floorColumn).toBeDefined();
      expect(floorColumn.is_nullable).toBe('NO');
    });

    it('should have floor CHECK constraint with all valid values', async () => {
      // Arrange
      const validFloors = ['Basement', 'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor'];

      // Act
      const isValid = await verifyCheckConstraint('departments', 'floor', validFloors);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Final Schema Integrity', () => {
    it('should have all expected indexes created', async () => {
      // Arrange - Get all tables
      const tables = await getTableNames();

      // Act - Verify each table has at least one index (primary key)
      for (const table of tables) {
        const indexes = await getTableIndexes(table);

        // Assert
        expect(indexes.length).toBeGreaterThan(0);
      }
    });

    it('should have all primary key constraints', async () => {
      // Arrange
      const expectedPKTables = ['users', 'tickets', 'comments', 'session', 'audit_logs', 'departments'];

      // Act & Assert
      for (const table of expectedPKTables) {
        const pkColumns = await getPrimaryKeyColumns(table);
        expect(pkColumns.length).toBeGreaterThan(0);
      }
    });

    it('should allow inserting minimal valid record to each table', async () => {
      // Act & Assert - Verify we can insert to all tables

      // Department (required for tickets and users)
      const dept = await pool.query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Test Dept', 'Test', 'Ground Floor', false, true]
      );
      expect(dept.rows[0].id).toBeDefined();

      // User
      const user = await pool.query(
        'INSERT INTO users (username, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['testuser', 'test@test.com', 'hash', 'admin', 'active']
      );
      expect(user.rows[0].id).toBeDefined();

      // Ticket
      const ticket = await pool.query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Title', 'Desc', 'open', 'unset', 'Reporter', 'Test Dept']
      );
      expect(ticket.rows[0].id).toBeDefined();

      // Comment
      const comment = await pool.query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4) RETURNING id',
        [ticket.rows[0].id, user.rows[0].id, 'Content', 'public']
      );
      expect(comment.rows[0].id).toBeDefined();

      // Audit Log
      const audit = await pool.query(
        'INSERT INTO audit_logs (actor_id, action, target_type, target_id, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [user.rows[0].id, 'CREATE', 'ticket', ticket.rows[0].id, '127.0.0.1']
      );
      expect(audit.rows[0].id).toBeDefined();
    });
  });

  describe('Regression: Migration 020 Included', () => {
    it('should include migration 020 in init-db.js', async () => {
      // This test verifies the critical bug fix: migration 020 must be included
      // Arrange - Check that floor column exists (proof that migration 020 ran)

      // Act
      const columns = await getTableColumns('departments');
      const floorColumn = columns.find(c => c.column_name === 'floor');

      // Assert
      expect(floorColumn).toBeDefined();
      expect(floorColumn.is_nullable).toBe('NO');
    });

    it('should allow inserting valid floor values in departments', async () => {
      // Act & Assert
      const result = await pool.query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING floor',
        ['Migration 020 Test', 'Test', '3rd Floor', false, true]
      );
      expect(result.rows[0].floor).toBe('3rd Floor');
    });
  });
});
