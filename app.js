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
const { i18next, middleware: i18nMiddleware } = require('./config/i18n');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const floorRoutes = require('./routes/floors');
const clientRoutes = require('./routes/client');
const errorReportingRoutes = require('./routes/errorReporting');
const languageRoutes = require('./routes/language');

const app = express();

// CSRF Protection Configuration (disabled in test environment for easier testing)
let generateCsrfToken, doubleCsrfProtection;

if (process.env.NODE_ENV !== 'test') {
  // Production and development: Enable real CSRF protection
  const csrfConfig = doubleCsrf({
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
  generateCsrfToken = csrfConfig.generateCsrfToken;
  doubleCsrfProtection = csrfConfig.doubleCsrfProtection;
} else {
  // Test environment: Disable CSRF protection for simpler testing
  // Tests focus on business logic, not CSRF library validation
  generateCsrfToken = (req, res, options) => 'test-csrf-token';
  doubleCsrfProtection = (req, res, next) => next();
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      upgradeInsecureRequests: null
    }
  },
  hsts: process.env.NODE_ENV === 'production'
}));
app.use(morgan('combined'));
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

app.use(session(sessionConfig));

// Set default language in session if not present
// Uses I18N_DEFAULTLANGUAGE env variable (set in tests to 'en')
// Falls back to 'el' (Greek) for production/development
app.use((req, res, next) => {
  if (!req.session.language) {
    req.session.language = process.env.I18N_DEFAULTLANGUAGE || 'el';
  }
  next();
});

// i18n middleware - must be after session for language detection
app.use(i18nMiddleware.handle(i18next));

app.use(flash());

// Apply CSRF protection to all routes
app.use(doubleCsrfProtection);

// Make CSRF token, flash messages, and i18n available to all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  // Generate CSRF token for forms (with overwrite: false to preserve existing tokens)
  res.locals.csrfToken = generateCsrfToken(req, res, { overwrite: false });

  // i18n: Make translation function and current language available to views
  res.locals.t = req.t;
  res.locals.language = req.language || 'el';

  // Add request timing for debugging
  req.startTime = new Date();

  next();
});

// Make design tokens available to all views
const { DESIGN_TOKENS } = require('./constants/designTokens');
app.use((req, res, next) => {
  res.locals.tokens = DESIGN_TOKENS;
  next();
});

app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/users', userRoutes);
app.use('/admin/departments', departmentRoutes);
app.use('/admin/floors', floorRoutes);
app.use('/client', clientRoutes);
app.use('/api/errors', errorReportingRoutes);
app.use('/language', languageRoutes);

app.use((req, res) => {
  // Generate correlation ID for 404 errors
  const crypto = require('crypto');
  const correlationId = crypto.randomBytes(8).toString('hex').toUpperCase();

  res.status(404).render('errors/404', {
    title: req.t('errors:404.title'),
    status: 404,
    message: req.t('errors:404.message'),
    user: res.locals.user || null,
    correlationId,
    errorCategory: 'NOT_FOUND',
    isDevelopment: process.env.NODE_ENV === 'development',
    stackTrace: null,
    t: req.t,
    language: req.language || 'el'
  });
});

app.use(errorHandler);

module.exports = app;
