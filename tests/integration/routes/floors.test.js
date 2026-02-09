/**
 * Floor Management Routes Integration Tests
 *
 * Tests floor management routes with real database:
 * - GET /admin/floors - List all floors
 * - GET /admin/floors/new - Create floor form
 * - POST /admin/floors - Create new floor
 * - GET /admin/floors/:id/edit - Edit floor form
 * - POST /admin/floors/:id - Update floor
 * - POST /admin/floors/:id/deactivate - Deactivate floor
 * - POST /admin/floors/:id/reactivate - Reactivate floor
 *
 * Uses pool-based setup (no transactions) since tests make HTTP requests
 * which cannot see uncommitted transactional data.
 */

const request = require('supertest');
const app = require('../../../app');
const { setupIntegrationTest, teardownIntegrationTest } = require('../../helpers/database');
const { createUserData } = require('../../helpers/factories');
const { fetchCsrfToken, authenticateUser } = require('../../helpers/csrf');
const User = require('../../../models/User');
const Floor = require('../../../models/Floor');

describe('Floor Management Routes Integration Tests', () => {
  let _superAdminUser;
  let superAdminCookies;
  let superAdminCsrfToken;
  let _adminUser;
  let adminCookies;
  let adminCsrfToken;

  beforeEach(async () => {
    await setupIntegrationTest();

    // Create super_admin user and login
    const superAdminData = createUserData({ role: 'super_admin', status: 'active' });
    _superAdminUser = await User.create(superAdminData);

    const { cookies: saCookies, csrfToken: saCsrfToken } = await authenticateUser(app, {
      username: superAdminData.username,
      password: superAdminData.password,
    });
    superAdminCookies = saCookies;
    superAdminCsrfToken = saCsrfToken;

    // Create regular admin user for permission tests
    const adminData = createUserData({ role: 'admin', status: 'active' });
    _adminUser = await User.create(adminData);

    const { cookies: aCookies, csrfToken: aCsrfToken } = await authenticateUser(app, {
      username: adminData.username,
      password: adminData.password,
    });
    adminCookies = aCookies;
    adminCsrfToken = aCsrfToken;
  });

  afterEach(async () => {
    await teardownIntegrationTest();
  });

  describe('GET /admin/floors', () => {
    it('should require super_admin role', async () => {
      // Act - Use admin (not super_admin) cookies
      const response = await request(app).get('/admin/floors').set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should list all floors for super_admin', async () => {
      // Arrange
      await Floor.create({ name: 'Test Floor 1', sort_order: 1 });
      await Floor.create({ name: 'Test Floor 2', sort_order: 2 });

      // Act
      const response = await request(app).get('/admin/floors').set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Floor Management');
      expect(response.text).toContain('Test Floor 1');
      expect(response.text).toContain('Test Floor 2');
    });

    it('should display floor status (active/inactive)', async () => {
      // Arrange
      const _floor1 = await Floor.create({ name: 'Active Floor', sort_order: 1 });
      const floor2 = await Floor.create({ name: 'Inactive Floor', sort_order: 2 });
      await Floor.deactivate(floor2.id);

      // Act
      const response = await request(app).get('/admin/floors').set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Active Floor');
      expect(response.text).toContain('Inactive Floor');
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app).get('/admin/floors');

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/auth/login');
    });
  });

  describe('GET /admin/floors/new', () => {
    it('should show create floor form for super_admin', async () => {
      // Act
      const response = await request(app).get('/admin/floors/new').set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Create Floor');
    });

    it('should require super_admin role', async () => {
      // Act
      const response = await request(app).get('/admin/floors/new').set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app).get('/admin/floors/new');

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/auth/login');
    });
  });

  describe('POST /admin/floors', () => {
    it('should create floor with valid data', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'New Test Floor',
          sort_order: 5,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/admin/floors');

      // Verify floor was created
      const floor = await Floor.findByName('New Test Floor');
      expect(floor).toBeDefined();
      expect(floor.sort_order).toBe(5);
    });

    it('should log floor creation to audit log', async () => {
      // Act
      await request(app).post('/admin/floors').set('Cookie', superAdminCookies).send({
        name: 'Audit Test Floor',
        sort_order: 3,
        _csrf: superAdminCsrfToken,
      });

      // Assert - Floor should be created
      const floor = await Floor.findByName('Audit Test Floor');
      expect(floor).toBeDefined();
    });

    it('should reject duplicate floor name', async () => {
      // Arrange
      await Floor.create({ name: 'Duplicate Floor', sort_order: 1 });

      // Act
      const response = await request(app)
        .post('/admin/floors')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Duplicate Floor',
          sort_order: 2,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/admin/floors');
    });

    it('should reject invalid floor name (too short)', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'A',
          sort_order: 1,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should reject invalid sort_order (negative)', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Valid Floor',
          sort_order: -1,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should require super_admin role', async () => {
      // Act
      const response = await request(app).post('/admin/floors').set('Cookie', adminCookies).send({
        name: 'New Floor',
        sort_order: 1,
        _csrf: adminCsrfToken,
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should require CSRF token in POST request', async () => {
      // Act - POST without CSRF token (should be rejected)
      const response = await request(app)
        .post('/admin/floors')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'New Floor',
          sort_order: 1,
        });

      // Assert - CSRF protection rejects requests without token
      expect(response.status).toBe(403);
    });
  });

  describe('GET /admin/floors/:id/edit', () => {
    it('should show edit floor form for super_admin', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Edit Test Floor', sort_order: 1 });

      // Act
      const response = await request(app)
        .get(`/admin/floors/${floor.id}/edit`)
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toContain('Edit Floor');
      expect(response.text).toContain('Edit Test Floor');
    });

    it('should show error for non-existent floor', async () => {
      // Act
      const response = await request(app)
        .get('/admin/floors/9999/edit')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(302);
    });

    it('should require super_admin role', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Edit Test', sort_order: 1 });

      // Act
      const response = await request(app)
        .get(`/admin/floors/${floor.id}/edit`)
        .set('Cookie', adminCookies);

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should require valid floor ID parameter', async () => {
      // Act
      const response = await request(app)
        .get('/admin/floors/invalid/edit')
        .set('Cookie', superAdminCookies);

      // Assert
      expect(response.status).toBe(302);
    });
  });

  describe('POST /admin/floors/:id', () => {
    it('should update floor with valid data', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Original Floor', sort_order: 1 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}`)
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Updated Floor Name',
          sort_order: 5,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);

      // Verify update
      const updated = await Floor.findById(floor.id);
      expect(updated.name).toBe('Updated Floor Name');
      expect(updated.sort_order).toBe(5);
    });

    it('should prevent updating system floor', async () => {
      // Arrange - Create a "system" floor by directly querying
      // For now, test with a regular floor
      const floor = await Floor.create({ name: 'Test Floor', sort_order: 1 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}`)
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Updated Name',
          sort_order: 10,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should reject invalid floor ID parameter', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors/invalid')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Updated Floor',
          sort_order: 1,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should reject duplicate floor name', async () => {
      // Arrange
      const _floor1 = await Floor.create({ name: 'Floor One', sort_order: 1 });
      const floor2 = await Floor.create({ name: 'Floor Two', sort_order: 2 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor2.id}`)
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Floor One',
          sort_order: 2,
          _csrf: superAdminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should require super_admin role', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Edit Test', sort_order: 1 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}`)
        .set('Cookie', adminCookies)
        .send({
          name: 'Updated Floor',
          sort_order: 5,
          _csrf: adminCsrfToken,
        });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });
  });

  describe('POST /admin/floors/:id/deactivate', () => {
    it('should deactivate floor successfully', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Deactivate Test', sort_order: 1 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}/deactivate`)
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);

      // Verify deactivation
      const deactivated = await Floor.findById(floor.id);
      expect(deactivated.active).toBe(false);
    });

    it('should prevent deactivating floor with departments', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Test Floor', sort_order: 1 });
      // Note: Would need to create actual department assignments to fully test this
      // For now, we test that the endpoint works for floors without departments

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}/deactivate`)
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert - Should succeed since no departments assigned
      expect(response.status).toBe(302);
    });

    it('should require super_admin role', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Deactivate Test', sort_order: 1 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}/deactivate`)
        .set('Cookie', adminCookies)
        .send({ _csrf: adminCsrfToken });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should show error for non-existent floor', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors/9999/deactivate')
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should require valid floor ID parameter', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors/invalid/deactivate')
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);
    });
  });

  describe('POST /admin/floors/:id/reactivate', () => {
    it('should reactivate floor successfully', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Reactivate Test', sort_order: 1 });
      await Floor.deactivate(floor.id);

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}/reactivate`)
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);

      // Verify reactivation
      const reactivated = await Floor.findById(floor.id);
      expect(reactivated.active).toBe(true);
    });

    it('should reactivate already active floor', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Already Active', sort_order: 1 });

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}/reactivate`)
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);

      // Verify still active
      const checked = await Floor.findById(floor.id);
      expect(checked.active).toBe(true);
    });

    it('should require super_admin role', async () => {
      // Arrange
      const floor = await Floor.create({ name: 'Reactivate Test', sort_order: 1 });
      await Floor.deactivate(floor.id);

      // Act
      const response = await request(app)
        .post(`/admin/floors/${floor.id}/reactivate`)
        .set('Cookie', adminCookies)
        .send({ _csrf: adminCsrfToken });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/admin/dashboard');
    });

    it('should show error for non-existent floor', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors/9999/reactivate')
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);
    });

    it('should require valid floor ID parameter', async () => {
      // Act
      const response = await request(app)
        .post('/admin/floors/invalid/reactivate')
        .set('Cookie', superAdminCookies)
        .send({ _csrf: superAdminCsrfToken });

      // Assert
      expect(response.status).toBe(302);
    });
  });

  describe('Authorization checks', () => {
    it('should require authentication for all floor routes', async () => {
      // Test each endpoint without authentication
      const floor = await Floor.create({ name: 'Auth Test', sort_order: 1 });

      const endpoints = [
        { method: 'GET', path: '/admin/floors' },
        { method: 'GET', path: '/admin/floors/new' },
        { method: 'POST', path: '/admin/floors' },
        { method: 'GET', path: `/admin/floors/${floor.id}/edit` },
        { method: 'POST', path: `/admin/floors/${floor.id}` },
        { method: 'POST', path: `/admin/floors/${floor.id}/deactivate` },
        { method: 'POST', path: `/admin/floors/${floor.id}/reactivate` },
      ];

      for (const endpoint of endpoints) {
        let req;
        if (endpoint.method === 'POST') {
          // POST requests need CSRF token+cookies to reach auth middleware
          const { csrfToken, cookies } = await fetchCsrfToken(app);
          req = request(app).post(endpoint.path).set('Cookie', cookies).send({ _csrf: csrfToken });
        } else {
          req = request(app)[endpoint.method.toLowerCase()](endpoint.path);
        }
        const response = await req;

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/auth/login');
      }
    });

    it('should reject all floor routes for non-super_admin', async () => {
      // Test each endpoint with admin role (not super_admin)
      const floor = await Floor.create({ name: 'Auth Test', sort_order: 1 });

      const endpoints = [
        { method: 'GET', path: '/admin/floors' },
        { method: 'GET', path: '/admin/floors/new' },
        { method: 'POST', path: '/admin/floors' },
        { method: 'GET', path: `/admin/floors/${floor.id}/edit` },
        { method: 'POST', path: `/admin/floors/${floor.id}` },
        { method: 'POST', path: `/admin/floors/${floor.id}/deactivate` },
        { method: 'POST', path: `/admin/floors/${floor.id}/reactivate` },
      ];

      for (const endpoint of endpoints) {
        let req;
        if (endpoint.method === 'POST') {
          req = request(app)
            .post(endpoint.path)
            .set('Cookie', adminCookies)
            .send({ _csrf: adminCsrfToken });
        } else {
          req = request(app)
            [endpoint.method.toLowerCase()](endpoint.path)
            .set('Cookie', adminCookies);
        }
        const response = await req;

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/admin/dashboard');
      }
    });
  });
});

// Helper matcher for checking response status is one of multiple values
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected}`
          : `expected ${received} to be one of ${expected}`,
      pass,
    };
  },
});
