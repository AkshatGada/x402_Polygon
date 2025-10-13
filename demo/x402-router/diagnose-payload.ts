/**
 * Diagnostic: Capture exact payload being sent to facilitator
 */

import { facilitator } from './dist/index.js';

// Wait for initialization
await new Promise(resolve => setTimeout(resolve, 2000));

// Create a mock payment payload (similar to what useFacilitator would send)
const mockPayload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'polygon-amoy',
  payload: {
    signature: '0xmocksignature123',
    authorization: {
      from: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
      to: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
      value: '1000',
      validAfter: '0',
      validBefore: '99999999999',
      nonce: '0x' + Date.now().toString(16)
    }
  }
};

const mockRequirements = {
  scheme: 'exact',
  network: 'polygon-amoy',
  maxAmountRequired: '1000',
  resource: 'http://test.com/resource',
  payTo: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
  asset: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
};

console.log('📤 What router.verify receives:');
console.log('  payload:', JSON.stringify(mockPayload, null, 2));
console.log('  requirements:', JSON.stringify(mockRequirements, null, 2));

console.log('\n🔍 Calling router.verify...\n');

try {
  const result = await facilitator.verify(mockPayload, mockRequirements);
  console.log('✅ Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}

await facilitator.shutdown();
process.exit(0);

