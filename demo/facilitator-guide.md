# x402 Facilitator for Polygon Amoy Network

## Overview

The x402 facilitator service enables payment processing for the x402 protocol by handling payment verification and settlement. This guide covers pulling the published Docker image, running it locally, and integrating it with your `x402-express` payment middleware.

## Prerequisites

Before starting, ensure you have:

- **Docker** installed and running locally
- **Funded facilitator private key** for the Amoy testnet
- **Amoy RPC URL** for testnet connectivity
- Basic familiarity with Docker and Node.js development

## Quick Start Summary

For developers who want to get started immediately:

```bash
# 1. Pull the image
docker pull ghcr.io/akshatgada/x402-facilitator-amoy:latest

# 2. Run with your configuration
docker run --rm -d --name facilitator-dev \
  -e FACILITATOR_PRIVATE_KEY="your_private_key" \
  -e AMOY_RPC_URL="https://your-amoy-rpc" \
  -e AMOY_USDC_ADDRESS="0x..." \
  -e REAL_SETTLE=false \
  -p 5401:5401 \
  ghcr.io/akshatgada/x402-facilitator-amoy:latest

# 3. Verify it's running
curl http://localhost:5401/healthz

# 4. Integrate with your Express app using x402-express middleware
```

## Docker Image Details

**Published Image:** `ghcr.io/akshatgada/x402-facilitator-amoy:latest`

**Package Repository:** [https://github.com/AkshatGada/x402_Polygon/pkgs/container/x402-facilitator-amoy](https://github.com/AkshatGada/x402_Polygon/pkgs/container/x402-facilitator-amoy)


## Step 1: Pull the Docker Image

Since the package is public, you can pull it directly without authentication:

```bash
docker pull ghcr.io/akshatgada/x402-facilitator-amoy:latest
```

### Platform Compatibility

If you encounter platform compatibility issues (e.g., ARM64 systems without native support):

```bash
docker pull --platform=linux/amd64 ghcr.io/akshatgada/x402-facilitator-amoy:latest
```

## Step 2: Run the Facilitator Service

Launch the facilitator container with the required environment variables:

```bash
docker run --rm -d --name facilitator-dev \
  -e FACILITATOR_PRIVATE_KEY="<YOUR_FACILITATOR_PRIVATE_KEY>" \
  -e AMOY_RPC_URL="https://your-amoy-rpc" \
  -e AMOY_USDC_ADDRESS="0x..." \
  -e REAL_SETTLE=false \
  -p 5401:5401 \
  ghcr.io/akshatgada/x402-facilitator-amoy:latest
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FACILITATOR_PRIVATE_KEY` | Private key for the facilitator wallet | Yes |
| `AMOY_RPC_URL` | RPC endpoint for Polygon Amoy testnet | Yes |
| `AMOY_USDC_ADDRESS` | USDC contract address on Amoy | Yes |
| `REAL_SETTLE` | Enable actual transaction broadcasting | No (default: false) |

### Verify Service Health

Check that the facilitator is running correctly:

```bash
curl http://localhost:5401/healthz
```

## Step 3: Configure x402-express Integration

Integrate the facilitator with your Express.js application using the `x402-express` middleware:

```javascript
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

// Configure payment middleware
app.use(paymentMiddleware(
  "0xYourPayToAddress",  // Your payment receiving address
  { 
    "POST /premium/summarize": { 
      price: "$0.01", 
      network: "polygon-amoy" 
    } 
  },
  { url: "http://localhost:5401" }  // Local facilitator URL
));

// Protected endpoint
app.post('/premium/summarize', (req, res) => {
  res.json({ result: 'premium content' });
});

app.listen(8080, () => {
  console.log('Server running on port 8080');
});
```

## Step 4: Test the Payment Flow

### Test Without Payment Header

Make a request without the `X-PAYMENT` header to verify the 402 response:

```bash
curl -X POST http://localhost:8080/premium/summarize
```

**Expected Response:** HTTP 402 with payment acceptance details.

### Test With Payment Header

Use a demo client or construct a valid `X-PAYMENT` header to complete the payment flow and access the protected resource.

## Step 5: Enable Production Settlement

For production or testing with actual blockchain transactions:

1. **Enable real settlement:**
   ```bash
   docker run --rm -d --name facilitator-prod \
     -e FACILITATOR_PRIVATE_KEY="<YOUR_FACILITATOR_PRIVATE_KEY>" \
     -e AMOY_RPC_URL="https://your-amoy-rpc" \
     -e AMOY_USDC_ADDRESS="0x..." \
     -e REAL_SETTLE=true \
     -p 5401:5401 \
     ghcr.io/akshatgada/x402-facilitator-amoy:latest
   ```

2. **Ensure wallet funding:** Verify your facilitator wallet has sufficient funds for gas fees and operations.

3. **Validate RPC connectivity:** Confirm your Amoy RPC URL is accessible and responsive.


This guide provides a complete setup for local development and testing with the x402 facilitator. The public package availability makes it easy for any developer to get started without authentication requirements.