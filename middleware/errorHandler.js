function errorHandler(err, req, res, next) {
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || 'Something went wrong';

  if (req.accepts('html')) {
    res.status(status).render('errors/500', {
      title: 'Error',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message
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
