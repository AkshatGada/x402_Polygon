import express from 'express';
import { createThirdwebClient } from "thirdweb";
import { facilitator, settlePayment } from "thirdweb/x402";
import { polygon } from "thirdweb/chains";
import 'dotenv/config';

const app = express();
const port = 4021;

// Server wallet address (funded wallet for mainnet)
const SERVER_WALLET_ADDRESS = '0xE8646ca92e6dbf8e5e26A6200c713cd93C56CB4c';

// Initialize Thirdweb client
const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY
});

// Create facilitator instance
const thirdwebX402Facilitator = facilitator({
  client,
  serverWalletAddress: SERVER_WALLET_ADDRESS,
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
      network: polygon,
      price: "0.01",
      facilitator: thirdwebX402Facilitator,
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
        network: "polygon",
        maxAmountRequired: "0.01",
        payTo: SERVER_WALLET_ADDRESS,
        asset: "0x0000000000000000000000000000000000000000" // Native token
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
console.log("🚀 Thirdweb X402 Seller Server Configuration");
console.log("=".repeat(80));
console.log(`📍 Facilitator: Thirdweb Built-in Facilitator`);
console.log(`💰 Receiving Wallet: ${SERVER_WALLET_ADDRESS}`);
console.log(`🌐 Network: polygon (MAINNET)`);
console.log(`💵 Price: 0.01 MATIC`);
console.log(`🔑 Client ID: ${process.env.THIRDWEB_CLIENT_ID?.substring(0, 10)}...`);
console.log("=".repeat(80));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
