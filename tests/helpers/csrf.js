/**
 * CSRF Test Helpers
 *
 * Provides utilities for handling CSRF tokens in integration and E2E tests.
 * Uses the csrf-csrf double-submit cookie pattern: token in form body (_csrf)
 * must match the signed value in the psifi.x-csrf-token cookie.
 *
 * Key behavior: No session regeneration on login, so CSRF token survives login.
 * overwrite: false means token is reused within the same session.
 */

const request = require('supertest');

/**
 * Extract CSRF token from HTML response body
 * Looks for hidden input: <input type="hidden" name="_csrf" value="TOKEN">
 * @param {string} html - HTML response body
 * @returns {string|null} CSRF token or null if not found
 */
function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Merge cookie arrays, with newer cookies overriding same-name ones
 * Supertest returns cookies as Set-Cookie header arrays; this merges them
 * so that subsequent requests carry the full cookie jar.
 * @param {string[]} existing - Existing cookie array
 * @param {string[]} newer - Newer cookie array (overrides existing)
 * @returns {string[]} Merged cookie array
 */
function mergeCookies(existing, newer) {
  if (!existing) {
    return newer || [];
  }
  if (!newer) {
    return existing;
  }

  const cookieMap = new Map();

  // Parse existing cookies
  for (const cookie of existing) {
    const name = cookie.split('=')[0].trim();
    cookieMap.set(name, cookie);
  }

  // Override with newer cookies
  for (const cookie of newer) {
    const name = cookie.split('=')[0].trim();
    cookieMap.set(name, cookie);
  }

  return Array.from(cookieMap.values());
}

/**
 * Fetch a CSRF token by GETting a page
 * Returns the token and all cookies (session + CSRF cookie)
 * @param {object} app - Express app instance
 * @param {string} url - URL to GET (default: /auth/login)
 * @param {string[]|null} cookies - Existing cookies to send
 * @returns {Promise<{csrfToken: string, cookies: string[]}>}
 */
async function fetchCsrfToken(app, url = '/auth/login', cookies = null) {
  let req = request(app).get(url);
  if (cookies) {
    req = req.set('Cookie', cookies);
  }
  const response = await req;
  const csrfToken = extractCsrfToken(response.text);
  const responseCookies = mergeCookies(cookies, response.headers['set-cookie']);
  return { csrfToken, cookies: responseCookies };
}

/**
 * Authenticate a user with full CSRF flow
 * 1. GET /auth/login to get CSRF token + cookies
 * 2. POST /auth/login with credentials + _csrf token
 * 3. Return merged cookies (session + CSRF) and token for subsequent requests
 *
 * Note: Session ID does NOT change on login, so the CSRF token from step 1
 * remains valid for all subsequent POST requests in this session.
 *
 * @param {object} app - Express app instance
 * @param {object} credentials - { username, password }
 * @returns {Promise<{cookies: string[], csrfToken: string, loginResponse: object}>}
 */
async function authenticateUser(app, { username, password }) {
  // Step 1: Get CSRF token from login page
  const { csrfToken, cookies: getCookies } = await fetchCsrfToken(app);

  // Step 2: POST login with CSRF token
  const loginResponse = await request(app)
    .post('/auth/login')
    .set('Cookie', getCookies)
    .send({ username, password, _csrf: csrfToken });

  // Merge cookies from POST response (may update session cookie)
  const cookies = mergeCookies(getCookies, loginResponse.headers['set-cookie']);

  return { cookies, csrfToken, loginResponse };
}

module.exports = {
  extractCsrfToken,
  mergeCookies,
  fetchCsrfToken,
  authenticateUser,
};
