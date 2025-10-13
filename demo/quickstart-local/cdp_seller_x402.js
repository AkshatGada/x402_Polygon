import express from 'express';
import { createThirdwebClient } from "thirdweb";
import { facilitator, settlePayment } from "thirdweb/x402";
import { base } from "thirdweb/chains";
import 'dotenv/config';

const app = express();
const port = 4021;

// Server wallet address (funded wallet for Base)
const SERVER_WALLET_ADDRESS = '0xE8646ca92e6dbf8e5e26A6200c713cd93C56CB4c';

// Initialize CDP client
const client = createThirdwebClient({
  clientId: "b97aa1bd-c513-46ce-b22b-fb293b239b45",
  secretKey: "H+QSPutBxI1R96ygzOrkumrn/VOZWCXcUHPoQjz08LkECV2oebiNg2Lz8ZGRUh5SuPAtkvJm6GuNkZWNUvTSfQ=="
});

// Create facilitator instance
const cdpX402Facilitator = facilitator({
  client,
  serverWalletAddress: SERVER_WALLET_ADDRESS,
  url: "https://api.coinbase.com/x402"
});

// Middleware to handle payment verification
app.use(async (req, res, next) => {
  const paymentData = req.headers["x-payment"];

  if (!paymentData) {
    next();
    return;
  }

  try {
    const result = await settlePayment({
      resourceUrl: `http://localhost:${port}${req.path}`,
      method: req.method,
      paymentData,
      payTo: SERVER_WALLET_ADDRESS,
      network: base,
      price: "0.001",
      facilitator: cdpX402Facilitator,
      routeConfig: {
        description: "Weather data access",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    });

    if (result.status === 200) {
      req.paymentVerified = true;
      next();
    } else {
      res.status(result.status).json(result.responseBody);
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Weather endpoint
app.get('/weather', (req, res) => {
  if (!req.paymentVerified) {
    res.status(402).json({
      x402Version: 1,
      accepts: [{
        scheme: "exact",
        network: "base",
        maxAmountRequired: "1000000000000000", // 0.001 ETH in wei
        payTo: SERVER_WALLET_ADDRESS,
        asset: "0x0000000000000000000000000000000000000000", // Native token (ETH)
        resource: "http://localhost:4021/weather",
        description: "Access to weather data",
        mimeType: "application/json",
        maxTimeoutSeconds: 300
      }]
    });
    return;
  }

  res.json({
    report: {
      temperature: 72,
      conditions: "Sunny"
    }
  });
});

console.log("=".repeat(80));
console.log("🚀 CDP X402 Seller Server Configuration");
console.log("=".repeat(80));
console.log(`📍 Facilitator: CDP X402 (${cdpX402Facilitator.url})`);
console.log(`💰 Receiving Wallet: ${SERVER_WALLET_ADDRESS}`);
console.log(`🌐 Network: Base`);
console.log(`💵 Price: 0.001 ETH`);
console.log(`🔑 Client ID: ${client.clientId?.substring(0, 10)}...`);
console.log("=".repeat(80));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});