import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

// Wallet configurations
const wallets = [
  {
    address: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00',
    privateKey: 'c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9'
  },
  {
    address: '0x48c83C7DE03D2019C5465059d3b611F89A23cAe8',
    privateKey: '5abb4ecc577b9be46412b6e247ca2e5f2ed793ace48d21e5d3d2de4827da608e'
  },
  {
    address: '0x744eC296Ba22E8296Ae5a83E0f3f0057f7E10Be3',
    privateKey: 'cdc8af8f37b38684f8f18a2266b6e701174f0f331b97f08184393ea92de43c40'
  }
];

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.polygon.technology";
const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';

async function makeRequest(wallet, id) {
  try {
    const account = privateKeyToAccount(`0x${wallet.privateKey}`);
    const client = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http()
    });

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);

    console.log(`[Wallet ${id}] Starting request from ${wallet.address}`);
    const response = await fetchWithPayment(url, {
      method: "GET",
    });

    const body = await response.json();
    console.log(`[Wallet ${id}] Response body:`, body);

    if (body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
      console.log(`[Wallet ${id}] Payment confirmed:`, paymentResponse);
      return { success: true, id, wallet: wallet.address, txHash: paymentResponse.transaction };
    }
    return { success: false, id, wallet: wallet.address, error: 'No payment response' };
  } catch (error) {
    console.error(`[Wallet ${id}] Error:`, error.message);
    return { success: false, id, wallet: wallet.address, error: error.message };
  }
}

// Function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTest(numWallets, delayMs) {
  console.log(`\nRunning test with ${numWallets} wallets and ${delayMs}ms delay`);
  console.log('=====================================');

  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < numWallets; i++) {
    if (i > 0) await delay(delayMs);
    const wallet = wallets[i];
    const result = makeRequest(wallet, i + 1);
    results.push(result);
  }

  const finalResults = await Promise.all(results);
  const endTime = Date.now();

  console.log('\nResults Summary:');
  console.log('================');
  console.log(`Total time: ${(endTime - startTime) / 1000} seconds`);
  console.log('Successful transactions:', finalResults.filter(r => r.success).length);
  console.log('Failed transactions:', finalResults.filter(r => !r.success).length);

  finalResults.forEach(result => {
    if (result.success) {
      console.log(`Wallet ${result.id} (${result.wallet}): Success - TX: ${result.txHash}`);
    } else {
      console.log(`Wallet ${result.id} (${result.wallet}): Failed - ${result.error}`);
    }
  });

  return finalResults;
}

// Run tests with different configurations
async function runAllTests() {
  // Test with 2 wallets
  console.log('\n=== Testing with 2 Wallets ===');
  await runTest(2, 500);  // 500ms delay
  await delay(5000);      // Wait between test sets
  await runTest(2, 1000); // 1s delay
  await delay(5000);
  await runTest(2, 2000); // 2s delay

  await delay(10000);     // Longer wait before 3-wallet tests

  // Test with 3 wallets
  console.log('\n=== Testing with 3 Wallets ===');
  await runTest(3, 500);  // 500ms delay
  await delay(5000);
  await runTest(3, 1000); // 1s delay
  await delay(5000);
  await runTest(3, 2000); // 2s delay
}

// Run all tests
console.log('Starting multi-wallet concurrent transaction tests...');
runAllTests().then(() => {
  console.log('\nAll tests completed!');
});
