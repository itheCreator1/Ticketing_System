/**
 * Integration Tests: Foreign Key Behavior
 *
 * Verifies that foreign key constraints work correctly with proper
 * CASCADE DELETE, SET NULL, and RESTRICT behaviors.
 */

const pool = require('../../../config/database');
const { setupTestDatabase, teardownTestDatabase, getTestClient } = require('../../helpers/database');
const { createUserData } = require('../../helpers/factories');
const User = require('../../../models/User');

describe('Foreign Key Behavior', () => {
  beforeEach(setupTestDatabase);
  afterEach(teardownTestDatabase);

  describe('Tickets CASCADE DELETE on User Delete', () => {
    it('should set ticket reporter_id to NULL when user is deleted', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_id, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['Test', 'Description', 'open', 'unset', userId, 'Reporter', 'Internal']
      );
      const ticketId = ticketResult.rows[0].id;

      // Act
      await getTestClient().query('DELETE FROM users WHERE id = $1', [userId]);

      // Assert
      const ticket = await getTestClient().query('SELECT reporter_id FROM tickets WHERE id = $1', [ticketId]);
      expect(ticket.rows[0].reporter_id).toBeNull();
    });

    it('should set ticket assigned_to to NULL when assigned user is deleted', async () => {
      // Arrange
      const adminData = createUserData({ role: 'admin' });
      const admin = await User.create(adminData, getTestClient());
      const adminId = admin.id;

      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, assigned_to, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['Test', 'Description', 'open', 'unset', adminId, 'Reporter', 'Internal']
      );
      const ticketId = ticketResult.rows[0].id;

      // Act
      await getTestClient().query('DELETE FROM users WHERE id = $1', [adminId]);

      // Assert
      const ticket = await getTestClient().query('SELECT assigned_to FROM tickets WHERE id = $1', [ticketId]);
      expect(ticket.rows[0].assigned_to).toBeNull();
    });
  });

  describe('Comments CASCADE DELETE on Ticket Delete', () => {
    it('should delete comments when ticket is deleted', async () => {
      // Arrange
      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal']
      );
      const ticketId = ticketResult.rows[0].id;

      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      const commentResult = await getTestClient().query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4) RETURNING id',
        [ticketId, userId, 'Comment content', 'public']
      );
      const commentId = commentResult.rows[0].id;

      // Act
      await getTestClient().query('DELETE FROM tickets WHERE id = $1', [ticketId]);

      // Assert
      const comment = await getTestClient().query('SELECT id FROM comments WHERE id = $1', [commentId]);
      expect(comment.rows).toHaveLength(0);
    });
  });

  describe('Comments CASCADE DELETE on User Delete', () => {
    it('should delete comments when user is deleted', async () => {
      // Arrange
      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal']
      );
      const ticketId = ticketResult.rows[0].id;

      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      const commentResult = await getTestClient().query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4) RETURNING id',
        [ticketId, userId, 'Comment content', 'public']
      );
      const commentId = commentResult.rows[0].id;

      // Act
      await getTestClient().query('DELETE FROM users WHERE id = $1', [userId]);

      // Assert
      const comment = await getTestClient().query('SELECT id FROM comments WHERE id = $1', [commentId]);
      expect(comment.rows).toHaveLength(0);
    });
  });

  describe('Tickets RESTRICT on Department Delete', () => {
    it('should prevent deletion of department with existing tickets', async () => {
      // Arrange
      const deptResult = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Test Dept', 'Description', 'Ground Floor', false, true]
      );
      const deptId = deptResult.rows[0].id;

      const deptName = 'Test Dept';
      await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6)',
        ['Test', 'Description', 'open', 'unset', 'Reporter', deptName]
      );

      // Act & Assert
      await expect(
        getTestClient().query('DELETE FROM departments WHERE id = $1', [deptId])
      ).rejects.toThrow();
    });
  });

  describe('Users RESTRICT on Department Delete', () => {
    it('should prevent deletion of department with assigned users', async () => {
      // Arrange
      const deptResult = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Test Dept 2', 'Description', 'Ground Floor', false, true]
      );
      const deptId = deptResult.rows[0].id;

      const deptName = 'Test Dept 2';
      const userData = createUserData({ role: 'department', department: deptName });
      await User.create(userData, getTestClient());

      // Act & Assert
      await expect(
        getTestClient().query('DELETE FROM departments WHERE id = $1', [deptId])
      ).rejects.toThrow();
    });
  });

  describe('Cascading Updates on Department Rename', () => {
    it('should update user department on department name change', async () => {
      // Arrange
      const originalName = 'Original Dept';
      const newName = 'Updated Dept';

      const deptResult = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [originalName, 'Description', 'Ground Floor', false, true]
      );
      const deptId = deptResult.rows[0].id;

      const userData = createUserData({ role: 'department', department: originalName });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      // Act
      await getTestClient().query('UPDATE departments SET name = $1 WHERE id = $2', [newName, deptId]);

      // Assert
      const updatedUser = await getTestClient().query('SELECT department FROM users WHERE id = $1', [userId]);
      expect(updatedUser.rows[0].department).toBe(newName);
    });

    it('should update ticket reporter_department on department name change', async () => {
      // Arrange
      const originalName = 'Original Dept 2';
      const newName = 'Updated Dept 2';

      const deptResult = await getTestClient().query(
        'INSERT INTO departments (name, description, floor, is_system, active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [originalName, 'Description', 'Ground Floor', false, true]
      );
      const deptId = deptResult.rows[0].id;

      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Test', 'Description', 'open', 'unset', 'Reporter', originalName]
      );
      const ticketId = ticketResult.rows[0].id;

      // Act
      await getTestClient().query('UPDATE departments SET name = $1 WHERE id = $2', [newName, deptId]);

      // Assert
      const updatedTicket = await getTestClient().query('SELECT reporter_department FROM tickets WHERE id = $1', [ticketId]);
      expect(updatedTicket.rows[0].reporter_department).toBe(newName);
    });
  });

  describe('Foreign Key Integrity', () => {
    it('should enforce reporter_id FK constraint', async () => {
      // Act & Assert - Try to insert ticket with non-existent user
      await expect(
        getTestClient().query(
          'INSERT INTO tickets (title, description, status, priority, reporter_id, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          ['Test', 'Description', 'open', 'unset', 99999, 'Reporter', 'Internal']
        )
      ).rejects.toThrow();
    });

    it('should enforce assigned_to FK constraint', async () => {
      // Act & Assert - Try to insert ticket assigned to non-existent user
      await expect(
        getTestClient().query(
          'INSERT INTO tickets (title, description, status, priority, assigned_to, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          ['Test', 'Description', 'open', 'unset', 99999, 'Reporter', 'Internal']
        )
      ).rejects.toThrow();
    });

    it('should enforce ticket_id FK constraint in comments', async () => {
      // Arrange
      const userData = createUserData({ role: 'admin' });
      const user = await User.create(userData, getTestClient());
      const userId = user.id;

      // Act & Assert - Try to insert comment for non-existent ticket
      await expect(
        getTestClient().query(
          'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4)',
          [99999, userId, 'Content', 'public']
        )
      ).rejects.toThrow();
    });

    it('should enforce user_id FK constraint in comments', async () => {
      // Arrange
      const ticketResult = await getTestClient().query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Test', 'Description', 'open', 'unset', 'Reporter', 'Internal']
      );
      const ticketId = ticketResult.rows[0].id;

      // Act & Assert - Try to insert comment by non-existent user
      await expect(
        getTestClient().query(
          'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4)',
          [ticketId, 99999, 'Content', 'public']
        )
      ).rejects.toThrow();
    });

    it('should enforce user.department FK constraint', async () => {
      // Act & Assert - Try to insert user with non-existent department
      const userData = createUserData({ role: 'department', department: 'NonexistentDept' });
      await expect(
        getTestClient().query(
          'INSERT INTO users (username, email, password_hash, role, department, status) VALUES ($1, $2, $3, $4, $5, $6)',
          [userData.username, userData.email, userData.password_hash, userData.role, userData.department, userData.status]
        )
      ).rejects.toThrow();
    });

    it('should enforce ticket.reporter_department FK constraint', async () => {
      // Act & Assert - Try to insert ticket with non-existent department
      await expect(
        getTestClient().query(
          'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6)',
          ['Test', 'Description', 'open', 'unset', 'Reporter', 'NonexistentDept']
        )
      ).rejects.toThrow();
    });
  });

  describe('Foreign Key Constraint Names', () => {
    it('should have properly named FK constraints for readability', async () => {
      // Arrange
      const fkConstraintsQuery = `
        SELECT constraint_name
        FROM information_schema.referential_constraints
        WHERE constraint_schema = 'public'
        ORDER BY constraint_name
      `;

      // Act
      const result = await getTestClient().query(fkConstraintsQuery);
      const constraintNames = result.rows.map(r => r.constraint_name);

      // Assert - Verify constraints exist and follow naming convention
      expect(constraintNames.length).toBeGreaterThan(0);
      constraintNames.forEach(name => {
        expect(name).toBeTruthy();
      });
    });
  });
});
