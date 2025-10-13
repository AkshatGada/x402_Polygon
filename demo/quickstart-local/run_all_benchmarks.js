import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BENCHMARK_CONFIGS = [
  {
    name: 'Polygon x402 Facilitator',
    seller: 'seller_x402.js',
    buyer: 'multi_wallet_test.js',
    facilitatorUrl: 'https://x402-amoy.polygon.technology'
  },
  {
    name: 'PayAI Facilitator',
    seller: 'seller_x402.js',
    buyer: 'multi_wallet_test_payai.js',
    facilitatorUrl: 'https://facilitator.payai.network'
  }
];

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      shell: true
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const proc = spawn('lsof', ['-ti', `:${port}`], { shell: true });
    let pid = '';

    proc.stdout.on('data', (data) => {
      pid += data.toString();
    });

    proc.on('close', () => {
      if (pid.trim()) {
        spawn('kill', ['-9', pid.trim()], { shell: true }).on('close', () => {
          setTimeout(resolve, 1000);
        });
      } else {
        resolve();
      }
    });
  });
}

function parseTestResults(output) {
  const results = {
    totalTests: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalTime: 0,
    averageTimePerTest: 0,
    tests: []
  };

  // Extract test summaries
  const testMatches = output.matchAll(/Running test with (\d+) wallets and (\d+)ms delay[\s\S]*?Total time: ([\d.]+) seconds[\s\S]*?Successful transactions: (\d+)[\s\S]*?Failed transactions: (\d+)/g);

  for (const match of testMatches) {
    const numWallets = parseInt(match[1]);
    const delay = parseInt(match[2]);
    const time = parseFloat(match[3]);
    const successful = parseInt(match[4]);
    const failed = parseInt(match[5]);

    results.totalTests++;
    results.successfulTransactions += successful;
    results.failedTransactions += failed;
    results.totalTime += time;

    results.tests.push({
      wallets: numWallets,
      delay,
      time,
      successful,
      failed,
      successRate: ((successful / (successful + failed)) * 100).toFixed(2) + '%'
    });
  }

  if (results.totalTests > 0) {
    results.averageTimePerTest = (results.totalTime / results.totalTests).toFixed(2);
  }

  // Calculate average time per transaction
  if (results.successfulTransactions > 0) {
    results.averageTimePerTransaction = (results.totalTime / results.successfulTransactions).toFixed(3);
  }

  return results;
}

async function runBenchmark(config, index) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`BENCHMARK ${index + 1}: ${config.name}`);
  console.log(`${'='.repeat(80)}\n`);

  // Kill any existing server
  console.log('Stopping any existing servers...');
  await killProcessOnPort(4021);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start seller server
  console.log(`Starting seller: ${config.seller}...`);
  const sellerProc = spawn('node', [config.seller], {
    cwd: process.cwd(),
    env: { ...process.env, FACILITATOR_URL: config.facilitatorUrl },
    detached: true,
    stdio: 'pipe'
  });

  let sellerOutput = '';
  sellerProc.stdout.on('data', (data) => {
    sellerOutput += data.toString();
  });

  sellerProc.stderr.on('data', (data) => {
    console.error('Seller error:', data.toString());
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Run buyer benchmark
  console.log(`\nRunning benchmark: ${config.buyer}...\n`);
  const startTime = Date.now();
  const result = await runCommand('node', [config.buyer], {
    FACILITATOR_URL: config.facilitatorUrl
  });
  const endTime = Date.now();

  // Kill seller server
  console.log('\nStopping seller server...');
  if (sellerProc.pid) {
    try {
      process.kill(-sellerProc.pid, 'SIGTERM');
    } catch (e) {
      // Ignore errors
    }
  }
  await killProcessOnPort(4021);

  // Parse results
  const parsedResults = parseTestResults(result.stdout);
  parsedResults.benchmarkDuration = ((endTime - startTime) / 1000).toFixed(2);
  parsedResults.facilitator = config.name;

  return {
    config,
    results: parsedResults,
    output: result.stdout
  };
}

async function generateComparativeAnalysis(benchmarkResults) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('COMPARATIVE ANALYSIS');
  console.log(`${'='.repeat(80)}\n`);

  const analysis = {
    timestamp: new Date().toISOString(),
    facilitators: [],
    comparison: {}
  };

  // Summary table
  console.log('Overall Performance Summary:');
  console.log('-'.repeat(80));
  console.log(`${'Facilitator'.padEnd(30)} | ${'Success'.padEnd(8)} | ${'Failed'.padEnd(8)} | ${'Avg Time/TX'.padEnd(12)} | ${'Success Rate'}`);
  console.log('-'.repeat(80));

  benchmarkResults.forEach(({ config, results }) => {
    const totalTx = results.successfulTransactions + results.failedTransactions;
    const successRate = ((results.successfulTransactions / totalTx) * 100).toFixed(2);

    console.log(
      `${config.name.padEnd(30)} | ${results.successfulTransactions.toString().padEnd(8)} | ${results.failedTransactions.toString().padEnd(8)} | ${(results.averageTimePerTransaction + 's').padEnd(12)} | ${successRate}%`
    );

    analysis.facilitators.push({
      name: config.name,
      url: config.facilitatorUrl,
      successfulTransactions: results.successfulTransactions,
      failedTransactions: results.failedTransactions,
      totalTime: results.totalTime,
      averageTimePerTransaction: results.averageTimePerTransaction,
      successRate: successRate + '%',
      tests: results.tests
    });
  });

  console.log('-'.repeat(80));

  // Detailed comparison
  console.log('\n\nDetailed Test Results by Configuration:');
  console.log('='.repeat(80));

  const testConfigs = benchmarkResults[0].results.tests.map(t => `${t.wallets}W-${t.delay}ms`);

  testConfigs.forEach((configName, idx) => {
    console.log(`\nTest: ${configName}`);
    console.log('-'.repeat(80));
    console.log(`${'Facilitator'.padEnd(30)} | ${'Success'.padEnd(8)} | ${'Failed'.padEnd(8)} | ${'Time'.padEnd(8)} | ${'Rate'}`);
    console.log('-'.repeat(80));

    benchmarkResults.forEach(({ config, results }) => {
      const test = results.tests[idx];
      if (test) {
        console.log(
          `${config.name.padEnd(30)} | ${test.successful.toString().padEnd(8)} | ${test.failed.toString().padEnd(8)} | ${(test.time + 's').padEnd(8)} | ${test.successRate}`
        );
      }
    });
  });

  // Performance ranking
  console.log('\n\nPerformance Rankings:');
  console.log('='.repeat(80));

  const bySuccessRate = [...analysis.facilitators].sort((a, b) =>
    parseFloat(b.successRate) - parseFloat(a.successRate)
  );

  console.log('\n1. By Success Rate:');
  bySuccessRate.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name}: ${f.successRate}`);
  });

  const bySpeed = [...analysis.facilitators].sort((a, b) =>
    parseFloat(a.averageTimePerTransaction) - parseFloat(b.averageTimePerTransaction)
  );

  console.log('\n2. By Speed (Average Time per Transaction):');
  bySpeed.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name}: ${f.averageTimePerTransaction}s`);
  });

  const byThroughput = [...analysis.facilitators].sort((a, b) =>
    b.successfulTransactions - a.successfulTransactions
  );

  console.log('\n3. By Throughput (Total Successful Transactions):');
  byThroughput.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name}: ${f.successfulTransactions} transactions`);
  });

  // Recommendations
  console.log('\n\nRecommendations:');
  console.log('='.repeat(80));

  const bestSuccess = bySuccessRate[0];
  const fastestSpeed = bySpeed[0];
  const bestThroughput = byThroughput[0];

  console.log(`\n✓ Most Reliable: ${bestSuccess.name} (${bestSuccess.successRate} success rate)`);
  console.log(`✓ Fastest: ${fastestSpeed.name} (${fastestSpeed.averageTimePerTransaction}s per transaction)`);
  console.log(`✓ Highest Throughput: ${bestThroughput.name} (${bestThroughput.successfulTransactions} successful transactions)`);

  if (bestSuccess.name === fastestSpeed.name && bestSuccess.name === bestThroughput.name) {
    console.log(`\n🏆 Overall Winner: ${bestSuccess.name} - Best in all categories!`);
  } else {
    console.log(`\n📊 Different facilitators excel in different areas. Choose based on your priority:`);
    console.log(`   - For reliability: ${bestSuccess.name}`);
    console.log(`   - For speed: ${fastestSpeed.name}`);
    console.log(`   - For high volume: ${bestThroughput.name}`);
  }

  // Save to file
  const reportPath = path.join(process.cwd(), `benchmark_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
  console.log(`\n\n📄 Full report saved to: ${reportPath}`);

  return analysis;
}

async function main() {
  console.log('🚀 Starting X402 Facilitator Benchmark Suite\n');
  console.log('This will test three facilitators:');
  BENCHMARK_CONFIGS.forEach((config, i) => {
    console.log(`  ${i + 1}. ${config.name} (${config.facilitatorUrl})`);
  });
  console.log('\n');

  const allResults = [];

  for (let i = 0; i < BENCHMARK_CONFIGS.length; i++) {
    try {
      const result = await runBenchmark(BENCHMARK_CONFIGS[i], i);
      allResults.push(result);

      // Wait between benchmarks
      if (i < BENCHMARK_CONFIGS.length - 1) {
        console.log('\nWaiting 10 seconds before next benchmark...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.error(`Error running benchmark ${i + 1}:`, error);
    }
  }

  // Generate comparative analysis
  await generateComparativeAnalysis(allResults);

  console.log('\n✅ All benchmarks completed!\n');
  process.exit(0);
}

main().catch(console.error);

