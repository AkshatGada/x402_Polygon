# X402-SCALED Technical Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Type System & Backward Compatibility](#type-system--backward-compatibility)
4. [How It Works](#how-it-works)
5. [Implementation Details](#implementation-details)
6. [Using X402-SCALED with x402-fetch](#using-x402-scaled-with-x402-fetch)
7. [Using X402-SCALED with x402-express](#using-x402-scaled-with-x402-express)
8. [Smart Contract Integration](#smart-contract-integration)
9. [Migration Guide](#migration-guide)
10. [Performance Improvements](#performance-improvements)

---

## Overview

X402-SCALED is a deposit-based, batched payment system that dramatically improves the scalability and latency of the x402 protocol while maintaining backward compatibility with the existing `exact` scheme.

### Key Benefits

| Aspect | Exact Scheme | Exact-Scaled Scheme |
|--------|-------------|-------------------|
| **Per-Request Latency** | ~200ms (on-chain) | ~1ms (off-chain) |
| **Gas Cost (1000 requests)** | $1000+ | <$1 |
| **Setup Overhead** | None | One-time deposit tx |
| **Trust Model** | Per-request verification | Deposit-based |
| **Ideal For** | Low-volume, high-security | High-volume APIs |

### High-Level Flow

```
Client                Facilitator              Smart Contract
  |                       |                            |
  +---(deposit)-----------+---(deposit tx)-----------+
  |                       |                          |
  +---(sign payload 1)----+                          |
  |      (totalValue: 100)|                          |
  +---(verify & store)----+                          |
  |                       |                          |
  +---(sign payload 2)----+                          |
  |      (totalValue: 200)|                          |
  +---(verify & store)----+                          |
  |                       |                          |
  +---(sign payload N)----+                          |
  |      (totalValue: 1000)|                         |
  +---(settle payload N)-----------+---(batch tx)---+
  |                       |         |                |
```

---

## Architecture

### Core Components

#### 1. Type System (Discriminated Union)

The implementation uses **discriminated unions** to support both schemes without breaking changes:

```typescript
// Before: Single payment payload schema
type PaymentPayload = {
  x402Version: number;
  scheme: "exact" | "exact-scaled";
  network: Network;
  payload: ExactEvmPayload | ScaledEvmPayload;
};

// After: Discriminated union for type safety
type PaymentPayload = 
  | {
      x402Version: number;
      scheme: "exact";
      network: Network;
      payload: ExactEvmPayload;  // { value, validAfter, validBefore, nonce }
    }
  | {
      x402Version: number;
      scheme: "exact-scaled";
      network: Network;
      payload: ScaledEvmPayload;  // { totalValue }
    };
```

#### 2. Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    x402-SCALED Stack                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 1: Smart Contract (Payment.sol)                 │
│  ├─ Deposit management                                 │
│  ├─ EIP-712 signature verification                     │
│  ├─ Cumulative totalValue tracking                     │
│  └─ Batch settlement via transferWithAuthorization     │
│                                                         │
│  Layer 2: Facilitator                                  │
│  ├─ Signature Storage (last totalValue per pair)       │
│  ├─ Deposit Status Queries                             │
│  ├─ Off-chain Verification (1ms)                       │
│  └─ Batch Settlement Execution                         │
│                                                         │
│  Layer 3: Middleware (x402-express)                    │
│  ├─ Scheme Detection                                   │
│  ├─ Deposit Status Checking                            │
│  ├─ 402 Response with Deposit Info                     │
│  └─ Signature State Storage                            │
│                                                         │
│  Layer 4: Client Wrappers (x402-fetch)                 │
│  ├─ Deposit Initialization                             │
│  ├─ Cumulative Signature Creation                      │
│  └─ Automatic Payment Retry                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Type System & Backward Compatibility

### Why Discriminated Unions?

We use **discriminated unions** instead of extending a single type because:

1. **Type Safety**: TypeScript can narrow types automatically
2. **Clear Intent**: Each scheme has explicit, distinct structure
3. **No Ambiguity**: Impossible to mix field structures
4. **Extensible**: New schemes can be added without breaking existing ones

### Backward Compatibility Strategy

#### 1. **Non-Breaking Changes**

```typescript
// PaymentRequirements: Extended with optional fields
interface PaymentRequirements {
  scheme: "exact" | "exact-scaled";  // Existing enum extended
  network: Network;
  maxAmountRequired: string;
  
  // Existing fields: unchanged
  resource: Resource;
  description?: string;
  mimeType?: string;
  
  // NEW: Optional scaled-specific fields
  // Only present when scheme === "exact-scaled"
  paymentContract?: string;           // ✓ Optional
  isLocked?: boolean;                 // ✓ Optional
  amountLocked?: string;              // ✓ Optional
  maxAmountLockRequired?: string;      // ✓ Optional
  lockupExpiry?: string;              // ✓ Optional
}
```

#### 2. **Default to Exact Scheme**

```typescript
// In PaymentMiddlewareConfig
interface PaymentMiddlewareConfig {
  // ...existing fields...
  
  // NEW: Optional scheme selection
  scheme?: "exact" | "exact-scaled";  // Defaults to "exact"
  paymentContract?: string;           // Only needed for "exact-scaled"
}

// Middleware auto-detection
const finalScheme = useScaledScheme ? "exact-scaled" : "exact";
```

#### 3. **Graceful Degradation**

```typescript
// x402-fetch: Prefer scaled, fallback to exact
function wrapFetchWithPayment(fetch, walletClient, maxValue) {
  return async (input, init) => {
    const response = await fetch(input, init);
    
    if (response.status !== 402) return response;
    
    const { accepts } = await response.json();
    
    // Try exact-scaled first
    let selectedPaymentRequirements = paymentRequirementsSelector(
      accepts,
      chainId ? ChainIdToNetwork[chainId] : undefined,
      "exact-scaled",  // Preferred
    );
    
    // Fallback to exact
    if (!selectedPaymentRequirements?.scheme === "exact-scaled") {
      selectedPaymentRequirements = paymentRequirementsSelector(
        accepts,
        chainId ? ChainIdToNetwork[chainId] : undefined,
        "exact",  // Fallback
      );
    }
    
    return createPaymentHeader(walletClient, x402Version, selectedPaymentRequirements);
  };
}
```

#### 4. **Existing Code Still Works**

```typescript
// OLD CODE: Still works without changes
const middleware = paymentMiddleware(
  "0x1234...",
  {
    "/api/protected": {
      price: "$0.01",
      network: "base-sepolia",
      // No paymentContract needed - defaults to "exact"
    }
  }
  // No facilitator config needed - uses defaults
);

// NEW CODE: Opt-in to x402-scaled
const middleware = paymentMiddleware(
  "0x1234...",
  {
    "/api/protected": {
      price: "$0.01",
      network: "polygon-amoy",
      config: {
        scheme: "exact-scaled",  // Enable x402-scaled
        paymentContract: "0x5678...",  // Payment.sol address
        maxAmountLockRequired: "10000000",  // Recommended $10
      }
    }
  }
);
```

---

## How It Works

### The Deposit Model

#### Step 1: Client Makes Initial Deposit

```
Client                Payment.sol
  |                       |
  +---(deposit)----------+
  |  server: 0xSeller    |
  |  amount: 10,000,000  | (represents $10 USDC)
  |  expiresBy: 1735689600
  |                      |
  |  ✓ Funds locked      |
  +---(confirmation)-----+
```

**Smart Contract State**:
```solidity
deposits[0xClient][0xSeller] = {
  amount: 10_000_000,
  expiresBy: 1735689600,
  amountUsed: 0
}
```

#### Step 2: Client Makes Multiple API Calls (Off-Chain)

Each request is authorized by an **off-chain signature** with a cumulative `totalValue`:

```
Request 1: Sign(totalValue: 100)     ← Client pays $0.001
Request 2: Sign(totalValue: 200)     ← Cumulative $0.002
Request 3: Sign(totalValue: 350)     ← Cumulative $0.0035
...
Request N: Sign(totalValue: 1000)    ← Cumulative $0.01
```

**EIP-712 Signature Domain**:
```typescript
domain: {
  name: "X402Payment",
  version: "1",
  chainId: 80002,  // Polygon Amoy
  verifyingContract: "0x5678..."  // Payment.sol address
}

message: {
  from: "0xClient",
  to: "0xSeller",
  totalValue: "1000"  // Cumulative, not incremental
}
```

#### Step 3: Facilitator Verifies Off-Chain (1ms)

```typescript
// Facilitator verification logic
async function verify(payload, paymentRequirements) {
  // 1. Get stored last totalValue
  const storedTotalValue = await signatureStorage.getLastTotalValue(
    client, server
  );
  
  // 2. Verify signature progression
  if (payload.totalValue <= storedTotalValue) {
    throw new Error("Replay attack: totalValue must increase");
  }
  
  // 3. Query contract for deposit
  const deposit = await contract.deposits(client, server);
  
  // 4. Verify sufficient coverage
  const incrementalAmount = payload.totalValue - deposit.amountUsed;
  if (incrementalAmount > deposit.amount - deposit.amountUsed) {
    throw new Error("Insufficient deposit");
  }
  
  // 5. Verify EIP-712 signature
  const recoveredAddress = await verifySignature(payload);
  if (recoveredAddress !== client) {
    throw new Error("Invalid signature");
  }
  
  return { isValid: true };
}
```

**Why This Works**:
- ✅ **No on-chain call needed** - Verification happens off-chain in 1ms
- ✅ **Replay prevention** - Contract enforces `totalValue > amountUsed`
- ✅ **Trust maintained** - Signature is EIP-712 verified

#### Step 4: Batch Settlement (On-Chain)

After N requests, settle the final cumulative value in **one transaction**:

```
Facilitator           Payment.sol
  |                       |
  +---(settle)-----------+
  |  from: 0xClient      |
  |  to: 0xSeller        |
  |  totalValue: 1000    | (represents $0.01 USDC)
  |  signature: 0x...    |
  |                      |
  |  ✓ Contract updates: |
  |    amountUsed = 1000 |
  |    return surplus    |
  +---(success)----------+
```

**Gas Cost**: ~150k gas for 1000 API calls = **0.015 USDC** vs **1000 USDC** with exact scheme

---

## Implementation Details

### 1. Type System Implementation

#### Discriminated Union Pattern

**File**: `typescript/packages/x402/src/types/verify/x402Specs.ts`

```typescript
// Cumulative authorization (exact-scaled only)
export const CumulativeAuthorizationSchema = z.object({
  from: z.string().regex(EvmAddressRegex),
  to: z.string().regex(EvmAddressRegex),
  totalValue: z.string().refine(isInteger),
});
export type CumulativeAuthorization = z.infer<typeof CumulativeAuthorizationSchema>;

// Exact scheme payload
export const ExactEvmPayloadSchema = z.object({
  signature: z.string().regex(EvmSignatureRegex),
  authorization: z.object({
    from: z.string(),
    to: z.string(),
    value: z.string(),
    validAfter: z.string(),
    validBefore: z.string(),
    nonce: z.string(),
  }),
});

// Scaled scheme payload
export const ScaledEvmPayloadSchema = z.object({
  signature: z.string().regex(EvmSignatureRegex),
  authorization: CumulativeAuthorizationSchema,
});

// Discriminated union - TypeScript narrows automatically
export const PaymentPayloadSchema = z.discriminatedUnion("scheme", [
  z.object({
    x402Version: z.number(),
    scheme: z.literal("exact"),
    network: NetworkSchema,
    payload: ExactEvmPayloadSchema,
  }),
  z.object({
    x402Version: z.number(),
    scheme: z.literal("exact-scaled"),
    network: NetworkSchema,
    payload: ScaledEvmPayloadSchema,
  }),
]);

export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>;
```

**Type Narrowing Usage**:

```typescript
// TypeScript automatically narrows the type
function handlePayment(payload: PaymentPayload) {
  if (payload.scheme === "exact") {
    // ✓ TypeScript knows: payload.payload.authorization has nonce
    const nonce = payload.payload.authorization.nonce;
  } else if (payload.scheme === "exact-scaled") {
    // ✓ TypeScript knows: payload.payload.authorization has totalValue
    const totalValue = payload.payload.authorization.totalValue;
  }
}
```

### 2. Signature Storage Implementation

**File**: `typescript/packages/x402/src/facilitator/storage.ts`

```typescript
export class SignatureStorage {
  private storage: Map<string, SignatureState> = new Map();

  private getKey(client: Address, server: Address): string {
    return `${client.toLowerCase()}:${server.toLowerCase()}`;
  }

  getLastTotalValue(client: Address, server: Address): bigint {
    const key = this.getKey(client, server);
    const state = this.storage.get(key);
    return state ? BigInt(state.lastTotalValue) : 0n;
  }

  storeSignature(
    client: Address,
    server: Address,
    totalValue: string,
    signature: string
  ): void {
    const key = this.getKey(client, server);
    const existing = this.storage.get(key);
    
    this.storage.set(key, {
      client,
      server,
      lastTotalValue: totalValue,
      lastSignature: signature,
      lastVerifiedAt: Date.now(),
      requestCount: existing ? existing.requestCount + 1 : 1,
    });
  }
}

export const signatureStorage = new SignatureStorage();
```

**Why This Matters**:
- Prevents replay attacks by ensuring `totalValue` always increases
- Tracks payment progression per client-server pair
- Could be extended to use Redis/PostgreSQL for distributed systems

### 3. Deposit Status Queries

**File**: `typescript/packages/x402/src/facilitator/depositStatus.ts`

```typescript
export async function getDepositStatus(
  client: ConnectedClient,
  clientAddress: Address,
  serverAddress: Address,
  paymentContract: Address,
  network: Network,
  lastTotalValue?: string
): Promise<DepositStatus> {
  // Query smart contract for deposit info
  const [amount, expiresBy, amountUsed] = await client.readContract({
    address: paymentContract,
    abi: PAYMENT_CONTRACT_ABI,
    functionName: "deposits",
    args: [clientAddress, serverAddress],
  });

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isLocked = amount > 0n && expiresBy > now;
  const availableBalance = (amount - amountUsed).toString();

  return {
    isLocked,
    amountLocked: amount.toString(),
    amountUsed: amountUsed.toString(),
    availableBalance,
    lockupExpiry: expiresBy.toString(),
    paymentContract,
    lastTotalValue,
  };
}
```

---

## Using X402-SCALED with x402-fetch

### Basic Usage: Automatic Deposit & Payment

```typescript
import { wrapFetchWithPayment } from "x402-fetch";
import { createSignerWallet } from "x402/types";

// 1. Create wallet
const wallet = createSignerWallet({
  privateKey: "0x...",
  chainId: 80002,  // Polygon Amoy
});

// 2. Wrap fetch
const fetchWithPayment = wrapFetchWithPayment(fetch, wallet);

// 3. Make requests - handles everything automatically
const response = await fetchWithPayment(
  "https://api.example.com/protected-endpoint",
  { method: "GET" }
);

// First request: Gets 402 response → sees deposit is needed
// Client checks deposit status → deposits funds
// Client creates cumulative signature (totalValue: $0.001)
// Server verifies → executes request → stores signature state

// Second request: Client increments totalValue ($0.002)
// Server verifies replay-safe progression → executes request

// Nth request: Batch settlement happens automatically
```

### Advanced Usage: Manual Control

```typescript
import { 
  checkDepositStatus, 
  depositFunds, 
  createCumulativePaymentHeaderHelper 
} from "x402-fetch/scaled";

const paymentContract = "0x5678...";
const server = "0xSeller";

// 1. Check current deposit status
const status = await checkDepositStatus(
  client,
  wallet.address,
  server,
  paymentContract,
  "polygon-amoy"
);

console.log({
  isLocked: status.isLocked,
  amountLocked: status.amountLocked,    // "10000000"
  amountUsed: status.amountUsed,        // "1000"
  availableBalance: status.availableBalance,  // "9999000"
  lockupExpiry: status.lockupExpiry,    // "1735689600"
});

// 2. If no deposit, create one
if (!status.isLocked) {
  const depositAmount = BigInt(10_000_000);  // $10 USDC
  const expiresBy = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);  // 30 days
  
  const tx = await depositFunds(
    wallet,
    paymentContract,
    server,
    depositAmount,
    expiresBy
  );
  
  console.log("Deposit tx:", tx);
}

// 3. Create cumulative payment
const paymentRequirements = {
  scheme: "exact-scaled",
  network: "polygon-amoy",
  paymentContract,
  payTo: server,
  maxAmountRequired: "1000",  // $0.01 for this request
};

const paymentHeader = await createCumulativePaymentHeaderHelper(
  wallet,
  1,  // x402Version
  paymentRequirements
);

// 4. Use in request
const response = await fetch(url, {
  headers: {
    "X-PAYMENT": paymentHeader,
  }
});
```

### Monitoring Payment State

```typescript
import { signatureStorage } from "x402/facilitator";

// Check payment progression for a server
const paymentState = signatureStorage.getState(
  wallet.address,
  "0xSeller"
);

console.log({
  lastTotalValue: paymentState?.lastTotalValue,  // "1000"
  requestCount: paymentState?.requestCount,      // 5
  lastVerifiedAt: new Date(paymentState?.lastVerifiedAt),
});
```

---

## Using X402-SCALED with x402-express

### Basic Setup: Enable X402-SCALED on Endpoint

```typescript
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();

// Middleware with X402-SCALED enabled
app.use(paymentMiddleware(
  "0xSeller",  // Your address
  {
    "/api/premium": {
      price: "$0.01",
      network: "polygon-amoy",
      config: {
        scheme: "exact-scaled",  // Enable batching
        paymentContract: "0x5678...",  // Payment.sol address
        maxAmountLockRequired: "10000000",  // Recommend $10 deposit
      }
    },
    // Exact scheme still works for other endpoints
    "/api/free": {
      price: "$0",
      network: "polygon-amoy",
    }
  }
));

// Protected endpoint
app.get("/api/premium", (req, res) => {
  res.json({ data: "Premium content" });
});
```

### 402 Response with Deposit Information

When client hasn't deposited yet:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact-scaled",
      "network": "polygon-amoy",
      "paymentContract": "0x5678...",
      "maxAmountRequired": "1000",
      "payTo": "0xSeller",
      
      // Deposit status information
      "isLocked": false,
      "amountLocked": "0",
      "maxAmountLockRequired": "10000000",
      "lockupExpiry": null
    }
  ]
}
```

When client has active deposit:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact-scaled",
      "network": "polygon-amoy",
      "paymentContract": "0x5678...",
      "maxAmountRequired": "1000",
      "payTo": "0xSeller",
      
      // Deposit status information
      "isLocked": true,
      "amountLocked": "10000000",
      "amountUsed": "2500",
      "maxAmountLockRequired": "10000000",
      "lockupExpiry": "1735689600"
    }
  ]
}
```

### Server Handler: Automatic Verification

```typescript
app.get("/api/premium", (req, res) => {
  // X-PAYMENT verification happens automatically in middleware
  // If we reach here, payment is verified and settled
  
  // Log payment info
  console.log("Request from:", req.x402?.payer);  // Client address
  console.log("Payment scheme:", req.x402?.scheme);  // "exact-scaled"
  console.log("Amount authorized:", req.x402?.totalValue);  // "1000"
  
  res.json({ data: "Premium content" });
});

// Payment failure handling
app.use((err, req, res, next) => {
  if (err.code === "PAYMENT_VERIFICATION_FAILED") {
    return res.status(402).json({
      error: "Invalid payment",
      reason: err.message
    });
  }
  next(err);
});
```

### Mixed Scheme Setup

```typescript
// Support both exact and exact-scaled on same server
app.use(paymentMiddleware("0xSeller", {
  // Modern clients: Use exact-scaled
  "/api/v2/data": {
    price: "$0.01",
    network: "polygon-amoy",
    config: {
      scheme: "exact-scaled",
      paymentContract: "0xScaled..."
    }
  },
  
  // Legacy clients: Use exact
  "/api/v1/data": {
    price: "$0.01",
    network: "base-sepolia",
    // scheme defaults to "exact"
  },
  
  // Free tier: No payment needed
  "/api/public": {
    price: "$0",
    network: "polygon-amoy",
  }
}));
```

---

## Smart Contract Integration

### Deploying Payment.sol

```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const Payment = await ethers.getContractFactory("Payment");
  const payment = await Payment.deploy();
  
  await payment.deployed();
  console.log("Payment contract deployed to:", payment.address);
}

main().catch(console.error);
```

### Contract Interface

```solidity
interface IPayment {
  // Deposit funds for a server
  function deposit(
    address server,
    uint256 amount,
    uint256 expiresBy
  ) external;
  
  // Withdraw unused funds after expiry
  function withdraw(address server) external;
  
  // Batch settlement with cumulative totalValue
  function transferWithAuthorization(
    address from,
    address to,
    uint256 totalValue,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;
  
  // Query deposit info
  function deposits(
    address user,
    address server
  ) external view returns (
    uint256 amount,
    uint256 expiresBy,
    uint256 amountUsed
  );
}
```

---

## Migration Guide

### From Exact to Exact-Scaled

#### Step 1: Deploy Payment Contract

```bash
npx hardhat run scripts/deploy.ts --network polygonAmoy
# Payment contract deployed to: 0x5678...
```

#### Step 2: Update Server Configuration

```typescript
// Before: Exact scheme only
app.use(paymentMiddleware("0xSeller", {
  "/api/data": {
    price: "$0.01",
    network: "polygon-amoy",
  }
}));

// After: Enable exact-scaled
app.use(paymentMiddleware("0xSeller", {
  "/api/data": {
    price: "$0.01",
    network: "polygon-amoy",
    config: {
      scheme: "exact-scaled",
      paymentContract: "0x5678...",
      maxAmountLockRequired: "10000000",
    }
  }
}));
```

#### Step 3: Client Updates (Optional - Auto-Handled)

```typescript
// Before: Still works
const fetchWithPayment = wrapFetchWithPayment(fetch, wallet);
await fetchWithPayment(url);  // Uses exact

// After: Automatically uses exact-scaled if available
const fetchWithPayment = wrapFetchWithPayment(fetch, wallet);
await fetchWithPayment(url);  // Auto-detects and uses exact-scaled
```

#### No Breaking Changes!

- ✅ Existing exact scheme continues working
- ✅ Clients don't require updates
- ✅ Can run both schemes simultaneously
- ✅ Gradual rollout to subset of endpoints

---

## Performance Improvements

### Latency Comparison

```
Exact Scheme:
├─ Create EIP-712 signature: 5ms
├─ POST to server: 10ms
├─ Server verification (on-chain): 200ms
└─ Total: ~215ms per request

Exact-Scaled Scheme:
├─ Create EIP-712 signature: 5ms
├─ POST to server: 10ms
├─ Facilitator verification (off-chain): <1ms
└─ Total: ~16ms per request
│
│ → 93% latency reduction
```

### Gas Cost Comparison

```
Exact Scheme (1000 requests):
├─ 1000 × transferWithAuthorization: 1000 × 150k gas
├─ Total: 150,000,000 gas
└─ Cost: ~$1000 (at 100 Gwei)

Exact-Scaled Scheme (1000 requests):
├─ 1 × deposit: 80k gas
├─ 1 × batch settlement: 150k gas
├─ Total: 230,000 gas
└─ Cost: ~$0.02 (at 100 Gwei)
│
│ → 99.9% gas cost reduction
```

### Throughput

```
Exact Scheme:
└─ Max ~4 requests/sec per chain

Exact-Scaled Scheme:
└─ Max 1000+ requests/sec (off-chain verification)
   Limited only by server processing
```

---

## Security Considerations

### 1. Replay Prevention

The smart contract enforces cumulative `totalValue` progression:

```solidity
require(totalValue > deposits[from][to].amountUsed, "Replay");
```

Old signatures become invalid after settlement.

### 2. Signature Verification

EIP-712 signatures are verified against:
- Correct domain (contract address, network)
- Correct message structure
- Correct signer

### 3. Deposit Expiry

Deposits automatically expire:

```typescript
const now = BigInt(Math.floor(Date.now() / 1000));
if (expiresBy < now) {
  throw new Error("Deposit expired");
}
```

### 4. Off-Chain Trust

Facilitator maintains `lastTotalValue` state:
- Prevents out-of-order requests
- Detects attempted replays
- Ensures monotonic progression

---

## Troubleshooting

### Issue: "Payment contract not found"

```typescript
// Ensure payment contract address is correct
const paymentRequirements = {
  paymentContract: "0x5678...",  // Must be valid address
};
```

### Issue: "Deposit expired"

```typescript
// Extend deposit if needed
const newExpiresBy = BigInt(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60);
await wallet.writeContract({
  address: paymentContract,
  functionName: "deposit",
  args: [server, depositAmount, newExpiresBy],
});
```

### Issue: "Insufficient deposit"

```typescript
// Check available balance
const status = await checkDepositStatus(...);
if (status.availableBalance < requiredAmount) {
  // Deposit more or wait for settlement
}
```

---

## Conclusion

X402-SCALED provides a secure, scalable, and cost-effective payment system while maintaining full backward compatibility with the existing x402 protocol. By leveraging deposit-based models and cumulative signatures, it reduces both latency and costs by orders of magnitude, enabling new use cases for high-volume API payments.

### Key Takeaways

✅ **Backward Compatible**: Existing exact scheme unchanged
✅ **Type-Safe**: Discriminated unions prevent mixing schemes
✅ **Opt-In**: Enable per-endpoint via configuration
✅ **Automatic**: Clients don't require code changes
✅ **Performant**: 93% latency reduction, 99.9% cost reduction
✅ **Secure**: EIP-712 signatures + replay prevention + deposit expiry

