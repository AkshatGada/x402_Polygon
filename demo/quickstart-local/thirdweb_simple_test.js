import { wrapFetchWithPayment } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { createWallet } from "thirdweb/wallets";
import { polygon } from "thirdweb/chains";
import 'dotenv/config';

const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';

async function runSimpleTest() {
  try {
    console.log("=".repeat(80));
    console.log("🚀 Starting Thirdweb Simple X402 Test");
    console.log("=".repeat(80));
    console.log(`📍 Target URL: ${url}`);
    console.log(`💰 Wallet: 0xE8646ca92e6dbf8e5e26A6200c713cd93C56CB4c`);
    console.log(`🌐 Network: Polygon Mainnet`);
    console.log("=".repeat(80));
    console.log("");

    // Initialize Thirdweb client
    console.log("1️⃣  Creating Thirdweb client...");
    const client = createThirdwebClient({
      clientId: process.env.THIRDWEB_CLIENT_ID
    });
    console.log("✅ Client created");

    // Create embedded wallet
    console.log("2️⃣  Creating wallet...");
    const wallet = createWallet("embedded");
    console.log("✅ Wallet instance created");

    // Connect wallet
    console.log("3️⃣  Connecting wallet...");
    await wallet.connect({
      client,
      chain: polygon,
      personalWallet: {
        type: "local",
        config: {
          privateKey: "c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9"
        }
      }
    });
    console.log("✅ Wallet connected");

    // Wrap fetch with payment
    console.log("4️⃣  Wrapping fetch with payment capability...");
    const fetchWithPay = wrapFetchWithPayment(fetch, client, wallet);
    console.log("✅ Fetch wrapped");

    // Make initial request to see payment requirements
    console.log("");
    console.log("5️⃣  Making initial request to check payment requirements...");
    const initialResponse = await fetch(url, {
      method: "GET",
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${initialResponse.status}`);
    const initialBody = await initialResponse.json();
    console.log(`   Response:`, JSON.stringify(initialBody, null, 2));

    // Make payment request
    console.log("");
    console.log("6️⃣  Making payment request...");
    const response = await fetchWithPay(url, {
      method: "GET",
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

    const body = await response.json();
    console.log(`   Response body:`, JSON.stringify(body, null, 2));

    if (body.report) {
      console.log("");
      console.log("=".repeat(80));
      console.log("✅ SUCCESS! Payment completed and resource accessed!");
      console.log("=".repeat(80));
      console.log("Weather Report:", body.report);

      const paymentResponse = response.headers.get("x-payment-response");
      if (paymentResponse) {
        console.log("Payment Response Header:", paymentResponse);
      }

      return { success: true };
    } else {
      console.log("");
      console.log("=".repeat(80));
      console.log("❌ FAILED - No weather report in response");
      console.log("=".repeat(80));
      return { success: false, error: 'No report in response' };
    }

  } catch (error) {
    console.error("");
    console.error("=".repeat(80));
    console.error("❌ ERROR OCCURRED");
    console.error("=".repeat(80));
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);

    if (error.response) {
      try {
        console.error("Response status:", error.response.status);
        const errorBody = await error.response.text();
        console.error("Response body:", errorBody);
      } catch (e) {
        console.error("Could not parse error response");
      }
    }

    if (error.cause) {
      console.error("Error cause:", error.cause);
    }

    console.error("Stack trace:", error.stack);
    console.error("=".repeat(80));

    return { success: false, error: error.message };
  }
}

// Run the test
console.log("\n🚀 Initializing Thirdweb X402 Simple Test...\n");
runSimpleTest().then(result => {
  console.log("\n\n📊 Final Result:", result.success ? "✅ SUCCESS" : "❌ FAILED");
  if (result.error) {
    console.log("Error:", result.error);
  }
  process.exit(result.success ? 0 : 1);
});

