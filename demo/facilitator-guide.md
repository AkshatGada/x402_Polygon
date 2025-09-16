# Facilitator — Developer Quick Guide

This document explains how a developer can pull the published facilitator image and run it locally, then configure `x402-express` `paymentMiddleware` to use it.

Prerequisites
- Docker installed locally
- A GHCR (or Docker Hub) image is published: `ghcr.io/<owner-lowercase>/x402-facilitator-amoy:latest`
- A funded facilitator test private key and an Amoy RPC URL (testnet)

1) Pull the image

```bash
# optional: authenticate to GHCR if using a private package
# echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin

docker pull ghcr.io/<owner-lowercase>/x402-facilitator-amoy:latest
```

2) Run the facilitator locally (unsafe for production — for dev only)

```bash
docker run --rm -d --name facilitator-dev \
  -e FACILITATOR_PRIVATE_KEY="<YOUR_FACILITATOR_PRIVATE_KEY>" \
  -e AMOY_RPC_URL="https://your-amoy-rpc" \
  -e AMOY_USDC_ADDRESS="0x..." \
  -e REAL_SETTLE=false \
  -p 5401:5401 \
  ghcr.io/<owner-lowercase>/x402-facilitator-amoy:latest

# check health
curl http://localhost:5401/healthz
```

3) Configure your resource server (x402-express)

Install x402-express in your resource server project and configure the middleware to point to the hosted facilitator (or your local facilitator instance):

```js
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

app.use(paymentMiddleware(
  "0xYourPayToAddress",
  {
    "POST /premium/summarize": {
      price: "$0.01",
      network: "polygon-amoy",
      config: {
        description: "Premium summarize",
      }
    }
  },
  {
    url: "http://localhost:5401" // or https://facilitator.example.com
  }
));

app.post('/premium/summarize', (req, res) => {
  // protected handler — x402-express will have verified the X-PAYMENT
  res.json({ result: 'premium content' });
});

app.listen(8080);
```

4) Test the flow
- Call your resource endpoint without `X-PAYMENT`. It should return 402 with `accepts` describing payment requirements.
- Use the client code in `demo/a2a/client-agent` or craft a signed `X-PAYMENT` header to retry.

5) Enable REAL_SETTLE (broadcast settlement)
- When ready to broadcast real settlement txs on Amoy, set `REAL_SETTLE=true` and ensure `FACILITATOR_PRIVATE_KEY` and `AMOY_RPC_URL` are valid and the facilitator account is funded for gas.

6) Clean up

```bash
docker rm -f facilitator-dev || true
```

Security note
- Never expose private keys or production RPC endpoints in public repositories. Use a secret store or environment variables on the host and keep `demo/.env.local` untracked.

If you want, I can provide a `docker-compose` snippet that starts facilitator + resource server and seeds example env variables for local development. 