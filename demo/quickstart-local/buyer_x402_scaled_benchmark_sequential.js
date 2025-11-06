import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY not set in .env file");
}

const PAYMENT_CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS;
if (!PAYMENT_CONTRACT_ADDRESS) {
  throw new Error("PAYMENT_CONTRACT_ADDRESS not set in .env file");
}

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10");

const account = privateKeyToAccount(`0x${privateKey}`);
const client = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
});

console.log("═".repeat(80));
console.log(`🎯 X402-SCALED Sequential Benchmark Test - ${BATCH_SIZE} Requests`);
console.log("═".repeat(80));
console.log(`👤 Wallet: ${account.address}`);
console.log(`💳 Payment Contract: ${PAYMENT_CONTRACT_ADDRESS}`);
console.log(`📦 Scheme: X402-SCALED (Batch Settlement)`);
console.log(`📊 Batch Size: ${BATCH_SIZE} requests`);
console.log(`💰 Price per request: $0.001 USDC`);
console.log(`💵 Total cost: $${(BATCH_SIZE * 0.001).toFixed(3)} USDC`);
console.log("═".repeat(80));
console.log("");

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3333";
const SELLER_URL = process.env.SELLER_URL || 'http://localhost:4021';
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
      if (response.status === 402) {
        const body = await response.text();
        throw new Error(`HTTP 402 - Payment required: ${body.substring(0, 200)}`);
      }
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

    console.log(`✅ Request ${requestNumber}: ${requestTime}ms`);

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

async function runBenchmark() {
  console.log(`⏳ Starting sequential benchmark with ${BATCH_SIZE} requests...`);
  console.log("");

  const batchStart = Date.now();
  
  // Make requests sequentially
  for (let i = 1; i <= BATCH_SIZE; i++) {
    await makeRequest(i);
  }
  
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
  console.log("📊 BENCHMARK RESULTS");
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
  console.log(`   Requests/sec: ${(BATCH_SIZE / (metrics.totalTime / 1000)).toFixed(2)}`);
  console.log("");
  console.log(`💰 Cost Analysis:`);
  console.log(`   Cost per request: $0.001 USDC`);
  console.log(`   Total cost for ${BATCH_SIZE} requests: $${(BATCH_SIZE * 0.001).toFixed(3)} USDC`);
  console.log(`   Cost per millisecond: $${((BATCH_SIZE * 0.001) / metrics.totalTime).toFixed(6)} USDC`);
  console.log("");
  
  if (metrics.successful > 0) {
    console.log(`🎯 Batch Settlement Summary:`);
    console.log(`   Cumulative totalValue: ${BATCH_SIZE * 1000} atomic units (${(BATCH_SIZE * 0.001).toFixed(3)} USDC)`);
    console.log(`   Off-chain signature verifications: ${metrics.successful}`);
    console.log(`   Expected on-chain settlements: 1-${Math.ceil(BATCH_SIZE/20)} transactions`);
    console.log(`   Gas savings vs "exact": ~${((metrics.successful - 1) / metrics.successful * 100).toFixed(1)}% fewer transactions`);
  }

  console.log("");
  console.log("═".repeat(80));
  console.log("");

  // Save detailed metrics
  const detailedMetrics = {
    testInfo: {
      scheme: "exact-scaled",
      batchSize: BATCH_SIZE,
      mode: "sequential",
      pricePerRequest: "$0.001",
      totalCost: `$${(BATCH_SIZE * 0.001).toFixed(3)}`,
      paymentContract: PAYMENT_CONTRACT_ADDRESS,
      facilitator: FACILITATOR_URL,
      seller: SELLER_URL,
      timestamp: new Date().toISOString()
    },
    summary: {
      totalRequests: metrics.successful + metrics.failed,
      successful: metrics.successful,
      failed: metrics.failed,
      totalTimeMs: metrics.totalTime,
      avgTimeMs: parseFloat(metrics.avgTime.toFixed(2)),
      minTimeMs: metrics.minTime === Infinity ? 0 : metrics.minTime,
      maxTimeMs: metrics.maxTime,
      requestsPerSecond: parseFloat((BATCH_SIZE / (metrics.totalTime / 1000)).toFixed(2))
    },
    requests: metrics.requests
  };

  return detailedMetrics;
}

// Run the benchmark
runBenchmark()
  .then(metrics => {
    // Don't print JSON for readability
    process.exit(metrics.summary.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

