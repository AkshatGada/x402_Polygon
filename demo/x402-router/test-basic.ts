/**
 * Basic functionality test for x402-router
 */

import { facilitator, FacilitatorRouter } from './src';

console.log('🧪 Running Basic Functionality Tests\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return async () => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ PASS: ${name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${name}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ERROR: ${name} - ${error.message}`);
      failed++;
    }
  };
}

async function runTests() {
  // Test 1: Singleton instance exists
  await test('Singleton facilitator instance exists', () => {
    return facilitator !== undefined && facilitator !== null;
  })();

  // Test 2: Can create custom router instance
  await test('Can create custom FacilitatorRouter instance', () => {
    const customRouter = new FacilitatorRouter({
      healthCheckInterval: 15000,
      requestTimeout: 3000
    });
    return customRouter !== undefined;
  })();

  // Test 3: getHealth() returns object
  await test('getHealth() returns health status object', () => {
    const health = facilitator.getHealth();
    return typeof health === 'object' && health !== null;
  })();

  // Test 4: getMetrics() returns metrics
  await test('getMetrics() returns aggregate metrics', () => {
    const metrics = facilitator.getMetrics();
    return (
      typeof metrics.totalRequests === 'number' &&
      typeof metrics.successRate === 'number' &&
      typeof metrics.healthyCount === 'number'
    );
  })();

  // Test 5: Health checker running
  await test('Health checker has recorded checks', async () => {
    // Wait a bit for health checks
    await new Promise(resolve => setTimeout(resolve, 2000));
    const health = facilitator.getHealth();
    const urls = Object.keys(health);
    return urls.length > 0 && health[urls[0]].lastCheckTime > 0;
  })();

  // Test 6: Facilitators are healthy
  await test('At least one facilitator is healthy', () => {
    const metrics = facilitator.getMetrics();
    return metrics.healthyCount > 0;
  })();

  // Test 7: Can call supported endpoint
  await test('Can call supported() endpoint', async () => {
    try {
      const result = await facilitator.supported();
      return result !== undefined && result.kinds !== undefined;
    } catch (error) {
      return false;
    }
  })();

  // Test 8: Metrics update after request
  await test('Metrics update after request', async () => {
    const metricsBefore = facilitator.getMetrics();
    const requestsBefore = metricsBefore.totalRequests;

    try {
      await facilitator.supported();
    } catch (error) {
      // It's ok if request fails, we're testing metrics update
    }

    const metricsAfter = facilitator.getMetrics();
    return metricsAfter.totalRequests > requestsBefore;
  })();

  // Test 9: Event listener works
  await test('Can register event listener', () => {
    let eventReceived = false;
    facilitator.on('health-changed', () => {
      eventReceived = true;
    });
    // Can't test if event fires without waiting, but we can test registration works
    return true;
  })();

  // Test 10: Shutdown works
  await test('Shutdown completes without error', () => {
    try {
      // Don't actually shutdown the main instance
      const tempRouter = new FacilitatorRouter();
      tempRouter.shutdown();
      return true;
    } catch (error) {
      return false;
    }
  })();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests completed: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  facilitator.shutdown();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('\n💥 Fatal test error:', error);
  process.exit(1);
});

