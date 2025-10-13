import { createPaymentHeader } from "x402-fetch";
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

const url = 'http://127.0.0.1:4021/weather';

async function test() {
  // Step 1: Get 402 response
  console.log('\n📡 Step 1: Getting 402 response...');
  const response1 = await fetch(url);
  console.log(`Status: ${response1.status}`);

  if (response1.status !== 402) {
    console.log('❌ Expected 402, got:', response1.status);
    return;
  }

  const body1 = await response1.json();
  console.log('Payment requirements:', body1.accepts[0]);

  // Step 2: Create payment header
  console.log('\n💳 Step 2: Creating payment header...');
  const paymentRequirements = body1.accepts[0];

  try {
    const paymentHeader = await createPaymentHeader(
      client,
      1, // x402Version
      paymentRequirements
    );
    console.log('✅ Payment header created');
    console.log('Header length:', paymentHeader.length);
    console.log('Header preview:', paymentHeader.substring(0, 100) + '...');

    // Step 3: Retry with payment
    console.log('\n🔄 Step 3: Retrying with payment header...');
    const response2 = await fetch(url, {
      headers: {
        'X-PAYMENT': paymentHeader,
        'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE'
      }
    });

    console.log(`Status: ${response2.status}`);
    console.log('Response headers:', Object.fromEntries(response2.headers.entries()));

    const body2 = await response2.json();
    console.log('\n📦 Response body:', JSON.stringify(body2, null, 2));

    if (response2.status === 200 && body2.report) {
      console.log('\n✅ SUCCESS! Payment worked through the router!');
    } else if (response2.status === 402) {
      console.log('\n❌ Still getting 402 - payment verification/settlement failed');
      console.log('Error details:', body2.error);
    }

  } catch (error) {
    console.error('\n❌ Error creating/sending payment:', error);
    console.error('Stack:', error.stack);
  }
}

test().catch(console.error);

