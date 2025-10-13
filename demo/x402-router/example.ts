/**
 * Example usage of @polygon/x402-router
 * 
 * This demonstrates how to use the router SDK as a drop-in replacement
 * for hardcoded facilitator URLs
 */

import { facilitator } from './src';

// Example 1: Monitor health changes
facilitator.on('health-changed', ({ url, healthy, status }) => {
  console.log(`\n🔔 Health Alert: ${url}`);
  console.log(`   Status: ${healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  console.log(`   Latency: ${status.lastLatencyMs}ms`);
  console.log(`   Failures: ${status.consecutiveFailures}`);
  console.log(`   Success Rate: ${status.totalRequests > 0
    ? ((status.successfulRequests / status.totalRequests) * 100).toFixed(2)
    : 0}%`);
});

// Example 2: Get current health status
async function checkHealth() {
  console.log('\n📊 Current Health Status:\n');
  const health = facilitator.getHealth();

  for (const [url, status] of Object.entries(health)) {
    console.log(`${status.isHealthy ? '✅' : '❌'} ${url}`);
    console.log(`   Latency: ${status.lastLatencyMs}ms`);
    console.log(`   Requests: ${status.successfulRequests}/${status.totalRequests}`);
    console.log(`   Last check: ${new Date(status.lastCheckTime).toISOString()}`);
    console.log();
  }
}

// Example 3: Get aggregate metrics
async function showMetrics() {
  console.log('\n📈 Aggregate Metrics:\n');
  const metrics = facilitator.getMetrics();

  console.log(`Total Requests: ${metrics.totalRequests}`);
  console.log(`Successful: ${metrics.successfulRequests}`);
  console.log(`Success Rate: ${metrics.successRate}%`);
  console.log(`Average Latency: ${metrics.averageLatency}ms`);
  console.log(`Healthy Facilitators: ${metrics.healthyCount}`);
  console.log(`Unhealthy Facilitators: ${metrics.unhealthyCount}`);
}

// Example 4: Make a test request (requires actual facilitator to be up)
async function testRequest() {
  try {
    console.log('\n🚀 Testing request to facilitator...\n');

    // This would normally be called with real payment payload
    // For demo, just call supported endpoint
    const supported = await facilitator.supported();
    console.log('✅ Request successful!');
    console.log('Supported:', JSON.stringify(supported, null, 2));
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
  }
}

// Run the examples
async function main() {
  console.log('🎯 x402 Facilitator Router - Example Usage');
  console.log('==========================================\n');

  // Wait a bit for initial health checks
  console.log('Waiting for initial health checks...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  await checkHealth();
  await showMetrics();
  await testRequest();

  // Keep running to show health changes
  console.log('\n⏳ Monitoring health changes (press Ctrl+C to exit)...\n');

  // Periodically show metrics
  setInterval(async () => {
    await showMetrics();
  }, 30000); // Every 30 seconds
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  facilitator.shutdown();
  process.exit(0);
});

// Run the demo
main().catch(error => {
  console.error('Fatal error:', error);
  facilitator.shutdown();
  process.exit(1);
});

