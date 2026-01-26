/**
 * Performance Benchmarks: Authentication Flows
 *
 * Measures response times for:
 * - Login endpoint (bcrypt + database queries)
 * - Authenticated dashboard access
 * - Session middleware overhead
 */

const http = require('http');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const pool = require('../../config/database');
const {
  runBenchmark,
  printResults,
  createTestUser,
  seedBenchmarkData,
  cleanupBenchmarkData,
  formatLatency,
  meetsLodgingSLA
} = require('./helpers/benchmarkRunner');

let server;
let testUser;

/**
 * Start minimal Express server for benchmarking
 */
async function startServer() {
  const app = express();

  const sessionStore = new (connectPgSimple(session))({
    pool: pool,
    tableName: 'session'
  });

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'benchmark-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
  }));

  app.use(express.urlencoded({ extended: true }));

  // Mock login endpoint
  app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;

    // Simulate authentication logic
    if (username && password) {
      req.session.user = {
        id: 1,
        username: username,
        role: 'admin'
      };
      res.redirect('/admin/dashboard');
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  // Mock authenticated dashboard
  app.get('/admin/dashboard', (req, res) => {
    if (req.session.user) {
      res.status(200).send('Dashboard');
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(3001, () => {
      console.log('Benchmark server started on port 3001');
      resolve(server);
    });
  });
}

/**
 * Stop the benchmark server
 */
async function stopServer() {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        console.log('Benchmark server stopped');
        resolve();
      });
    });
  }
}

/**
 * Run all authentication benchmarks
 */
async function runAllBenchmarks() {
  console.log('\n🚀 Starting Authentication Benchmarks\n');

  try {
    // Setup
    console.log('⏳ Setting up...');
    await startServer();
    testUser = await createTestUser();

    // Warmup
    console.log('🔥 Warming up...');
    await runBenchmark({
      url: 'http://localhost:3001/health',
      connections: 1,
      duration: 2,
      pipelining: 1
    });

    // Benchmark 1: Login endpoint
    console.log('📌 Running: POST /auth/login (bcrypt + database)');
    const loginResult = await runBenchmark({
      url: 'http://localhost:3001/auth/login',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: `username=${testUser.username}&password=ValidPass123!`,
      connections: 5,
      duration: 10,
      pipelining: 1
    });
    printResults(loginResult, 'POST /auth/login');
    console.log(`  P95 Latency: ${formatLatency(loginResult.latency.p95, 300)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(loginResult, 300) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 2: Authenticated request
    console.log('\n📌 Running: GET /admin/dashboard (session validation)');
    const dashboardResult = await runBenchmark({
      url: 'http://localhost:3001/admin/dashboard',
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1,
      cookies: [{ name: 'sessionid', value: 'benchmark-session' }]
    });
    printResults(dashboardResult, 'GET /admin/dashboard');
    console.log(`  P95 Latency: ${formatLatency(dashboardResult.latency.p95, 200)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(dashboardResult, 200) ? '✅ PASS' : '❌ FAIL'}`);

    console.log('\n✅ Authentication Benchmarks Complete\n');
  } catch (error) {
    console.error(`Error running benchmarks: ${error.message}`);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    await stopServer();
    await cleanupBenchmarkData();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  runAllBenchmarks();
}

module.exports = { runAllBenchmarks, startServer, stopServer };
