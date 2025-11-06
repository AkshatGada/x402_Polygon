import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3333";
const PAYMENT_CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS;
const NETWORK = "polygon-amoy";

if (!PAYMENT_CONTRACT_ADDRESS) {
  console.error("❌ PAYMENT_CONTRACT_ADDRESS not set in environment");
  process.exit(1);
}

console.log("═".repeat(80));
console.log("🚀 X402-SCALED Seller Server Configuration");
console.log("═".repeat(80));
console.log(`📍 Facilitator URL: ${FACILITATOR_URL}`);
console.log(`💰 Receiving Wallet: 0x742D35CC6634c0532925A3B844bc0e7595F97D67`);
console.log(`🌐 Network: ${NETWORK}`);
console.log(`💵 Price per request: $0.001 USDC`);
console.log(`📦 Scheme: X402-SCALED (Batch Settlement)`);
console.log(`💳 Payment Contract: ${PAYMENT_CONTRACT_ADDRESS}`);
console.log("═".repeat(80));
console.log("Ready to receive X402-SCALED batch payments!");
console.log("═".repeat(80));
console.log("");

app.use(paymentMiddleware(
  "0x742D35CC6634c0532925A3B844bc0e7595F97D67", // receiving wallet address
  {  // Route configurations for protected endpoints
    "GET /weather": {
      price: "$0.001",  // USDC amount per request
      network: NETWORK,
      config: {
        scheme: "exact-scaled",  // Use X402-SCALED scheme
        paymentContract: PAYMENT_CONTRACT_ADDRESS,
        maxAmountLockRequired: "100000000",  // 100 USDC
        description: "Get current weather data",
        inputSchema: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" }
          }
        },
        outputSchema: {
          type: "object",
          properties: {
            weather: { type: "string" },
            temperature: { type: "number" }
          }
        }
      }
    },
  },
  {
    url: FACILITATOR_URL,
  }
));

// Implement the weather endpoint
app.get("/weather", (req, res) => {
  res.json({
    report: {
      weather: "sunny",
      temperature: 72,
      location: "San Francisco",
      timestamp: new Date().toISOString()
    },
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    scheme: "exact-scaled",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 4021;
app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
  console.log(`🔗 Protected endpoint: GET http://localhost:${PORT}/weather`);
});
