const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../utils/logger');

// Redirect homepage to login (no more anonymous submissions)
router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Health check endpoint for monitoring
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  };

  try {
    // Test database connectivity
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.database = {
      status: 'connected',
      responseTime: Date.now() - dbStart
    };
  } catch (error) {
    health.status = 'degraded';
    health.database = {
      status: 'disconnected',
      error: error.message
    };
    logger.error('Health check: Database connection failed', {
      error: error.message
    });
  }

  // Add memory usage
  const mem = process.memoryUsage();
  health.memory = {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + ' MB'
  };

  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// Diagnostics endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/diagnostics', async (req, res) => {
    try {
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };

      const activeSessions = await pool.query(
        'SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()'
      );

      res.json({
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          pool: poolStats,
          activeConnections: activeSessions.rows[0].count
        }
      });
    } catch (error) {
      logger.error('Diagnostics endpoint error', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: error.message });
    }
  });

  // CSRF Debug endpoint
  router.get('/csrf-debug', (req, res) => {
    res.json({
      cookies: req.cookies,
      session: req.session ? {
        id: req.session.id,
        hasUser: !!req.session.user
      } : null,
      csrfToken: res.locals.csrfToken || 'NOT_GENERATED',
      headers: {
        cookie: req.headers.cookie,
        userAgent: req.headers['user-agent']
      }
    });
  });
}

module.exports = router;
