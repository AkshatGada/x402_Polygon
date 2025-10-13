import express from "express";
import { paymentMiddleware } from "x402-express";
// Import the facilitator router instead of using hardcoded URL
import { facilitator } from "../x402-router/dist/index.js";

const app = express();

console.log("🚀 Starting seller with x402-router...\n");

// Monitor facilitator health
facilitator.on('health-changed', ({ url, healthy }) => {
  console.log(`🔔 Facilitator health changed: ${url} is now ${healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
});

// Log initial health status
setTimeout(() => {
  console.log("\n📊 Initial Facilitator Health:");
  const health = facilitator.getHealth();
  Object.entries(health).forEach(([url, status]) => {
    console.log(`  ${status.isHealthy ? '✅' : '❌'} ${url} - ${status.lastLatencyMs}ms`);
  });
  console.log();
}, 3000);

// Wait for router to initialize its proxy server before setting up routes
setTimeout(() => {
  console.log(`✅ Router proxy server running at: ${facilitator.url}\n`);

  // Use the facilitator router's URL
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
    { url: facilitator.url }  // ← Using router's proxy URL!
  ));

  // Implement your route
  app.get("/weather", (req, res) => {
    console.log("📡 Serving weather data request...");
    res.send({
      report: {
        weather: "sunny",
        temperature: 70,
      },
    });
  });

  app.listen(4021, () => {
    console.log(`✅ Server listening at http://localhost:4021`);
    console.log(`🔄 Using x402-router with automatic failover and load balancing`);
    console.log(`\nReady to accept payments!\n`);
  });
}, 2000);

// Show metrics every 30 seconds
setInterval(() => {
  const metrics = facilitator.getMetrics();
  console.log("\n📈 Router Metrics:");
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Success Rate: ${metrics.successRate}%`);
  console.log(`  Average Latency: ${metrics.averageLatency}ms`);
  console.log(`  Healthy Facilitators: ${metrics.healthyCount}/${metrics.healthyCount + metrics.unhealthyCount}`);
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await facilitator.shutdown();
  process.exit(0);
});
