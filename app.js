require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

const { doubleCsrf } = require('csrf-csrf');

const sessionConfig = require('./config/session');
const errorHandler = require('./middleware/errorHandler');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const clientRoutes = require('./routes/client');
const errorReportingRoutes = require('./routes/errorReporting');

const app = express();

// CSRF Protection Configuration
const {
  generateCsrfToken, // Generates CSRF tokens
  doubleCsrfProtection, // CSRF protection middleware
} = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET,
  // Use __Host- prefix only in production (requires HTTPS)
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-psifi.x-csrf-token' : 'psifi.x-csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.body?._csrf,
  getSessionIdentifier: (req) => req.sessionID || ''
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"]
    }
  }
}));
app.use(morgan('combined'));
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

app.use(session(sessionConfig));

app.use(flash());

// Apply CSRF protection to all routes
app.use(doubleCsrfProtection);

// Make CSRF token and flash messages available to all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  // Generate CSRF token for forms (with overwrite: false to preserve existing tokens)
  res.locals.csrfToken = generateCsrfToken(req, res, { overwrite: false });

  // Add request timing for debugging
  req.startTime = new Date();

  next();
});

app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/users', userRoutes);
app.use('/admin/departments', departmentRoutes);
app.use('/client', clientRoutes);
app.use('/api/errors', errorReportingRoutes);

app.use((req, res) => {
  // Generate correlation ID for 404 errors
  const crypto = require('crypto');
  const correlationId = crypto.randomBytes(8).toString('hex').toUpperCase();

  res.status(404).render('errors/404', {
    title: '404 - Page Not Found',
    status: 404,
    message: 'The page you are looking for could not be found.',
    user: res.locals.user || null,
    correlationId,
    errorCategory: 'NOT_FOUND',
    isDevelopment: process.env.NODE_ENV === 'development',
    stackTrace: null
  });
});

app.use(errorHandler);

module.exports = app;
