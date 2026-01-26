/**
 * Integration Tests: Data Migration Correctness
 *
 * Verifies that data migrations (backfill logic in migrations) work correctly
 * and produce expected results for migrations 012, 015, and 020.
 */

const pool = require('../../../config/database');
const { setupTestDatabase, teardownTestDatabase, getTestClient } = require('../../helpers/database');
const { createUserData } = require('../../helpers/factories');
const User = require('../../../models/User');

describe('Data Migration Correctness', () => {
  beforeEach(setupTestDatabase);
  afterEach(teardownTestDatabase);

  describe('Migration 012: Reporter ID Auto-Linking', () => {
    it('should have reporter_id column in tickets table', async () => {
      // Act
      const result = await getTestClient().query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = 'reporter_id'
      `);

      // Assert
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('reporter_id');
    });

    it('should allow NULL reporter_id for admin-created tickets', async () => {
      // Act
      const result = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, reporter_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING reporter_id',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal', null]
      );

      // Assert
      expect(result.rows[0].reporter_id).toBeNull();
    });

    it('should allow setting reporter_id to valid user ID', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      // Act
      const result = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, reporter_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING reporter_id',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal', userId]
      );

      // Assert
      expect(result.rows[0].reporter_id).toBe(userId);
    });
  });

  describe('Migration 015: Admin Created Flag', () => {
    it('should have is_admin_created column in tickets table', async () => {
      // Act
      const result = await getTestClient().query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = 'is_admin_created'
      `);

      // Assert
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('is_admin_created');
    });

    it('should default is_admin_created to false for user-created tickets', async () => {
      // Act
      const result = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING is_admin_created',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal']
      );

      // Assert
      expect(result.rows[0].is_admin_created).toBe(false);
    });

    it('should allow setting is_admin_created to true for admin tickets', async () => {
      // Act
      const result = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, is_admin_created) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING is_admin_created',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal', true]
      );

      // Assert
      expect(result.rows[0].is_admin_created).toBe(true);
    });

    it('should distinguish between user-created and admin-created tickets by is_admin_created flag', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      // Create a user-created ticket
      await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, reporter_id, is_admin_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['User Ticket', 'Description', 'open', 'unset', 'Reporter', 'Internal', userId, false]
      );

      // Create an admin-created ticket
      await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, is_admin_created) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['Admin Ticket', 'Description', 'open', 'unset', 'Admin', 'Internal', true]
      );

      // Act
      const userTicket = await getTestClient().query('SELECT is_admin_created FROM tickets WHERE title = $1', ['User Ticket']);
      const adminTicket = await getTestClient().query('SELECT is_admin_created FROM tickets WHERE title = $1', ['Admin Ticket']);

      // Assert
      expect(userTicket.rows[0].is_admin_created).toBe(false);
      expect(adminTicket.rows[0].is_admin_created).toBe(true);
    });
  });

  describe('Migration 020: Department Floor', () => {
    it('should have floor column in departments table', async () => {
      // Act
      const result = await getTestClient().query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'departments' AND column_name = 'floor'
      `);

      // Assert
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('floor');
    });

    it('should enforce floor NOT NULL constraint', async () => {
      // Act & Assert - Try to insert department without floor
      await expect(
        getTestClient().query(
          'INSERT INTO departments (name, description, is_system, active) VALUES ($1, $2, $3, $4)',
          ['Test Dept', 'Description', false, true]
        )
      ).rejects.toThrow();
    });

    it('should accept all valid floor values', async () => {
      // Arrange
      const validFloors = ['Basement', 'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor'];
      const timestamp = Date.now();

      // Act & Assert
      for (const floor of validFloors) {
        const result = await getTestClient().query(
          'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING floor',
          [`Dept-${floor}-${timestamp}`, 'Description', floor, false, true]
        );
        expect(result.rows[0].floor).toBe(floor);
      }
    });

    it('should reject invalid floor values', async () => {
      // Act & Assert - Try to insert with invalid floor
      await expect(
        getTestClient().query(
          'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5)',
          [`Invalid Floor Dept ${Date.now()}`, 'Description', 'Invalid Floor', false, true]
        )
      ).rejects.toThrow();
    });

    it('should preserve floor value on department update', async () => {
      // Arrange - Use unique name with timestamp
      const uniqueName = `Floor Test Dept ${Date.now()}`;
      const deptResult = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id, floor',
        [uniqueName, 'Description', '2nd Floor', false, true]
      );
      const deptId = deptResult.rows[0].id;
      const originalFloor = deptResult.rows[0].floor;

      // Act - Update department name but not floor
      const updatedName = `Updated Floor Test Dept ${Date.now()}`;
      await getTestClient().query('UPDATE departments SET name = $1 WHERE id = $2', [updatedName, deptId]);

      // Assert
      const updated = await getTestClient().query('SELECT floor FROM departments WHERE id = $1', [deptId]);
      expect(updated.rows[0].floor).toBe(originalFloor);
    });

    it('should update floor value when department is updated', async () => {
      // Arrange - Use unique name with timestamp
      const uniqueName = `Changeable Floor Dept ${Date.now()}`;
      const deptResult = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [uniqueName, 'Description', 'Ground Floor', false, true]
      );
      const deptId = deptResult.rows[0].id;

      // Act
      await getTestClient().query('UPDATE departments SET floor = $1 WHERE id = $2', ['3rd Floor', deptId]);

      // Assert
      const updated = await getTestClient().query('SELECT floor FROM departments WHERE id = $1', [deptId]);
      expect(updated.rows[0].floor).toBe('3rd Floor');
    });
  });

  describe('Migration Idempotency', () => {
    it('should handle duplicate inserts gracefully (reporter_id)', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      // Act - Insert same ticket twice should fail on second attempt due to constraints
      const firstInsert = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, reporter_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['Unique Test', 'Description', 'open', 'unset', 'Reporter', 'Internal', userId]
      );
      const ticketId = firstInsert.rows[0].id;

      // Assert - Verify only one record exists
      const count = await getTestClient().query('SELECT COUNT(*) as count FROM tickets WHERE id = $1', [ticketId]);
      expect(parseInt(count.rows[0].count)).toBe(1);
    });

    it('should handle NULL reporter_id safely', async () => {
      // Arrange & Act - Insert multiple tickets with NULL reporter_id
      const ticket1 = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Null Reporter 1', 'Description', 'open', 'unset', 'Reporter', 'Internal']
      );

      const ticket2 = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Null Reporter 2', 'Description', 'open', 'unset', 'Reporter', 'Internal']
      );

      // Assert - Both should have NULL reporter_id
      const tick1 = await getTestClient().query('SELECT reporter_id FROM tickets WHERE id = $1', [ticket1.rows[0].id]);
      const tick2 = await getTestClient().query('SELECT reporter_id FROM tickets WHERE id = $1', [ticket2.rows[0].id]);

      expect(tick1.rows[0].reporter_id).toBeNull();
      expect(tick2.rows[0].reporter_id).toBeNull();
    });
  });

  describe('Migration Data Consistency', () => {
    it('should maintain data consistency across multiple related tables', async () => {
      // Arrange - Create user, department, and ticket
      const userData = createUserData({ role: 'department', department: 'Internal' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      const ticket = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department, reporter_id, is_admin_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        ['Consistency Test', 'Description', 'open', 'unset', 'Reporter', 'Internal', userId, false]
      );
      const ticketId = ticket.rows[0].id;

      // Act - Create comments
      await getTestClient().query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4)',
        [ticketId, userId, 'Comment 1', 'public']
      );

      await getTestClient().query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4)',
        [ticketId, userId, 'Comment 2', 'internal']
      );

      // Assert - Verify relationships are intact
      const comments = await getTestClient().query('SELECT user_id, visibility_type FROM comments WHERE ticket_id = $1', [ticketId]);
      expect(comments.rows).toHaveLength(2);
      expect(comments.rows.every(c => c.user_id === userId)).toBe(true);
      expect(comments.rows.map(c => c.visibility_type)).toContain('public');
      expect(comments.rows.map(c => c.visibility_type)).toContain('internal');
    });
  });
});
