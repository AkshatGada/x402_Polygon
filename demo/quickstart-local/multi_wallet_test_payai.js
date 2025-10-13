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

const FACILITATOR_URL = "https://x402-amoy.polygon.technology";
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
    console.log(`[Wallet ${id}] Making request to facilitator...`);

    console.log(`[Wallet ${id}] Sending payment request to ${url}`);
    // First request to get payment requirements
    const initialResponse = await fetch(url, {
      method: "GET",
      headers: {
        'Accept': 'application/json',
        'x-debug': 'true'
      }
    });
    console.log(`[Wallet ${id}] Initial response status:`, initialResponse.status);
    console.log(`[Wallet ${id}] Initial headers:`, Object.fromEntries(initialResponse.headers.entries()));
    const initialBody = await initialResponse.json();
    console.log(`[Wallet ${id}] Initial body:`, JSON.stringify(initialBody, null, 2));

    // Payment request
    console.log(`[Wallet ${id}] Initiating payment...`);
    const response = await fetchWithPayment(url, {
      method: "GET",
      headers: {
        'Accept': 'application/json',
        'x-debug': 'true',
        'x-payment-debug': 'true'
      }
    });

    console.log(`[Wallet ${id}] Response status:`, response.status);
    console.log(`[Wallet ${id}] Response headers:`, Object.fromEntries(response.headers.entries()));

    const body = await response.json();
    console.log(`[Wallet ${id}] Response body:`, body);

    if (body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      console.log(`[Wallet ${id}] Raw payment response:`, rawPaymentResponse);

      const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
      console.log(`[Wallet ${id}] Decoded payment response:`, paymentResponse);
      return { success: true, id, wallet: wallet.address, txHash: paymentResponse.transaction };
    }

    // Enhanced error logging
    console.log(`[Wallet ${id}] Response type:`, body.x402Version ? 'x402' : 'unknown');

    if (body.error) {
      console.log(`[Wallet ${id}] Server error details:`, JSON.stringify(body.error, null, 2));
    }

    if (body.accepts) {
      console.log(`[Wallet ${id}] Payment requirements:`, JSON.stringify(body.accepts, null, 2));
      console.log(`[Wallet ${id}] Required asset:`, body.accepts[0]?.asset);
      console.log(`[Wallet ${id}] Required amount:`, body.accepts[0]?.maxAmountRequired);
      console.log(`[Wallet ${id}] Payment recipient:`, body.accepts[0]?.payTo);
    }

    // Log any debug info
    const debugInfo = response.headers.get("x-debug-info");
    if (debugInfo) {
      console.log(`[Wallet ${id}] Debug info:`, debugInfo);
    }

    return {
      success: false,
      id,
      wallet: wallet.address,
      error: 'No payment response',
      details: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: body
      }
    };
  } catch (error) {
    console.error(`\n[Wallet ${id}] ====== ERROR DETAILS ======`);
    console.error(`[Wallet ${id}] Error type:`, error.constructor.name);
    console.error(`[Wallet ${id}] Error message:`, error.message);
    console.error(`[Wallet ${id}] Error location:`, error.stack?.split('\n')[1]?.trim() || 'Unknown');

    // Log detailed error information
    if (error.response) {
      try {
        console.error(`[Wallet ${id}] Error response status:`, error.response.status);
        console.error(`[Wallet ${id}] Error response headers:`, error.response.headers);
        const errorBody = await error.response.text();
        try {
          // Try to parse as JSON for better formatting
          const jsonBody = JSON.parse(errorBody);
          console.error(`[Wallet ${id}] Error response body:`, JSON.stringify(jsonBody, null, 2));
        } catch {
          console.error(`[Wallet ${id}] Error response body (raw):`, errorBody);
        }
      } catch (e) {
        console.error(`[Wallet ${id}] Could not parse error response:`, e.message);
      }
    }

    // Log cause if available
    if (error.cause) {
      console.error(`[Wallet ${id}] Error cause:`, {
        type: error.cause.constructor.name,
        message: error.cause.message,
        code: error.cause.code,
        stack: error.cause.stack
      });
    }

    // Log stack trace
    console.error(`[Wallet ${id}] Stack trace:`, error.stack);
    console.error(`[Wallet ${id}] ========================`);

    return {
      success: false,
      id,
      wallet: wallet.address,
      error: error.message,
      errorType: error.constructor.name,
      errorDetails: {
        type: error.constructor.name,
        message: error.message,
        cause: error.cause ? {
          type: error.cause.constructor.name,
          message: error.cause.message,
          code: error.cause.code
        } : undefined,
        stack: error.stack
      }
    };
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
