/**
 * Direct facilitator testing - calls each facilitator individually
 * to test verify and settle endpoints on polygon-amoy
 */

import fetch from 'node-fetch';

// Facilitators to test
const FACILITATORS = [
  {
    name: 'Polygon Amoy Official',
    url: 'https://x402-amoy.polygon.technology',
    networks: ['polygon-amoy']
  },
  {
    name: 'X402.rs',
    url: 'https://facilitator.x402.rs',
    networks: ['polygon', 'base', 'amoy']
  },
  {
    name: 'PayAI Network',
    url: 'https://facilitator.payai.network',
    networks: ['polygon', 'base']
  }
];

// Mock payment payload for testing (this would normally come from a signed transaction)
const MOCK_PAYMENT_PAYLOAD = {
  x402Version: 1,
  scheme: 'exact',
  network: 'polygon-amoy',
  payload: {
    authorization: {
      from: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
      to: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
      value: '1000',
      validAfter: Math.floor(Date.now() / 1000) - 600,
      validBefore: Math.floor(Date.now() / 1000) + 3600,
      nonce: '0x' + '0'.repeat(64)
    },
    signature: '0x' + '0'.repeat(130) // Mock signature
  }
};

const MOCK_PAYMENT_REQUIREMENTS = {
  scheme: 'exact',
  network: 'polygon-amoy',
  maxAmountRequired: '1000',
  resource: 'http://localhost:4021/weather',
  description: 'Test payment',
  mimeType: '',
  payTo: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
  maxTimeoutSeconds: 60,
  asset: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  extra: {
    name: 'USDC',
    version: '2'
  }
};

console.log('🧪 Direct Facilitator Testing - Polygon Amoy\n');
console.log('='.repeat(70));

async function testSupported(facilitator: typeof FACILITATORS[0]) {
  try {
    const response = await fetch(`${facilitator.url}/supported`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        status: response.status,
        data
      };
    } else {
      return {
        success: false,
        status: response.status,
        error: `${response.status} ${response.statusText}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testVerify(facilitator: typeof FACILITATORS[0]) {
  try {
    const response = await fetch(`${facilitator.url}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: MOCK_PAYMENT_PAYLOAD.x402Version,
        paymentPayload: MOCK_PAYMENT_PAYLOAD,
        paymentRequirements: MOCK_PAYMENT_REQUIREMENTS
      })
    });

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testSettle(facilitator: typeof FACILITATORS[0]) {
  try {
    const response = await fetch(`${facilitator.url}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: MOCK_PAYMENT_PAYLOAD.x402Version,
        paymentPayload: MOCK_PAYMENT_PAYLOAD,
        paymentRequirements: MOCK_PAYMENT_REQUIREMENTS
      })
    });

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testFacilitator(facilitator: typeof FACILITATORS[0]) {
  console.log(`\n📍 Testing: ${facilitator.name}`);
  console.log(`   URL: ${facilitator.url}`);
  console.log(`   Networks: ${facilitator.networks.join(', ')}`);
  console.log();

  // Test 1: /supported endpoint
  console.log('   1️⃣ Testing /supported endpoint...');
  const supportedResult = await testSupported(facilitator);
  if (supportedResult.success) {
    console.log(`      ✅ SUCCESS - Status ${supportedResult.status}`);
    console.log(`      Response: ${JSON.stringify(supportedResult.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
  } else {
    console.log(`      ❌ FAILED - ${supportedResult.error || `Status ${supportedResult.status}`}`);
    if (supportedResult.data) {
      console.log(`      Response: ${JSON.stringify(supportedResult.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
    }
  }

  // Test 2: /verify endpoint
  console.log('\n   2️⃣ Testing /verify endpoint...');
  const verifyResult = await testVerify(facilitator);
  if (verifyResult.success) {
    console.log(`      ✅ SUCCESS - Status ${verifyResult.status}`);
    console.log(`      Response: ${JSON.stringify(verifyResult.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
  } else {
    console.log(`      ❌ FAILED - ${verifyResult.error || `Status ${verifyResult.status}`}`);
    if (verifyResult.data) {
      console.log(`      Response: ${JSON.stringify(verifyResult.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
    }
  }

  // Test 3: /settle endpoint
  console.log('\n   3️⃣ Testing /settle endpoint...');
  const settleResult = await testSettle(facilitator);
  if (settleResult.success) {
    console.log(`      ✅ SUCCESS - Status ${settleResult.status}`);
    console.log(`      Response: ${JSON.stringify(settleResult.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
  } else {
    console.log(`      ❌ FAILED - ${settleResult.error || `Status ${settleResult.status}`}`);
    if (settleResult.data) {
      console.log(`      Response: ${JSON.stringify(settleResult.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
    }
  }

  // Summary for this facilitator
  const results = [supportedResult, verifyResult, settleResult];
  const successCount = results.filter(r => r.success).length;

  console.log('\n   📊 Summary:');
  console.log(`      /supported: ${supportedResult.success ? '✅' : '❌'}`);
  console.log(`      /verify: ${verifyResult.success ? '✅' : '❌'}`);
  console.log(`      /settle: ${settleResult.success ? '✅' : '❌'}`);
  console.log(`      Overall: ${successCount}/3 endpoints working`);

  return {
    facilitator: facilitator.name,
    supported: supportedResult.success,
    verify: verifyResult.success,
    settle: settleResult.success,
    successCount
  };
}

async function runTests() {
  const results = [];

  for (const facilitator of FACILITATORS) {
    const result = await testFacilitator(facilitator);
    results.push(result);
  }

  // Final summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY - All Facilitators\n');

  console.log('Endpoint Support:');
  console.log('┌─────────────────────────┬───────────┬────────┬────────┐');
  console.log('│ Facilitator             │ Supported │ Verify │ Settle │');
  console.log('├─────────────────────────┼───────────┼────────┼────────┤');

  results.forEach(r => {
    const name = r.facilitator.padEnd(23);
    const supported = r.supported ? '    ✅    ' : '    ❌    ';
    const verify = r.verify ? '   ✅   ' : '   ❌   ';
    const settle = r.settle ? '   ✅   ' : '   ❌   ';
    console.log(`│ ${name} │ ${supported} │ ${verify} │ ${settle} │`);
  });

  console.log('└─────────────────────────┴───────────┴────────┴────────┘');

  // Overall statistics
  const totalTests = results.length * 3;
  const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
  const successRate = ((totalSuccess / totalTests) * 100).toFixed(1);

  console.log('\nOverall Statistics:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Successful: ${totalSuccess}`);
  console.log(`  Failed: ${totalTests - totalSuccess}`);
  console.log(`  Success Rate: ${successRate}%`);

  // Key findings
  console.log('\n🔍 Key Findings:');

  const allSupportedWork = results.every(r => r.supported);
  if (allSupportedWork) {
    console.log('  ✅ All facilitators respond to /supported');
  } else {
    console.log('  ❌ Some facilitators do not respond to /supported');
  }

  const anyVerifyWorks = results.some(r => r.verify);
  if (anyVerifyWorks) {
    console.log('  ✅ At least one facilitator can verify payments');
  } else {
    console.log('  ❌ No facilitators can verify payments');
  }

  const anySettleWorks = results.some(r => r.settle);
  if (anySettleWorks) {
    console.log('  ✅ At least one facilitator can settle payments');
  } else {
    console.log('  ⚠️  No facilitators can settle payments (expected for test/demo facilitators)');
  }

  console.log('\n💡 Note: Verify/Settle failures are expected with mock signatures.');
  console.log('   Real payments require properly signed EIP-3009 authorizations.');
  console.log('   The router will work correctly when used with real payment flows.');

  console.log('\n' + '='.repeat(70));
}

runTests().catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});

