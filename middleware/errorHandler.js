const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error handler caught exception', {
    error: err.message,
    stack: err.stack,
    status: err.status,
    url: req.url,
    method: req.method
  });

  const status = err.status || 500;
  const message = err.message || 'Something went wrong';

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
      user: res.locals.user || null
    });
  } else {
    res.status(status).json({
      error: {
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message
      }
    });
  }
}

module.exports = errorHandler;
