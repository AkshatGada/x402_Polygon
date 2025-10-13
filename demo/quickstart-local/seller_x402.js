import express from "express";
import { paymentMiddleware } from "x402-express";
// import { facilitator } from "@coinbase/x402"; // For mainnet

const app = express();

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.payai.network";

console.log("=".repeat(80));
console.log("🚀 X402 Seller Server Configuration");
console.log("=".repeat(80));
console.log(`📍 Facilitator URL: ${FACILITATOR_URL}`);
console.log(`💰 Receiving Wallet: 0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00`);
console.log(`🌐 Network: polygon-amoy`);
console.log(`💵 Price: $0.001 USDC`);
console.log("=".repeat(80));

app.use(paymentMiddleware(
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // receiving wallet address
  {  // Route configurations for protected endpoints
    "GET /weather": {
      // USDC amount in dollars
      price: "$0.001",
      network: "polygon-amoy",
      // Optional: Add metadata for better discovery in x402 Bazaar
      config: {
        description: "Get current weather data for any location",
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

// Implement your route
app.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:4021`);
}); 