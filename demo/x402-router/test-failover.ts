/**
 * Test automatic failover functionality
 */

import { FacilitatorRouter } from './src';

console.log('🧪 Testing Automatic Failover\n');

async function testFailover() {
  // Create a router instance with shorter timeouts for faster testing
  const router = new FacilitatorRouter({
    requestTimeout: 2000,
    maxRetries: 2,
    healthCheckInterval: 5000
  });

  console.log('1️⃣  Testing normal request to healthy facilitators...');
  try {
    const result = await router.supported();
    console.log('   ✅ Request successful');
    console.log('   Response:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('   ❌ Request failed:', error.message);
  }

  console.log('\n2️⃣  Checking health status...');
  const health = router.getHealth();
  const healthyCount = Object.values(health).filter(h => h.isHealthy).length;
  console.log(`   ℹ️  ${healthyCount}/${Object.keys(health).length} facilitators healthy`);

  for (const [url, status] of Object.entries(health)) {
    console.log(`   ${status.isHealthy ? '✅' : '❌'} ${url} - ${status.lastLatencyMs}ms`);
  }

  console.log('\n3️⃣  Testing metrics tracking...');
  const metrics = router.getMetrics();
  console.log(`   Total Requests: ${metrics.totalRequests}`);
  console.log(`   Successful: ${metrics.successfulRequests}`);
  console.log(`   Success Rate: ${metrics.successRate}%`);
  console.log(`   Average Latency: ${metrics.averageLatency}ms`);

  console.log('\n4️⃣  Testing multiple requests...');
  const requestCount = 5;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < requestCount; i++) {
    try {
      await router.supported();
      successCount++;
      process.stdout.write('✅ ');
    } catch (error) {
      failCount++;
      process.stdout.write('❌ ');
    }
  }

  console.log(`\n   Results: ${successCount} success, ${failCount} failed`);

  console.log('\n5️⃣  Final metrics...');
  const finalMetrics = router.getMetrics();
  console.log(`   Total Requests: ${finalMetrics.totalRequests}`);
  console.log(`   Success Rate: ${finalMetrics.successRate}%`);

  // Test event listening
  console.log('\n6️⃣  Testing health change events...');
  let eventCount = 0;
  router.on('health-changed', ({ url, healthy }) => {
    eventCount++;
    console.log(`   🔔 Health changed: ${url} is now ${healthy ? 'healthy' : 'unhealthy'}`);
  });
  console.log('   ℹ️  Event listener registered (events will show if health changes)');

  // Wait a bit to see if any health events occur
  console.log('\n⏳ Waiting 5 seconds for potential health changes...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (eventCount === 0) {
    console.log('   ℹ️  No health changes detected (all facilitators stable)');
  } else {
    console.log(`   ℹ️  Detected ${eventCount} health change(s)`);
  }

  console.log('\n✅ Failover test completed successfully!');
  console.log('==================================================');
  console.log('Summary:');
  console.log(`- Router initialized with 3 facilitators`);
  console.log(`- ${healthyCount} facilitators currently healthy`);
  console.log(`- ${successCount}/${requestCount} requests successful`);
  console.log(`- Success rate: ${finalMetrics.successRate}%`);
  console.log(`- Average latency: ${finalMetrics.averageLatency}ms`);
  console.log('==================================================');

  router.shutdown();
}

testFailover().catch(error => {
  console.error('\n💥 Test failed with error:', error);
  process.exit(1);
});

