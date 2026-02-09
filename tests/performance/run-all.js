#!/usr/bin/env node

/**
 * Performance Benchmark Orchestrator
 *
 * Runs all benchmarks (authentication, tickets, comments) in sequence
 * and provides a summary report.
 */

const _fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Run a benchmark script
 * @param {string} scriptName - Name of the benchmark script (without .js)
 * @returns {Promise<void>}
 */
function runBenchmark(scriptName) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, `${scriptName}.bench.js`);
    const process = spawn('node', [script], {
      stdio: 'inherit',
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });

    process.on('error', reject);
  });
}

/**
 * Main orchestrator
 */
async function runAllBenchmarks() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 KNII Ticketing System - Performance Benchmarks');
  console.log('='.repeat(70) + '\n');

  const benchmarks = [
    { name: 'authentication', label: '🔐 Authentication' },
    { name: 'ticketOperations', label: '🎫 Ticket Operations' },
    { name: 'commentOperations', label: '💬 Comment Operations' },
  ];

  const results = [];
  const failedBenchmarks = [];

  for (const benchmark of benchmarks) {
    console.log(`\n▶️  Running ${benchmark.label} Benchmarks...\n`);

    try {
      const startTime = Date.now();
      await runBenchmark(benchmark.name);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      results.push({
        name: benchmark.label,
        status: '✅ PASS',
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error(`\n❌ ${benchmark.label} benchmark failed: ${error.message}\n`);
      failedBenchmarks.push(benchmark.label);
      results.push({
        name: benchmark.label,
        status: '❌ FAIL',
        duration: 'N/A',
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Benchmark Summary');
  console.log('='.repeat(70) + '\n');

  results.forEach((result) => {
    console.log(`${result.status} ${result.name.padEnd(25)} (${result.duration})`);
  });

  console.log('\n' + '='.repeat(70));

  if (failedBenchmarks.length === 0) {
    console.log('✅ All benchmarks completed successfully!');
  } else {
    console.log(`❌ ${failedBenchmarks.length} benchmark(s) failed:`);
    failedBenchmarks.forEach((name) => {
      console.log(`   - ${name}`);
    });
    process.exit(1);
  }

  console.log('='.repeat(70) + '\n');
}

// Run orchestrator
runAllBenchmarks().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
