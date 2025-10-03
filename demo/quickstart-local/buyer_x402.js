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

fetchWithPayment(url, { //url should be something like https://api.example.com/paid-endpoint
  method: "GET",
})
  .then(async response => {
    const body = await response.json();
    console.log('Response body:', body);

    // Only try to decode payment response if we got the weather data (not the 402 response)
    if (body.report) {
      console.log('All response headers:', Object.fromEntries(response.headers.entries()));
      const rawPaymentResponse = response.headers.get("x-payment-response");
      console.log('Raw x-payment-response:', rawPaymentResponse);

      try {
        const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
        console.log('Decoded payment response:', paymentResponse);
      } catch (e) {
        console.error('Error decoding payment response:', e);
        console.error('Failed to decode response:', rawPaymentResponse);
        throw e;
      }
    }
  })
  .catch(async error => {
    console.error('Error:', error.message);
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