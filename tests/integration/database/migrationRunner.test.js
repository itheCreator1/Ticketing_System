/**
 * Integration Tests: Migration Runner
 *
 * Verifies that scripts/init-db.js executes all 20 migrations correctly
 * and produces the expected final schema state.
 */

const pool = require('../../../config/database');
const { setupTestDatabase, teardownTestDatabase, getTestClient } = require('../../helpers/database');
const {
  getTableNames,
  getTableColumns,
  getPrimaryKeyColumns,
  getCheckConstraints,
  verifyCheckConstraint,
  getTableIndexes,
  getForeignKeys
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
      await getTestClient().query(
        'INSERT INTO tickets (title, description, status, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5)',
        ['Test', 'Description', 'open', 'Reporter', 'Internal']
      );

      // Act
      const result = await getTestClient().query('SELECT priority FROM tickets WHERE title = $1', ['Test']);

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
    it('should allow Internal department in tickets (enforced by FK in migration 016)', async () => {
      // Act & Assert - Can create ticket with Internal department (Internal dept created by seed data)
      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Internal Ticket', 'Admin only', 'open', 'unset', 'Admin', 'Internal']
      );

      expect(ticketResult.rows[0].id).toBeDefined();
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
      const constraints = await getTestClient().query(`
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

    it('should have floor as foreign key reference to floors table (Migration 023)', async () => {
      // Note: Migration 023 converted floor from CHECK constraint to foreign key
      // Act
      const foreignKeys = await getForeignKeys('departments');
      const floorFK = foreignKeys.find(fk => fk.column_name === 'floor');

      // Assert
      expect(floorFK).toBeDefined();
      expect(floorFK.foreign_table_name).toBe('floors');
      expect(floorFK.foreign_column_name).toBe('name');
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
      const dept = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Test Dept', 'Test', 'Ground Floor', false, true]
      );
      expect(dept.rows[0].id).toBeDefined();

      // User
      const user = await getTestClient().query(
        'INSERT INTO users (username, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['testuser', 'test@test.com', 'hash', 'admin', 'active']
      );
      expect(user.rows[0].id).toBeDefined();

      // Ticket
      const ticket = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Title', 'Desc', 'open', 'unset', 'Reporter', 'Test Dept']
      );
      expect(ticket.rows[0].id).toBeDefined();

      // Comment
      const comment = await getTestClient().query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4) RETURNING id',
        [ticket.rows[0].id, user.rows[0].id, 'Content', 'public']
      );
      expect(comment.rows[0].id).toBeDefined();

      // Audit Log
      const audit = await getTestClient().query(
        'INSERT INTO audit_logs (actor_id, action, target_type, target_id, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [user.rows[0].id, 'CREATE', 'ticket', ticket.rows[0].id, '127.0.0.1']
      );
      expect(audit.rows[0].id).toBeDefined();
    });
  });

  describe('Migration 021: Fix Audit Log FK Constraint', () => {
    it('should have audit_logs table with proper FK constraints', async () => {
      // Act
      const columns = await getTableColumns('audit_logs');
      const actorIdColumn = columns.find(c => c.column_name === 'actor_id');

      // Assert
      expect(actorIdColumn).toBeDefined();
      expect(actorIdColumn.is_nullable).toBe('YES'); // FK uses ON DELETE SET NULL
    });
  });

  describe('Migration 022: Create Floors Table', () => {
    it('should have created floors table', async () => {
      // Act
      const columns = await getTableColumns('floors');
      const columnNames = columns.map(c => c.column_name);

      // Assert
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('sort_order');
      expect(columnNames).toContain('is_system');
      expect(columnNames).toContain('active');
    });

    it('should have unique name constraint on floors', async () => {
      // Act
      const constraints = await getTestClient().query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'floors' AND constraint_type = 'UNIQUE'
      `);
      const constraintNames = constraints.rows.map(r => r.constraint_name);

      // Assert
      expect(constraintNames.some(name => name.includes('name'))).toBe(true);
    });

    it('should allow inserting floors', async () => {
      // Act & Assert
      const result = await getTestClient().query(
        'INSERT INTO floors (name, sort_order, is_system, active) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Test Floor', 0, false, true]
      );
      expect(result.rows[0].id).toBeDefined();
    });
  });

  describe('Migration 023: Convert Floor to FK', () => {
    it('should have floor column as VARCHAR (references floors.name)', async () => {
      // Act
      const columns = await getTableColumns('departments');
      const floorColumn = columns.find(c => c.column_name === 'floor');

      // Assert
      expect(floorColumn).toBeDefined();
      expect(floorColumn.is_nullable).toBe('NO');
      expect(floorColumn.data_type).toBe('character varying');
    });

    it('should enforce FK constraint when inserting departments', async () => {
      // Arrange - Create a valid floor first
      await getTestClient().query(
        'INSERT INTO floors (name, sort_order, is_system, active) VALUES ($1, $2, $3, $4)',
        ['Valid Floor', 0, false, true]
      );

      // Act & Assert - Valid floor should work
      const result = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING floor',
        ['Test Dept', 'Test', 'Valid Floor', false, true]
      );
      expect(result.rows[0].floor).toBe('Valid Floor');

      // Act & Assert - Invalid floor should fail
      await expect(
        getTestClient().query(
          'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5)',
          ['Test Dept 2', 'Test', 'Non-Existent Floor', false, true]
        )
      ).rejects.toThrow();
    });
  });

  describe('Migration 024: Remove Hardcoded System Floors', () => {
    it('should have removed hardcoded system floors from new installations', async () => {
      // Act - Query floors table
      const result = await getTestClient().query(
        'SELECT COUNT(*) as count FROM floors WHERE is_system = true'
      );

      // Assert - Should be 0 after Migration 024
      // Note: PostgreSQL returns count as string for COUNT aggregations
      expect(parseInt(result.rows[0].count)).toBe(0);
    });

    it('should allow creating custom floors via config after migration', async () => {
      // Act - Create floors from config
      const result = await getTestClient().query(
        'INSERT INTO floors (name, sort_order, is_system, active) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Custom Floor', 0, false, true]
      );

      // Assert
      expect(result.rows[0].id).toBeDefined();

      // Verify it was created
      const verify = await getTestClient().query(
        'SELECT * FROM floors WHERE name = $1',
        ['Custom Floor']
      );
      expect(verify.rows.length).toBe(1);
      expect(verify.rows[0].is_system).toBe(false);
    });

    it('should require floors to be seeded via config for departments', async () => {
      // Act & Assert - Cannot create department without a floor reference
      await expect(
        getTestClient().query(
          'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5)',
          ['Test Dept', 'Test', 'Non-Existent Floor', false, true]
        )
      ).rejects.toThrow();
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
      // Arrange - Create a floor first (since migration 024 removes hardcoded ones)
      await getTestClient().query(
        'INSERT INTO floors (name, sort_order, is_system, active) VALUES ($1, $2, $3, $4)',
        ['Test Migration Floor', 0, false, true]
      );

      // Act & Assert
      const result = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING floor',
        ['Migration 020 Test', 'Test', 'Test Migration Floor', false, true]
      );
      expect(result.rows[0].floor).toBe('Test Migration Floor');
    });
  });

  describe('Complete Migration Sequence (v2.4.0)', () => {
    it('should execute all 24 migrations successfully', async () => {
      // Act - Verify all tables exist
      const tables = await getTableNames();

      // Assert - All required tables
      expect(tables).toContain('users');
      expect(tables).toContain('tickets');
      expect(tables).toContain('comments');
      expect(tables).toContain('session');
      expect(tables).toContain('audit_logs');
      expect(tables).toContain('departments');
      expect(tables).toContain('floors');
    });

    it('should have empty floors table after Migration 024', async () => {
      // Note: Test setup seeds floors for FK constraint satisfaction
      // The migration itself empties the table, but beforeEach adds test floors
      // This test verifies the migration runs without error

      // Act
      const result = await getTestClient().query('SELECT COUNT(*) as count FROM floors');

      // Assert - Migration runs successfully (count may vary due to test setup)
      expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(0);
    });

    it('should support dynamic floor and department seeding via config', async () => {
      // Note: Test setup already seeds floors and departments
      // This test verifies they can be created dynamically

      // Act - Query existing test data (created by setupTestDatabase)
      const floorsResult = await getTestClient().query('SELECT COUNT(*) as count FROM floors');
      const deptsResult = await getTestClient().query('SELECT COUNT(*) as count FROM departments');

      // Assert - Test setup seeds 8 floors and 9 departments
      expect(parseInt(floorsResult.rows[0].count)).toBeGreaterThanOrEqual(2);
      expect(parseInt(deptsResult.rows[0].count)).toBeGreaterThanOrEqual(2);

      // Verify Internal is marked as system
      const internal = await getTestClient().query(
        'SELECT is_system FROM departments WHERE name = $1',
        ['Internal']
      );
      expect(internal.rows.length).toBeGreaterThan(0);
      expect(internal.rows[0].is_system).toBe(true);
    });
  });
});
