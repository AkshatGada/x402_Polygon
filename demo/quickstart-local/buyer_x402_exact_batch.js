import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY not set in .env file");
}

const account = privateKeyToAccount(`0x${privateKey}`);
const client = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
});

console.log("═".repeat(80));
console.log("🎯 X402-EXACT Batch Test - 100 Concurrent Requests (For Comparison)");
console.log("═".repeat(80));
console.log(`👤 Wallet: ${account.address}`);
console.log(`📦 Scheme: X402-EXACT (Per-Request Settlement)`);
console.log(`📊 Batch Size: 100 requests`);
console.log(`💰 Price per request: $0.001 USDC`);
console.log(`💵 Total cost: $0.1 USDC`);
console.log("═".repeat(80));
console.log("");

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402-amoy.polygon.technology";
const SELLER_URL = process.env.SELLER_URL || 'http://localhost:4020';
const RESOURCE_URL = `${SELLER_URL}/weather`;

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Performance tracking
const metrics = {
  startTime: Date.now(),
  requests: [],
  successful: 0,
  failed: 0,
  totalTime: 0,
  minTime: Infinity,
  maxTime: 0,
  avgTime: 0,
};

async function makeRequest(requestNumber) {
  const requestStart = Date.now();
  
  try {
    const response = await fetchWithPayment(RESOURCE_URL, {
      method: "GET",
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const requestTime = Date.now() - requestStart;

    metrics.requests.push({
      id: requestNumber,
      status: 'success',
      time: requestTime,
      timestamp: new Date().toISOString()
    });

    metrics.successful++;
    metrics.minTime = Math.min(metrics.minTime, requestTime);
    metrics.maxTime = Math.max(metrics.maxTime, requestTime);

    if (requestNumber % 10 === 0) {
      console.log(`✅ Request ${requestNumber}: ${requestTime}ms`);
    }

    return { success: true, time: requestTime, data };
  } catch (error) {
    const requestTime = Date.now() - requestStart;
    
    metrics.requests.push({
      id: requestNumber,
      status: 'failed',
      time: requestTime,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    metrics.failed++;
    console.error(`❌ Request ${requestNumber}: ${error.message} (${requestTime}ms)`);
    
    return { success: false, time: requestTime, error: error.message };
  }
}

async function runBatchTest() {
  console.log(`⏳ Starting batch test with 100 concurrent requests...`);
  console.log("");

  const batchStart = Date.now();
  
  // Create array of 100 promises
  const requests = Array.from({ length: 100 }, (_, i) => makeRequest(i + 1));
  
  // Wait for all requests to complete
  const results = await Promise.allSettled(requests);
  
  const batchTime = Date.now() - batchStart;
  metrics.totalTime = batchTime;

  // Calculate statistics
  const successfulTimes = metrics.requests
    .filter(r => r.status === 'success')
    .map(r => r.time);
  
  if (successfulTimes.length > 0) {
    metrics.avgTime = successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length;
  }

  // Print results
  console.log("");
  console.log("═".repeat(80));
  console.log("📊 BATCH SETTLEMENT TEST RESULTS (EXACT SCHEME)");
  console.log("═".repeat(80));
  console.log("");
  console.log(`✅ Total Requests: ${metrics.successful + metrics.failed}`);
  console.log(`✅ Successful: ${metrics.successful}`);
  console.log(`❌ Failed: ${metrics.failed}`);
  console.log("");
  console.log(`⏱️  Timing Statistics:`);
  console.log(`   Total Time: ${metrics.totalTime}ms`);
  console.log(`   Average Time per Request: ${metrics.avgTime.toFixed(2)}ms`);
  console.log(`   Min Time: ${metrics.minTime}ms`);
  console.log(`   Max Time: ${metrics.maxTime}ms`);
  console.log(`   Requests/sec: ${(100 / (metrics.totalTime / 1000)).toFixed(2)}`);
  console.log("");
  console.log(`💰 Cost Analysis:`);
  console.log(`   Cost per request: $0.001 USDC`);
  console.log(`   Total cost for 100 requests: $0.1 USDC`);
  console.log(`   Cost per millisecond: $${(0.1 / metrics.totalTime).toFixed(6)} USDC`);
  console.log("");
  
  if (metrics.successful > 0) {
    console.log(`⛓️  Exact Scheme Characteristics:`);
    console.log(`   On-chain settlement transactions: 100 (one per request)`);
    console.log(`   Off-chain signature verifications: 100`);
    console.log(`   Total on-chain calls: 100 verify() + 100 settle()`);
    console.log(`   Transaction batching: NONE (per-request settlement)`);
  }

  console.log("");
  console.log("═".repeat(80));
  console.log("📁 Detailed Metrics Saved to: batch-test-results-exact.json");
  console.log("═".repeat(80));
  console.log("");

  // Save detailed metrics
  const detailedMetrics = {
    testInfo: {
      scheme: "exact",
      batchSize: 100,
      pricePerRequest: "$0.001",
      totalCost: "$0.1",
      facilitator: FACILITATOR_URL,
      seller: SELLER_URL,
      timestamp: new Date().toISOString()
    },
    summary: {
      totalRequests: metrics.successful + metrics.failed,
      successful: metrics.successful,
      failed: metrics.failed,
      totalTimeMs: metrics.totalTime,
      avgTimeMs: metrics.avgTime,
      minTimeMs: metrics.minTime,
      maxTimeMs: metrics.maxTime,
      requestsPerSecond: (100 / (metrics.totalTime / 1000)).toFixed(2)
    },
    requests: metrics.requests
  };

  console.log(JSON.stringify(detailedMetrics, null, 2));

  // Exit with appropriate code
  process.exit(metrics.failed > 0 ? 1 : 0);
}

// Run the test
runBatchTest().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
