# Quickstart Local — x402 Polygon Amoy demo

This directory contains seller/buyer scripts to exercise the x402 payment flow locally against the demo facilitator for the Polygon Amoy test network.

- Seller : `seller.js` — a minimal resource server that returns HTTP 402 when no payment is provided, accepts `X-PAYMENT` headers, verifies with the facilitator, and performs settlement in the background.
- Buyer : `buyer.js` — a buyer client that polls the seller for readiness, requests the protected resource, constructs and signs a TransferWithAuthorization payment payload with the buyer key in `demo/.env.local`, and retries the resource with the `X-PAYMENT` header.

Context
-------
x402 is an HTTP-native micropayments protocol. A seller protects a resource by returning HTTP 402 with `accepts` payment requirements. Buyers create signed EIP-3009 TransferWithAuthorization payloads that an on-chain facilitator can verify and optionally execute (settle). The facilitator exposes `/verify` and `/settle` endpoints.

Quickstart (local)
------------------
1. Ensure `demo/.env.local` contains your keys and RPC URLs. We added `QUICKSTART_RESOURCE_URL=http://localhost:8080` so the quickstart scripts can autodetect the seller URL.

2. Start the facilitator (example):

```bash
# from repo root
# make sure REAL_SETTLE=false for local testing unless you want real on-chain txs
docker run --rm -d --name facilitator-test \
  -e FACILITATOR_PRIVATE_KEY="<SETTLER_KEY>" \
  -e AMOY_RPC_URL="<RPC>" \
  -e AMOY_USDC_ADDRESS="<USDC_ADDRESS>" \
  -e REAL_SETTLE=false \
  -p 5401:5401 ghcr.io/akshatgada/x402-facilitator-amoy:latest
```

3. Start the seller and run the buyer quickstart (from this folder):

```bash
cd demo/quickstart-local
node seller.js &
node buyer.js
```

4. The buyer will:
- Poll the seller `/healthz` for readiness.
- Call `POST /premium/summarize` → receive 402 with `accepts`.
- Sign a TransferWithAuthorization payload and retry the request with `X-PAYMENT` header.
- Seller verifies the payload with the facilitator, returns the premium content, and performs settlement in background (which sends the `transferWithAuthorization` call to the chain when `REAL_SETTLE=true`).

## Optional: Use hosted facilitator (requires Warp VPN)

If you don't want to run a local container, a hosted facilitator is available for developers inside the Polygon VPN. This is useful for quick manual tests against a running service.

```bash
# Hosted facilitator (internal URL; accessible via Warp VPN)
FACILITATOR_HOSTED_URL="https://x402-demo.development.polygon.internal"

# Verify health
curl -sS -D - "$FACILITATOR_HOSTED_URL/healthz" | cat

# Inspect supported networks
curl -sS -D - "$FACILITATOR_HOSTED_URL/supported" | cat
```

Notes:
- The hosted demo is reachable only from within Polygon's Warp VPN. Ensure Warp is connected before attempting requests.
- The hosted service behaves the same as the local Docker image and exposes `/supported`, `/verify`, `/settle`, and `/healthz`.
- The hosted instance may be configured differently (for example, `REAL_SETTLE` may be enabled). Use demo credentials and avoid sending production secrets.

Full technical details and flow
-------------------------------
1. Seller exposes `POST /premium/summarize`. If there's no `X-PAYMENT` header the seller returns `HTTP 402` and an `accepts` array that describes payment requirements (scheme `exact`, network `polygon-amoy`, asset address, decimals, payTo address, and maxAmountRequired in atomic units).

2. Buyer creates a `PaymentPayload` matching the exact/EIP-3009 scheme:
- Fields: `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce`, `verifyingContract`, `chainId`, `signature`.
- Buyer signs typed data using EIP-712 / TransferWithAuthorization typed structure.

3. Buyer retries the request with `X-PAYMENT: <base64(JSON PaymentPayload)>` header.

4. Seller receives `X-PAYMENT`, forwards the base64 payload to the facilitator's `/verify` endpoint to validate signature, chainId, time window, and replay protection. If verify fails seller returns 402/400.

5. If verify succeeds, seller returns the premium content immediately to the buyer and initiates settlement by calling facilitator `/settle` (in this repo we run settle in the background to avoid nonce_replay on retry). The facilitator (if `REAL_SETTLE=true`) calls the EIP-3009 token contract `transferWithAuthorization` using the facilitator's private key and RPC endpoint.

6. Facilitator responds with either `{ success: true, transaction: <txHash> }` (on success) or error details. The seller can capture the `X-PAYMENT-RESPONSE` header returned by the facilitator and surface it to the buyer if desired.

Notes and gotchas
-----------------
- Nonce handling: The demo facilitator uses an in-memory nonce store. In production use a persistent store (Redis) to avoid replay on restarts and coordinate between servers.
- For running real on-chain settlement set `REAL_SETTLE=true` and ensure the facilitator account has POL on Amoy.

Files
-----
- `seller.js` — custom demo seller (handles verify/settle flow)
- `buyer.js` — buyer script (axios-only flow)

