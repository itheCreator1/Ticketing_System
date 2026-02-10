const app = require('./app');
const logger = require('./utils/logger');
const pool = require('./config/database');

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  logger.info('Ticketing system started', { port, nodeEnv: process.env.NODE_ENV || 'development' });
});

// Graceful shutdown
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  isShuttingDown = true;
  logger.info('Graceful shutdown initiated', { signal });

  // Stop accepting new connections, drain in-flight requests
  server.close(async (err) => {
    if (err) {
      logger.error('Error closing HTTP server', { error: err.message, stack: err.stack });
    } else {
      logger.info('HTTP server closed');
    }

    // Close database pool (drain active queries)
    try {
      await pool.end();
      logger.info('Database pool closed');
    } catch (dbErr) {
      logger.error('Error closing database pool', {
        error: dbErr.message,
        stack: dbErr.stack,
      });
    }

    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Safety net: force exit before PM2 kill_timeout (5000ms) sends SIGKILL
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 4500).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// PM2 cluster mode shutdown message (ecosystem.config.js has shutdown_with_message: true)
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    gracefulShutdown('PM2_SHUTDOWN_MESSAGE');
  }
});
