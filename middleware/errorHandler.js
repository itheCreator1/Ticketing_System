const logger = require('../utils/logger');
const crypto = require('crypto');

// Generate a unique correlation ID for error tracking
function generateCorrelationId() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

// Categorize error types for better debugging
function categorizeError(err, status) {
  if (status === 404) return 'NOT_FOUND';
  if (status === 403) return 'FORBIDDEN';
  if (status === 401) return 'UNAUTHORIZED';
  if (status >= 400 && status < 500) return 'CLIENT_ERROR';
  if (status >= 500) return 'SERVER_ERROR';

  // Check error message/type for specific categories
  if (err.message && err.message.includes('database')) return 'DATABASE_ERROR';
  if (err.message && err.message.includes('validation')) return 'VALIDATION_ERROR';
  if (err.message && err.message.includes('authentication')) return 'AUTH_ERROR';
  if (err.message && err.message.includes('authorization')) return 'AUTHZ_ERROR';

  return 'UNKNOWN_ERROR';
}

function errorHandler(err, req, res, next) {
  const correlationId = generateCorrelationId();
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  const errorCategory = categorizeError(err, status);

  // Enhanced logging with correlation ID and more context
  logger.error('Error handler caught exception', {
    correlationId,
    errorCategory,
    error: err.message,
    stack: err.stack,
    status,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.session?.user?.id || 'anonymous',
    userRole: req.session?.user?.role || 'none',
    timestamp: new Date().toISOString(),
    // Add request timing if available
    requestStartTime: req.startTime ? new Date(req.startTime).toISOString() : null,
    // Sanitize headers (remove sensitive ones)
    headers: {
      accept: req.get('Accept'),
      contentType: req.get('Content-Type'),
      referer: req.get('Referer')
    }
  });

  if (req.accepts('html')) {
    // Determine which error template to render
    let errorTemplate = 'errors/error'; // default generic template

    if (status === 404) {
      errorTemplate = 'errors/404';
    } else if (status === 403) {
      errorTemplate = 'errors/403';
    } else if (status === 500) {
      errorTemplate = 'errors/500';
    }

    res.status(status).render(errorTemplate, {
      title: 'Error',
      status: status, // Pass status for generic template
      message: process.env.NODE_ENV === 'production'
        ? (status === 500 ? 'Internal server error' : 'An error occurred')
        : message,
      user: res.locals.user || null,
      correlationId,
      errorCategory,
      isDevelopment: process.env.NODE_ENV === 'development',
      stackTrace: process.env.NODE_ENV === 'development' ? err.stack : null
    });
  } else {
    res.status(status).json({
      error: {
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
        correlationId,
        category: errorCategory
      }
    });
  }
}

module.exports = errorHandler;
