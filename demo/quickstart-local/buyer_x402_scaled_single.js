import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY not set in .env file");
}

const PAYMENT_CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS;
if (!PAYMENT_CONTRACT_ADDRESS) {
  throw new Error("PAYMENT_CONTRACT_ADDRESS not set in .env file");
}

const account = privateKeyToAccount(`0x${privateKey}`);
const client = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
});

console.log("════════════════════════════════════════════════════════════════");
console.log("🎯 X402-SCALED Single Request Test");
console.log("════════════════════════════════════════════════════════════════");
console.log(`👤 Wallet: ${account.address}`);
console.log(`💳 Payment Contract: ${PAYMENT_CONTRACT_ADDRESS}`);
console.log(`📦 Scheme: exact-scaled (batch settlement)`);
console.log("════════════════════════════════════════════════════════════════");
console.log("");

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const url = 'http://127.0.0.1:4021/weather';

console.log(`📡 Making request to: ${url}`);
console.log("");

const startTime = Date.now();

fetchWithPayment(url, {
  method: "GET",
})
  .then(async response => {
    const elapsedTime = Date.now() - startTime;
    const body = await response.json();

    console.log("════════════════════════════════════════════════════════════════");
    console.log("✅ SUCCESS");
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`⏱️  Response Time: ${elapsedTime}ms`);
    console.log(`HTTP Status: ${response.status}`);
    console.log("");
    console.log("📦 Response Body:");
    console.log(JSON.stringify(body, null, 2));
    console.log("");
    console.log("📋 Response Headers:");
    console.log(JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    if (body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      if (rawPaymentResponse) {
        console.log("");
        console.log("💰 Payment Response:");
        console.log(`Raw: ${rawPaymentResponse.substring(0, 100)}...`);
        try {
          const paymentResponse = decodeXPaymentResponse(rawPaymentResponse);
          console.log(JSON.stringify(paymentResponse, null, 2));
        } catch (e) {
          console.log("Note: Could not decode payment response");
        }
      }
    }
  })
  .catch(async error => {
    const elapsedTime = Date.now() - startTime;
    console.log("════════════════════════════════════════════════════════════════");
    console.log("❌ ERROR");
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`⏱️  Error occurred after: ${elapsedTime}ms`);
    console.error('Error message:', error.message);
    console.log("");
  });

