/**
 * Async Settlement Test Server
 * 
 * This script tests the async settlement middleware from x402-express.
 * 
 * IMPORTANT: To use the local async middleware changes:
 * 1. Make sure you're on the feature/async-settlement branch
 * 2. Build the x402-express package:
 *    cd ../../typescript/packages/x402-express && npm run build
 * 3. Then run this script: npm run start:seller:async
 * 
 * Verification: Look for "[x402-express] Payment settled successfully" logs
 * that appear AFTER the "Resource delivered" log - this confirms async behavior.
 */
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

const FACILITATOR_URL = "https://x402-amoy.polygon.technology";
const RECEIVING_WALLET = "0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00";

console.log("=".repeat(80));
console.log("🚀 X402 Async Settlement Test Server");
console.log("=".repeat(80));
console.log(`📍 Facilitator URL: ${FACILITATOR_URL}`);
console.log(`💰 Receiving Wallet: ${RECEIVING_WALLET}`);
console.log(`🌐 Network: polygon-amoy`);
console.log(`💵 Price: $0.001 USDC`);
console.log(`⚡ Settlement: Async (after resource delivery)`);
console.log(`\n💡 Note: This server uses the async settlement middleware.`);
console.log(`   Settlement happens AFTER the resource is served (non-blocking).`);
console.log(`   Look for "[x402-express] Payment settled successfully" logs.`);
console.log("=".repeat(80) + "\n");

app.use(express.json());

app.use(paymentMiddleware(
  RECEIVING_WALLET,
  {
    "GET /test": {
      price: "$0.001",
      network: "polygon-amoy",
      config: {
        description: "Async settlement latency test endpoint",
        outputSchema: {
          type: "object",
          properties: {
            message: { type: "string" },
            timestamp: { type: "number" }
          }
        }
      }
    },
  },
  {
    url: FACILITATOR_URL,
  }
));

// Track request timing
let requestCount = 0;

// Implement the test route
app.get("/test", (req, res) => {
  requestCount++;
  const requestStart = Date.now();

  const responseData = {
    message: "Async settlement test successful",
    timestamp: Date.now(),
    requestNumber: requestCount,
  };

  // Send response immediately (settlement happens async after this)
  res.json(responseData);

  const resourceDeliveryTime = Date.now() - requestStart;
  console.log(`📦 Request #${requestCount}: Resource delivered in ${resourceDeliveryTime}ms`);
  console.log(`   ⚡ Settlement happening async (check logs below for "[x402-express] Payment settled")`);

  // Note: If you see settlement logs appearing AFTER this log, that confirms async behavior
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    facilitator: FACILITATOR_URL,
    settlementMode: "async"
  });
});

const PORT = 4022;
app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
  console.log(`📡 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n💡 Settlement logs will appear below after each request completes.\n`);
});
