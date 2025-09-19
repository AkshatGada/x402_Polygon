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
docker run --rm -d --name facilitator \
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

## Endpoints

The facilitator exposes the following HTTP endpoints. Use these to verify, settle, and probe health/status.

- **GET `/supported`**
  - Purpose: advertise supported networks and schemes.
  - Response: JSON `{ networks: [{ name: 'polygon-amoy', chainId: 80002, schemes: ['exact'] }] }`.

- **POST `/verify`**
  - Purpose: validate a payment payload's chain, validity window, nonce replay, and signature.
  - Input: a base64-encoded JSON payment payload supplied either as the JSON body field `paymentPayloadBase64` or the HTTP header `x-payment`.
  - Behavior: decodes payload → checks `chainId===80002`, `validAfter`/`validBefore`, and verifies signature (EIP‑712 typed-data then fallback to raw hash). Does not mark nonce used (nonce is marked only on `/settle`).
  - Success response: `200 { success: true }`.
  - Failure response: `400 { success: false, errors: [...] }` with errors like `invalid_chain`, `not_yet_valid`, `expired`, `nonce_replay`, `signature_mismatch`, `signature_verification_failed`.

- **POST `/settle`**
  - Purpose: perform settlement for a verified payment payload and (optionally) broadcast an on-chain transaction.
  - Input: same as `/verify` (body `paymentPayloadBase64` or header `x-payment`).
  - Behavior: checks for nonce replay, marks nonce used (in-memory), and if `REAL_SETTLE=true` *and* `AMOY_RPC_URL` and `FACILITATOR_PRIVATE_KEY` are set, calls the token's `transferWithAuthorization` (EIP-3009) on `AMOY_USDC_ADDRESS`. The token ABI used includes `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)`.
  - Success response: `200 { success: true, transaction: <txHash|null> }`. The response is also encoded and set in the `X-PAYMENT-RESPONSE` header as base64(JSON) containing `{ success, transaction, network, payer }`.
  - Failure response: `500 { success: false, errors: [...] }` for RPC/settle errors.

- **GET `/healthz`**
  - Purpose: simple uptime/monitoring check.
  - Response: `200 { ok: true }`.

Notes:
- The in-memory nonce store is not persistent; restart will clear used-nonces. For production, use a persistent store like Redis or a DB.
- Always run the facilitator behind TLS when exposing publicly. Use a reverse proxy (Caddy/nginx) for certs and TLS termination.

## Step 4: Test the Payment Flow

### Test Without Payment Header

Make a request without the `X-PAYMENT` header to verify the 402 response:

```bash
curl -X POST http://localhost:8080/premium/summarize
```

**Expected Response:** HTTP 402 with payment acceptance details.

### Test With Payment Header

Use a demo client or construct a valid `X-PAYMENT` header to complete the payment flow and access the protected resource.

## Step 5: Enable Real Settlement

For production or testing with actual blockchain transactions:

1. **Enable real settlement:**
   ```bash
   docker run --rm -d --name facilitator \
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

## Tests

You can run the smoke tests and integration test suite to verify the published Docker image and endpoints.

- Smoke tests (quick): pull and run the container, then curl the endpoints:

```bash
docker pull ghcr.io/akshatgada/x402-facilitator-amoy:latest
docker run --rm -d --name facilitator-test -e FACILITATOR_PRIVATE_KEY="<KEY>" -e AMOY_RPC_URL="<RPC>" -e AMOY_USDC_ADDRESS="<ADDR>" -e REAL_SETTLE=false -p 5401:5401 ghcr.io/akshatgada/x402-facilitator-amoy:latest
curl http://localhost:5401/healthz
curl http://localhost:5401/supported
```

- Automated test suite (recommended): tests are located in `demo/tests/facilitator`. Install Node dev deps at repo root (`npm install` or `pnpm`) and run:

```bash
cd demo
node ./tests/facilitator/run-tests.js
```

The test suite performs requests against `http://localhost:5401` and validates `/supported`, `/verify`, `/settle`, and `/healthz` behavior. It uses a local unsigned test payload for negative/positive assertions.

Note: the test runner does not broadcast real transactions; `REAL_SETTLE` should be `false` during tests unless you intentionally want on-chain effects.