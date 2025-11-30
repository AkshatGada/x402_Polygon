import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

const privateKey = process.env.PRIVATE_KEY || "c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9";
const account = privateKeyToAccount(`0x${privateKey}`);
const client = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
});

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:4022/test';
const NUM_REQUESTS = parseInt(process.env.NUM_REQUESTS || '5');

console.log("=".repeat(80));
console.log("🧪 X402 Async Settlement Latency Test");
console.log("=".repeat(80));
console.log(`📍 Server URL: ${SERVER_URL}`);
console.log(`👛 Wallet: ${account.address}`);
console.log(`🌐 Network: polygon-amoy`);
console.log(`🔢 Number of requests: ${NUM_REQUESTS}`);
console.log("=".repeat(80) + "\n");

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const timings = [];

async function makeRequest(requestNumber) {
  const startTime = Date.now();
  let resourceTime = null;
  let totalTime = null;
  let error = null;
  let status = null;
  
  try {
    const requestStart = Date.now();
    
    const response = await fetchWithPayment(SERVER_URL, {
      method: "GET",
    });
    
    status = response.status;
    const body = await response.json();
    
    resourceTime = Date.now() - requestStart;
    totalTime = Date.now() - startTime;
    
    // Note: Settlement happens async on server side
    // Check server logs for settlement timing
    
    return {
      requestNumber,
      success: true,
      resourceTime,
      totalTime,
      response: body,
      status,
    };
  } catch (err) {
    error = err.message;
    totalTime = Date.now() - startTime;
    
    // Try to get status from error response
    if (err.response) {
      status = err.response.status;
    }
    
    return {
      requestNumber,
      success: false,
      error,
      totalTime,
      status,
    };
  }
}

async function runTests() {
  console.log(`🚀 Starting ${NUM_REQUESTS} requests...\n`);
  
  for (let i = 1; i <= NUM_REQUESTS; i++) {
    const requestStart = Date.now();
    console.log(`📤 Request ${i}/${NUM_REQUESTS}...`);
    
    const result = await makeRequest(i);
    timings.push(result);
    
    if (result.success) {
      console.log(`   ✅ Success - Total: ${result.totalTime}ms | Resource: ${result.resourceTime}ms`);
      console.log(`   📦 Response received immediately (settlement happening async on server)`);
    } else {
      console.log(`   ❌ Failed: ${result.error || `Status ${result.status}`}`);
    }
    
    // Small delay between requests
    if (i < NUM_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Calculate statistics
  const successfulRequests = timings.filter(t => t.success);
  
  if (successfulRequests.length === 0) {
    console.log("\n❌ All requests failed!");
    return;
  }
  
  const totalTimes = successfulRequests.map(t => t.totalTime);
  const resourceTimes = successfulRequests.map(t => t.resourceTime);
  
  const avgTotal = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
  const avgResource = resourceTimes.reduce((a, b) => a + b, 0) / resourceTimes.length;
  const minTotal = Math.min(...totalTimes);
  const maxTotal = Math.max(...totalTimes);
  const minResource = Math.min(...resourceTimes);
  const maxResource = Math.max(...resourceTimes);
  
  console.log("\n" + "=".repeat(80));
  console.log("📊 Latency Test Results");
  console.log("=".repeat(80));
  console.log(`✅ Successful Requests: ${successfulRequests.length}/${NUM_REQUESTS}`);
  console.log(`❌ Failed Requests: ${NUM_REQUESTS - successfulRequests.length}`);
  console.log("\n⏱️  Total Time (verification + resource delivery):");
  console.log(`   Average: ${avgTotal.toFixed(2)}ms`);
  console.log(`   Min: ${minTotal}ms`);
  console.log(`   Max: ${maxTotal}ms`);
  console.log("\n📦 Resource Delivery Time:");
  console.log(`   Average: ${avgResource.toFixed(2)}ms`);
  console.log(`   Min: ${minResource}ms`);
  console.log(`   Max: ${maxResource}ms`);
  console.log("\n⚡ Settlement: Async (happens after response, see server logs)");
  console.log("=".repeat(80));
  
  // Show individual request times
  console.log("\n📋 Individual Request Timings:");
  successfulRequests.forEach(t => {
    console.log(`   Request ${t.requestNumber}: ${t.totalTime}ms total, ${t.resourceTime}ms to resource`);
  });
  
  console.log("\n💡 Note: Settlement happens asynchronously after the response is sent.");
  console.log("   Check server logs for settlement timing information.\n");
}

// Run tests
runTests().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
