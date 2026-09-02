/**
 * Express Middleware Utilities
 * Clean, reusable middleware functions
 */

/**
 * Request logging middleware for development
 */
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📨 ${timestamp} - ${req.method} ${req.path}`);
  next();
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  console.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
  res.status(404).render('404', {
    user: req.user || null,
    currentPage: '404',
  });
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Application Error:', {
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    stack: err.stack,
  });

  const statusCode = err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).render('500', {
    user: req.user || null,
    error: isDev ? err.message : 'An error occurred while processing your request',
    currentPage: '500',
  });
};

export { requestLogger, notFoundHandler, errorHandler };
