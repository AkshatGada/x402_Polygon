# X402-SCALED Test Facilitator

Local test facilitator server for X402-SCALED payment protocol. Provides `/verify` and `/settle` endpoints with full support for:

- EIP-712 signature verification
- Cumulative totalValue tracking (replay prevention)
- Deposit status queries from Polygon Amoy
- Batch settlement via Payment.sol contract

## Quick Start

### Installation

```bash
cd demo/test-facilitator-scaled
npm install
```

### Configuration

Create `.env` file from template:

```bash
cp .env.example .env
```

**Required variables**:
```
PRIVATE_KEY=c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9
WALLET_ADDRESS=0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00
PAYMENT_CONTRACT_ADDRESS=0x...  # From Payment.sol deployment
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

### Start Server

```bash
npm start
# Output: Test Facilitator listening on http://localhost:3333
```

**Development mode with auto-reload**:
```bash
npm run dev
```

## API Endpoints

### GET /health
Health check with storage statistics.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-31T17:30:00.000Z",
  "uptime": 123.45,
  "storage": {
    "clientServerPairs": 5,
    "totalRequests": 150
  }
}
```

### POST /verify
Verify payment signature and replay attack.

**Request**:
```json
{
  "x402Version": 1,
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact-scaled",
    "network": "polygon-amoy",
    "payload": {
      "signature": "0x...",
      "authorization": {
        "from": "0xCA39...",
        "to": "0xServer",
        "totalValue": "1000"
      }
    }
  },
  "paymentRequirements": {
    "scheme": "exact-scaled",
    "network": "polygon-amoy",
    "paymentContract": "0x5678...",
    "payTo": "0xServer",
    "maxAmountRequired": "1000"
  }
}
```

**Response (Valid)**:
```json
{
  "isValid": true,
  "payer": "0xCA39..."
}
```

**Response (Invalid)**:
```json
{
  "isValid": false,
  "invalidReason": "insufficient_deposit",
  "payer": "0xCA39..."
}
```

**Invalid Reasons**:
- `invalid_signature` - EIP-712 signature verification failed
- `totalValue_not_incremental` - Replay attack: totalValue not increasing
- `no_deposit` - Deposit not found on contract
- `deposit_expired` - Deposit has expired
- `insufficient_deposit` - Not enough balance for request
- `deposit_query_failed` - Failed to query Polygon Amoy contract

### POST /settle
Settle verified payment by calling `transferWithAuthorization` on Payment.sol.

**Request**: Same format as `/verify`

**Response (Success)**:
```json
{
  "success": true,
  "transaction": "0xabc123...",
  "network": "polygon-amoy",
  "payer": "0xCA39..."
}
```

**Response (Failed)**:
```json
{
  "success": false,
  "errorReason": "insufficient_deposit",
  "network": "polygon-amoy",
  "payer": "0xCA39..."
}
```

### GET /reset
Clear all stored signatures (for testing).

**Response**:
```json
{
  "status": "storage cleared",
  "timestamp": "2025-10-31T17:30:00.000Z"
}
```

### GET /state
View current storage state (debugging).

**Response**:
```json
{
  "states": {
    "0xca39....:0xserver....": {
      "client": "0xCA39...",
      "server": "0xServer",
      "lastTotalValue": "1000",
      "lastSignature": "0x...",
      "lastVerifiedAt": 1698766200000,
      "requestCount": 5
    }
  },
  "stats": {
    "totalPairs": 1,
    "totalRequests": 5
  }
}
```

## How It Works

### Verification Flow (/verify)

1. **Signature Validation**: Verifies EIP-712 signature against Payment.sol domain
2. **Replay Prevention**: Checks that `totalValue` is strictly greater than last stored value
3. **Deposit Query**: Reads deposit info from Polygon Amoy contract
4. **Coverage Check**: Ensures deposit covers the cumulative payment amount
5. **Expiry Check**: Validates deposit hasn't expired
6. **Storage**: Stores signature state for next request's replay check

**Speed**: ~1ms (all off-chain, one RPC call to Amoy)

### Settlement Flow (/settle)

1. **Verify First**: Runs same verification as `/verify` endpoint
2. **Parse Signature**: Extracts v, r, s components from signature
3. **Submit Transaction**: Calls `Payment.transferWithAuthorization()` on contract
4. **Return Hash**: Returns transaction hash (settlement is async)

**Speed**: ~200ms (one on-chain transaction)

## Storage

### In-Memory Storage
Stores `lastTotalValue` and signature for each `client:server` pair:

```typescript
{
  "client": Address,
  "server": Address,
  "lastTotalValue": bigint,
  "lastSignature": string,
  "lastVerifiedAt": timestamp,
  "requestCount": number
}
```

**Replay Prevention**: Each request must have `totalValue > lastTotalValue`

### Production Considerations
For production, replace in-memory storage with:
- Redis (distributed cache)
- PostgreSQL (persistent storage)
- DynamoDB (AWS managed)

## Logging

Logs are written to `./logs/` directory:

- `combined.log` - All logs (info, debug, error)
- `error.log` - Error logs only

Set log level via env:
```bash
LOG_LEVEL=debug npm start  # verbose
LOG_LEVEL=error npm start  # errors only
```

## Testing with x402-fetch

Point x402-fetch to local facilitator:

```typescript
const FACILITATOR_URL = 'http://localhost:3333'

const fetchWithPayment = wrapFetchWithPayment(fetch, wallet, {
  facilitator: {
    url: FACILITATOR_URL
  }
})

const response = await fetchWithPayment(url, {
  headers: { 'X-PAYMENT': paymentHeader }
})
```

## Development

### Build

```bash
npm run build
# Output: dist/
```

### Clean

```bash
npm run clean
```

## Troubleshooting

### "PRIVATE_KEY environment variable not set"
Set PRIVATE_KEY in `.env` file

### "Failed to query deposit from Amoy"
Check:
1. POLYGON_AMOY_RPC_URL is correct
2. Network connectivity
3. Contract address is valid

### "invalid_signature"
Check:
1. Signature format is valid (0x + 130 hex chars)
2. Signature was created with correct domain:
   - name: "X402Payment"
   - version: "1"
   - chainId: 80002
   - verifyingContract: paymentContractAddress

### Settlement fails with "verification_failed"
Likely reasons:
1. Insufficient deposit
2. Deposit expired
3. Replay attack (totalValue not increasing)
4. Invalid signature

Check `/state` endpoint to debug storage state.

## License

MIT
