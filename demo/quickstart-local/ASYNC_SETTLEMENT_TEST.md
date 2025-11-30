# Async Settlement Latency Test

This test suite measures the latency improvement of the async settlement middleware on Polygon Amoy.

## Setup

1. Ensure you have the async middleware changes in `typescript/packages/x402-express`
2. Build the x402-express package:
   ```bash
   cd ../../typescript/packages/x402-express
   npm run build
   cd ../../../demo/quickstart-local
   ```

## Running the Test

### Terminal 1: Start the Seller Server

```bash
npm run start:seller:async
```

The server will start on `http://localhost:4022` and log:
- Request timing for resource delivery
- Settlement timing (async, after response)

### Terminal 2: Run the Latency Test

```bash
npm run test:async
```

Or with custom parameters:

```bash
TEST_SERVER_URL=http://localhost:4022/test NUM_REQUESTS=10 npm run test:async
```

## What Gets Measured

### Client-Side Metrics
- **Total Time**: Time from request start to receiving the resource
- **Resource Delivery Time**: Time to receive the response (includes verification)

### Server-Side Metrics (in server logs)
- **Resource Delivery Time**: Time to serve the resource after verification
- **Settlement Time**: Time to complete settlement (logged after response is sent)

## Expected Behavior

1. **Verification** happens first (blocks until complete)
2. **Resource** is served immediately after verification
3. **Settlement** happens asynchronously in the background (doesn't block response)

## Key Differences from Sync Settlement

| Aspect | Sync Settlement | Async Settlement |
|--------|----------------|------------------|
| Response Time | Verification + Settlement + Resource | Verification + Resource |
| X-PAYMENT-RESPONSE Header | Included | Not included |
| Settlement Failure | Returns 402 error | Logged only |
| Client Impact | Blocks until settlement | No blocking |

## Example Output

### Server Logs
```
📦 Request #1: Resource delivered in 245ms
   ⚡ Settlement will happen async (check logs below)
[x402-express] Payment settled successfully: {
  payer: '0x...',
  resource: 'http://localhost:4022/test',
  network: 'polygon-amoy',
  settlementTime: '312ms'
}
```

### Client Logs
```
📤 Request 1/5...
   ✅ Success - Total: 245ms | Resource: 245ms
   📦 Response received immediately (settlement happening async on server)

📊 Latency Test Results
✅ Successful Requests: 5/5
⏱️  Total Time (verification + resource delivery):
   Average: 248.50ms
   Min: 230ms
   Max: 275ms
```

## Configuration

- **Facilitator URL**: `https://x402-amoy.polygon.technology`
- **Network**: `polygon-amoy`
- **Price**: `$0.001 USDC`
- **Receiving Wallet**: `0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00`
- **Test Wallet**: Uses `PRIVATE_KEY` from `.env` or default test key

## Troubleshooting

1. **Server not starting**: Make sure port 4022 is available
2. **Settlement errors**: Check facilitator URL and network connectivity
3. **No settlement logs**: Settlement only logs if `X402_LOG_SETTLEMENT` is not set to `"false"`

