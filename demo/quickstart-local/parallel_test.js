import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY not set in .env file");
}

const account = privateKeyToAccount(`0x${privateKey}`);
const client = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
});

console.log("Using wallet address:", account.address);

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.polygon.technology";
const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

async function makeRequest(id) {
  try {
    console.log(`[${id}] Starting request`);
    console.log(`[${id}] Making request to facilitator for payment verification...`);
    const response = await fetchWithPayment(url, {
      method: "GET",
    });

    console.log(`[${id}] Got response with status:`, response.status);
    console.log(`[${id}] Response headers:`, Object.fromEntries(response.headers.entries()));

    const body = await response.json();
    console.log(`[${id}] Response body:`, body);

    if (body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
      console.log(`[${id}] Payment confirmed:`, paymentResponse);
      return { success: true, id, txHash: paymentResponse.transaction };
    }
    return { success: false, id, error: 'No payment response' };
  } catch (error) {
    console.error(`[${id}] Error:`, error.message);
    return { success: false, id, error: error.message };
  }
}

// Run 5 requests with slight delays
const NUM_REQUESTS = 10;
const DELAY_MS = 0; // No delay - true concurrent requests
console.log(`Starting ${NUM_REQUESTS} requests with ${DELAY_MS}ms delay between them...`);

const startTime = Date.now();

// Function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Run requests with delays
Promise.all(
  Array.from({ length: NUM_REQUESTS }, async (_, i) => {
    await delay(i * DELAY_MS);
    return makeRequest(i + 1);
  })
).then(results => {
  const endTime = Date.now();
  console.log('\nResults Summary:');
  console.log('================');
  console.log(`Total time: ${(endTime - startTime) / 1000} seconds`);
  console.log('Successful transactions:', results.filter(r => r.success).length);
  console.log('Failed transactions:', results.filter(r => !r.success).length);

  results.forEach(result => {
    if (result.success) {
      console.log(`Request ${result.id}: Success - TX: ${result.txHash}`);
    } else {
      console.log(`Request ${result.id}: Failed - ${result.error}`);
    }
  });
});
