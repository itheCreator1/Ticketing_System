/**
 * Performance Benchmarks: Ticket Operations
 *
 * Measures response times for:
 * - Listing tickets (admin and department views)
 * - Viewing ticket details
 * - Creating tickets
 * - Updating ticket status
 */

const http = require('http');
const express = require('express');
const pool = require('../../config/database');
const {
  runBenchmark,
  printResults,
  createTestUser,
  createTestDepartment,
  createTestTicket,
  seedBenchmarkData,
  cleanupBenchmarkData,
  formatLatency,
  meetsLodgingSLA
} = require('./helpers/benchmarkRunner');

let server;
let testData;

/**
 * Start minimal Express server with ticket endpoints
 */
async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock admin ticket listing
  app.get('/admin/dashboard', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, title, status, priority FROM tickets ORDER BY created_at DESC LIMIT 50'
      );
      res.status(200).json({ tickets: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock department ticket listing
  app.get('/client/dashboard', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, title, status, priority FROM tickets WHERE reporter_department = $1 AND is_admin_created = false ORDER BY created_at DESC LIMIT 50',
        ['BenchmarkDept']
      );
      res.status(200).json({ tickets: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock ticket detail view
  app.get('/admin/tickets/:id', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM tickets WHERE id = $1',
        [parseInt(req.params.id)]
      );
      res.status(200).json(result.rows[0] || {});
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock ticket creation
  app.post('/admin/tickets', async (req, res) => {
    try {
      const result = await pool.query(
        'INSERT INTO tickets (title, description, status, priority, reporter_name, reporter_department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        ['Benchmark Ticket', 'Description', 'open', 'unset', 'Reporter', 'BenchmarkDept']
      );
      res.status(201).json({ id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock ticket status update
  app.put('/admin/tickets/:id', async (req, res) => {
    try {
      await pool.query(
        'UPDATE tickets SET status = $1 WHERE id = $2',
        ['in_progress', parseInt(req.params.id)]
      );
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(3002, () => {
      console.log('Benchmark server started on port 3002');
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
 * Run all ticket operation benchmarks
 */
async function runAllBenchmarks() {
  console.log('\n🚀 Starting Ticket Operations Benchmarks\n');

  try {
    // Setup
    console.log('⏳ Setting up...');
    await startServer();
    testData = await seedBenchmarkData();

    // Create test tickets
    for (let i = 0; i < 20; i++) {
      await createTestTicket();
    }

    // Warmup
    console.log('🔥 Warming up...');
    await runBenchmark({
      url: 'http://localhost:3002/health',
      connections: 1,
      duration: 2,
      pipelining: 1
    });

    // Benchmark 1: Admin ticket listing
    console.log('\n📌 Running: GET /admin/dashboard (ticket list)');
    const adminListResult = await runBenchmark({
      url: 'http://localhost:3002/admin/dashboard',
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1
    });
    printResults(adminListResult, 'GET /admin/dashboard');
    console.log(`  P95 Latency: ${formatLatency(adminListResult.latency.p95, 400)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(adminListResult, 400) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 2: Department ticket listing
    console.log('\n📌 Running: GET /client/dashboard (filtered ticket list)');
    const deptListResult = await runBenchmark({
      url: 'http://localhost:3002/client/dashboard',
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1
    });
    printResults(deptListResult, 'GET /client/dashboard');
    console.log(`  P95 Latency: ${formatLatency(deptListResult.latency.p95, 300)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(deptListResult, 300) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 3: Ticket detail view
    console.log('\n📌 Running: GET /admin/tickets/:id (ticket detail)');
    const detailResult = await runBenchmark({
      url: `http://localhost:3002/admin/tickets/${testData.ticket}`,
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1
    });
    printResults(detailResult, 'GET /admin/tickets/:id');
    console.log(`  P95 Latency: ${formatLatency(detailResult.latency.p95, 200)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(detailResult, 200) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 4: Ticket creation
    console.log('\n📌 Running: POST /admin/tickets (create ticket)');
    const createResult = await runBenchmark({
      url: 'http://localhost:3002/admin/tickets',
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Benchmark Ticket',
        description: 'Test ticket',
        priority: 'unset'
      }),
      connections: 5,
      duration: 10,
      pipelining: 1
    });
    printResults(createResult, 'POST /admin/tickets');
    console.log(`  P95 Latency: ${formatLatency(createResult.latency.p95, 300)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(createResult, 300) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 5: Ticket status update
    console.log('\n📌 Running: PUT /admin/tickets/:id (update status)');
    const updateResult = await runBenchmark({
      url: `http://localhost:3002/admin/tickets/${testData.ticket}`,
      method: 'PUT',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ status: 'in_progress' }),
      connections: 5,
      duration: 10,
      pipelining: 1
    });
    printResults(updateResult, 'PUT /admin/tickets/:id');
    console.log(`  P95 Latency: ${formatLatency(updateResult.latency.p95, 300)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(updateResult, 300) ? '✅ PASS' : '❌ FAIL'}`);

    console.log('\n✅ Ticket Operations Benchmarks Complete\n');
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
