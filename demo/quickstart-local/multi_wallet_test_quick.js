import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

// Wallet configurations
const wallets = [
  {
    address: '0x48c83C7DE03D2019C5465059d3b611F89A23cAe8',
    privateKey: '5abb4ecc577b9be46412b6e247ca2e5f2ed793ace48d21e5d3d2de4827da608e'
  },
  {
    address: '0x744eC296Ba22E8296Ae5a83E0f3f0057f7E10Be3',
    privateKey: 'cdc8af8f37b38684f8f18a2266b6e701174f0f331b97f08184393ea92de43c40'
  }
];

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402-amoy.polygon.technology";
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

    console.log(`[Wallet ${id}] Starting payment...`);
    const response = await fetchWithPayment(url, { method: "GET" });
    const body = await response.json();

    if (body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
      console.log(`[Wallet ${id}] ✓ Success - TX: ${paymentResponse.transaction}`);
      return { success: true, id, wallet: wallet.address, txHash: paymentResponse.transaction };
    }

    console.log(`[Wallet ${id}] ✗ Failed - No payment response`);
    return { success: false, id, wallet: wallet.address, error: 'No payment response' };
  } catch (error) {
    console.log(`[Wallet ${id}] ✗ Error: ${error.message}`);
    return { success: false, id, wallet: wallet.address, error: error.message };
  }
}

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
  console.log(`Total time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
  console.log('Successful transactions:', finalResults.filter(r => r.success).length);
  console.log('Failed transactions:', finalResults.filter(r => r.success).length);

  return finalResults;
}

async function runAllTests() {
  console.log('\n=== Polygon x402 Facilitator Benchmark ===');
  await runTest(2, 1000);
  await delay(3000);
  await runTest(2, 2000);
}

runAllTests().then(() => {
  console.log('\nBenchmark completed!');
});

