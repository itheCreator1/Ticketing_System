/**
 * Comment Model Unit Tests
 *
 * Tests the Comment model in complete isolation with all dependencies mocked.
 * Covers all 2 static methods with success, failure, and edge cases.
 */

const Comment = require('../../../models/Comment');
const { createMockPool } = require('../../helpers/mocks');
const { createCommentData } = require('../../helpers/factories');

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/logger');

const pool = require('../../../config/database');

describe('Comment Model', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    Object.assign(pool, mockPool);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create comment with all required fields', async () => {
      // Arrange
      const commentData = createCommentData();
      const mockComment = {
        id: 1,
        ticket_id: commentData.ticket_id,
        user_id: commentData.user_id,
        content: commentData.content,
        created_at: new Date()
      };
      pool.query.mockResolvedValue({ rows: [mockComment] });

      // Act
      const result = await Comment.create(commentData);

      // Assert
      expect(result).toEqual(mockComment);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO comments'),
        expect.arrayContaining([
          commentData.ticket_id,
          commentData.user_id,
          commentData.content
        ])
      );
    });

    it('should return created comment with correct structure', async () => {
      // Arrange
      const commentData = createCommentData();
      const now = new Date();
      const mockComment = {
        id: 3,
        ticket_id: commentData.ticket_id,
        user_id: commentData.user_id,
        content: commentData.content,
        created_at: now
      };
      pool.query.mockResolvedValue({ rows: [mockComment] });

      // Act
      const result = await Comment.create(commentData);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('ticket_id');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('created_at');
    });

    it('should use parameterized query', async () => {
      // Arrange
      const commentData = createCommentData({
        ticket_id: 5,
        user_id: 10,
        content: 'Test comment content'
      });
      const mockComment = { id: 4, ...commentData, created_at: new Date() };
      pool.query.mockResolvedValue({ rows: [mockComment] });

      // Act
      await Comment.create(commentData);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1, $2, $3'),
        [5, 10, 'Test comment content']
      );
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const commentData = createCommentData();
      const dbError = new Error('Database insert failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Comment.create(commentData)).rejects.toThrow('Database insert failed');
    });
  });

  describe('findByTicketId', () => {
    it('should return comments with username for a ticket', async () => {
      // Arrange
      const mockComments = [
        {
          id: 1,
          ticket_id: 5,
          user_id: 10,
          content: 'First comment',
          created_at: new Date('2024-01-01'),
          username: 'admin'
        },
        {
          id: 2,
          ticket_id: 5,
          user_id: 11,
          content: 'Second comment',
          created_at: new Date('2024-01-02'),
          username: 'support'
        }
      ];
      pool.query.mockResolvedValue({ rows: mockComments });

      // Act
      const result = await Comment.findByTicketId(5);

      // Assert
      expect(result).toEqual(mockComments);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('username');
      expect(result[0].username).toBe('admin');
      expect(result[1].username).toBe('support');
    });

    it('should execute JOIN with users table to get username', async () => {
      // Arrange
      const mockComments = [
        { id: 1, ticket_id: 3, user_id: 5, content: 'Comment', username: 'testuser' }
      ];
      pool.query.mockResolvedValue({ rows: mockComments });

      // Act
      await Comment.findByTicketId(3);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN users u ON c.user_id = u.id'),
        [3]
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('u.username'),
        expect.any(Array)
      );
    });

    it('should return comments ordered by created_at ASC (chronological)', async () => {
      // Arrange
      const mockComments = [
        { id: 1, content: 'First', created_at: new Date('2024-01-01') },
        { id: 2, content: 'Second', created_at: new Date('2024-01-02') },
        { id: 3, content: 'Third', created_at: new Date('2024-01-03') }
      ];
      pool.query.mockResolvedValue({ rows: mockComments });

      // Act
      await Comment.findByTicketId(1);

      // Assert
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY c.created_at ASC'),
        [1]
      );
    });

    it('should return empty array when ticket has no comments', async () => {
      // Arrange
      pool.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await Comment.findByTicketId(999);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const dbError = new Error('Database query failed');
      pool.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(Comment.findByTicketId(1)).rejects.toThrow('Database query failed');
    });
  });
});
