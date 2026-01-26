/**
 * Performance Benchmarks: Comment Operations
 *
 * Measures response times for:
 * - Creating comments
 * - Listing comments on a ticket
 * - Filtering comments by visibility
 */

const http = require('http');
const express = require('express');
const pool = require('../../config/database');
const {
  runBenchmark,
  printResults,
  createTestUser,
  createTestTicket,
  seedBenchmarkData,
  cleanupBenchmarkData,
  formatLatency,
  meetsLodgingSLA
} = require('./helpers/benchmarkRunner');

let server;
let testData;

/**
 * Start minimal Express server with comment endpoints
 */
async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock comment creation
  app.post('/admin/tickets/:id/comments', async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const result = await pool.query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4) RETURNING id',
        [ticketId, testData.user.id, 'Benchmark comment', 'public']
      );

      // Auto-update ticket status
      await pool.query(
        'UPDATE tickets SET status = $1 WHERE id = $2',
        ['waiting_on_department', ticketId]
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock comment listing (admin - sees all)
  app.get('/admin/tickets/:id/comments', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, user_id, content, visibility_type, created_at FROM comments WHERE ticket_id = $1 ORDER BY created_at DESC',
        [parseInt(req.params.id)]
      );
      res.status(200).json({ comments: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock comment listing (department - sees public only)
  app.get('/client/tickets/:id/comments', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, user_id, content, created_at FROM comments WHERE ticket_id = $1 AND visibility_type = $2 ORDER BY created_at DESC',
        [parseInt(req.params.id), 'public']
      );
      res.status(200).json({ comments: result.rows });
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
    server.listen(3003, () => {
      console.log('Benchmark server started on port 3003');
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
 * Run all comment operation benchmarks
 */
async function runAllBenchmarks() {
  console.log('\n🚀 Starting Comment Operations Benchmarks\n');

  try {
    // Setup
    console.log('⏳ Setting up...');
    await startServer();
    testData = await seedBenchmarkData();

    // Seed test comments
    for (let i = 0; i < 30; i++) {
      const visibility = i % 3 === 0 ? 'internal' : 'public';
      await pool.query(
        'INSERT INTO comments (ticket_id, user_id, content, visibility_type) VALUES ($1, $2, $3, $4)',
        [testData.ticket, testData.user.id, `Comment ${i}`, visibility]
      );
    }

    // Warmup
    console.log('🔥 Warming up...');
    await runBenchmark({
      url: 'http://localhost:3003/health',
      connections: 1,
      duration: 2,
      pipelining: 1
    });

    // Benchmark 1: Create comment
    console.log('\n📌 Running: POST /admin/tickets/:id/comments (create comment)');
    const createResult = await runBenchmark({
      url: `http://localhost:3003/admin/tickets/${testData.ticket}/comments`,
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        content: 'Benchmark comment',
        visibility_type: 'public'
      }),
      connections: 5,
      duration: 10,
      pipelining: 1
    });
    printResults(createResult, 'POST /admin/tickets/:id/comments');
    console.log(`  P95 Latency: ${formatLatency(createResult.latency.p95, 400)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(createResult, 400) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 2: List comments (admin - all comments)
    console.log('\n📌 Running: GET /admin/tickets/:id/comments (all comments)');
    const adminListResult = await runBenchmark({
      url: `http://localhost:3003/admin/tickets/${testData.ticket}/comments`,
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1
    });
    printResults(adminListResult, 'GET /admin/tickets/:id/comments');
    console.log(`  P95 Latency: ${formatLatency(adminListResult.latency.p95, 200)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(adminListResult, 200) ? '✅ PASS' : '❌ FAIL'}`);

    // Benchmark 3: List comments (department - filtered)
    console.log('\n📌 Running: GET /client/tickets/:id/comments (filtered comments)');
    const deptListResult = await runBenchmark({
      url: `http://localhost:3003/client/tickets/${testData.ticket}/comments`,
      method: 'GET',
      connections: 10,
      duration: 10,
      pipelining: 1
    });
    printResults(deptListResult, 'GET /client/tickets/:id/comments');
    console.log(`  P95 Latency: ${formatLatency(deptListResult.latency.p95, 200)}`);
    console.log(`  SLA Status: ${meetsLodgingSLA(deptListResult, 200) ? '✅ PASS' : '❌ FAIL'}`);

    console.log('\n✅ Comment Operations Benchmarks Complete\n');
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
