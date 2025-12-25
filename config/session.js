const pgSession = require('connect-pg-simple')(require('express-session'));
const pool = require('./database');

const sessionConfig = {
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: (() => {
    if (!process.env.SESSION_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'SESSION_SECRET environment variable is required in production. ' +
          'Generate one using: openssl rand -base64 32'
        );
      } else {
        console.warn(
          '\x1b[33m%s\x1b[0m',
          'WARNING: SESSION_SECRET not set. Using insecure default for development only. ' +
          'Set SESSION_SECRET in .env for production.'
        );
        return 'insecure-dev-secret-change-for-production';
      }
    }
    return process.env.SESSION_SECRET;
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
};

module.exports = sessionConfig;
