import express from "express";
import { paymentMiddleware } from "x402-express";
// import { facilitator } from "@coinbase/x402"; // For mainnet

const app = express();

app.use(paymentMiddleware(
  "0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00", // receiving wallet address
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
    url: process.env.FACILITATOR_URL || "https://x402.polygon.technology", // Polygon Amoy facilitator
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