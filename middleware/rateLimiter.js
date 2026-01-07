const rateLimit = require('express-rate-limit');

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
  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    req.flash('error_msg', 'Too many login attempts. Please try again after 15 minutes.');
    res.redirect('/auth/login');
  }
});

module.exports = {
  loginLimiter
};
