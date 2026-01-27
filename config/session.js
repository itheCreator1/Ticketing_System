const pgSession = require('connect-pg-simple')(require('express-session'));
const pool = require('./database');

// Use memory store in test environment for speed and isolation
// Production and development use PostgreSQL session store
let store;
if (process.env.NODE_ENV === 'test') {
  const MemoryStore = require('memorystore')(require('express-session'));
  store = new MemoryStore({
    checkPeriod: 86400000 // 24 hours
  });
} else {
  store = new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  });
}

const sessionConfig = {
  store: store,
  secret: (() => {
    if (!process.env.SESSION_SECRET) {
      throw new Error(
        'SESSION_SECRET environment variable is required. ' +
        'Generate one using: openssl rand -base64 32'
      );
    }

    // Validate minimum length for security
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error(
        'SESSION_SECRET must be at least 32 characters long for security'
      );
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
