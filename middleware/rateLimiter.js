const rateLimit = require('express-rate-limit');

// Skip rate limiting in test environment
const isTestEnvironment = process.env.NODE_ENV === 'test';

/**
 * Rate limiter for login endpoint
 * Limits: 10 attempts per 15 minutes per IP address
 *
 * Prevents brute force attacks by temporarily blocking IPs
 * that exceed the login attempt threshold.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests, not just failed ones
  skipFailedRequests: false,
  skip: () => isTestEnvironment, // Skip rate limiting in test environment
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    req.flash('error_msg', 'Too many login attempts. Please try again after 15 minutes.');
    res.redirect('/auth/login');
  }
});

/**
 * Rate limiter for admin mutation operations (POST/PUT/DELETE)
 * Limits: 20 requests per minute per IP address
 *
 * Prevents abuse of admin endpoints by limiting the rate of
 * state-changing operations (create, update, delete).
 *
 * Applied to:
 * - User management endpoints (create, update, delete users)
 * - Ticket management endpoints (create, update tickets)
 * - Department management endpoints (create, update departments)
 * - Any other admin POST/PUT/DELETE operations
 */
const adminMutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute in milliseconds
  max: 20, // Limit each IP to 20 requests per minute
  message: 'Too many requests from this IP, please slow down',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all mutation attempts
  skipFailedRequests: false,
  skip: () => isTestEnvironment, // Skip rate limiting in test environment
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    req.flash('error_msg', 'Too many requests. Please wait a moment before trying again.');
    res.redirect('back');
  }
});

module.exports = {
  loginLimiter,
  adminMutationLimiter
};
