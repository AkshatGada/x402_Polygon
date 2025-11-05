import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402-amoy.polygon.technology";
const NETWORK = "polygon-amoy";

console.log("═".repeat(80));
console.log("🚀 X402-EXACT Seller Server Configuration (For Comparison)");
console.log("═".repeat(80));
console.log(`📍 Facilitator URL: ${FACILITATOR_URL}`);
console.log(`💰 Receiving Wallet: 0x742D35CC6634c0532925A3B844bc0e7595F97D67`);
console.log(`🌐 Network: ${NETWORK}`);
console.log(`💵 Price per request: $0.001 USDC`);
console.log(`📦 Scheme: X402-EXACT (Per-Request Settlement)`);
console.log("═".repeat(80));
console.log("Ready to receive X402-EXACT per-request payments!");
console.log("═".repeat(80));
console.log("");

app.use(paymentMiddleware(
  "0x742D35CC6634c0532925A3B844bc0e7595F97D67", // receiving wallet address
  {  // Route configurations for protected endpoints
    "GET /weather": {
      price: "$0.001",  // USDC amount per request
      network: NETWORK,
      scheme: "exact",  // Use X402-EXACT scheme
      config: {
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
    scheme: "exact",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 4020;
app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
  console.log(`🔗 Protected endpoint: GET http://localhost:${PORT}/weather`);
});
