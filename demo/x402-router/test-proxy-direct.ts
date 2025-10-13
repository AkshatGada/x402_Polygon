/**
 * Direct test of the proxy server functionality
 */

import { facilitator } from './dist/index.js';

async function testProxy() {
  console.log('🧪 Testing Proxy Server\n');

  // Wait for proxy to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`✅ Proxy URL: ${facilitator.url}\n`);

  if (!facilitator.url) {
    console.error('❌ Proxy server did not start!');
    process.exit(1);
  }

  // Test 1: /supported endpoint
  console.log('📡 Test 1: GET /supported');
  try {
    const response = await fetch(`${facilitator.url}/supported`);
    const data = await response.json();
    console.log('✅ Status:', response.status);
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n---\n');

  // Test 2: /verify endpoint with mock data
  console.log('📡 Test 2: POST /verify');
  try {
    const mockPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'polygon-amoy',
      payload: {
        signature: '0xmock',
        authorization: {
          from: '0x0000000000000000000000000000000000000001',
          to: '0x0000000000000000000000000000000000000002',
          value: '1000',
          validAfter: '0',
          validBefore: '9999999999',
          nonce: '0x' + Date.now().toString(16)
        }
      }
    };

    const mockRequirements = {
      scheme: 'exact',
      network: 'polygon-amoy',
      maxAmountRequired: '1000',
      resource: 'http://test.com/resource',
      payTo: '0x0000000000000000000000000000000000000002',
      asset: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
    };

    const response = await fetch(`${facilitator.url}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: mockPayload,
        paymentRequirements: mockRequirements
      })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);

    if (response.ok) {
      console.log('✅ Proxy successfully forwarded request!');
    } else {
      console.log('⚠️ Facilitator rejected (expected for mock data)');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n---\n');

  // Test 3: Check router metrics
  console.log('📊 Router Metrics:');
  const metrics = facilitator.getMetrics();
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Success Rate: ${metrics.successRate}%`);
  console.log(`  Healthy Facilitators: ${metrics.healthyCount}/${metrics.healthyCount + metrics.unhealthyCount}`);

  await facilitator.shutdown();
  console.log('\n✅ Test complete');
  process.exit(0);
}

testProxy().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

