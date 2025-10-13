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

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402-amoy.polygon.technology";

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';

console.log(`\n🔄 Requesting: ${url}\n`);

fetchWithPayment(url, {
  method: "GET",
})
  .then(async response => {
    console.log(`\n✅ Response status: ${response.status}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

    const body = await response.json();
    console.log('\n📦 Response body:', JSON.stringify(body, null, 2));

    // Check if we got the actual weather data or a 402 error
    if (response.status === 402) {
      console.log('\n❌ Payment failed - still getting 402 response');
      console.log('This means the payment was not successful');
    } else if (body.report) {
      console.log('\n✅ Payment successful! Got weather data');
      const rawPaymentResponse = response.headers.get("x-payment-response");
      console.log('Raw x-payment-response:', rawPaymentResponse);

      try {
        const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
        console.log('Decoded payment response:', paymentResponse);
      } catch (e) {
        console.error('Error decoding payment response:', e);
        console.error('Failed to decode response:', rawPaymentResponse);
      }
    }
  })
  .catch(async error => {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      try {
        const text = await error.response.text();
        console.error('Response text:', text);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      } catch (e) {
        console.error('Error reading response:', e);
        console.error('Raw error:', error);
      }
    } else {
      console.error('Raw error:', error);
    }
  });

