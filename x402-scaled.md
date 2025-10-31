# X402-SCALED Implementation Plan

## Overview

Implement the X402-SCALED proposal that enables batching multiple API calls through a deposit-based model with cumulative EIP-712 signatures, dramatically reducing gas costs and latency while maintaining trust-minimized principles.

## Architecture Components

### 1. Payment Smart Contract

**Location**: `contracts/x402-scaled/Payment.sol`

- Implement `IPayment` interface from proposal:
  - `deposit(address server, uint256 amount, uint256 expiresBy)` - One-time deposit
  - `withdraw(address server)` - Withdraw unused funds after expiry
  - `transferWithAuthorization(...)` - Batch settlement with cumulative `totalValue`
  - `receiveWithAuthorization(...)` - Server-initiated pull payment
- Store `DepositInfo` mapping: `user => server => (amount, expiresBy, amountUsed)`
- EIP-712 domain setup for signature verification
- Validation logic: `require(totalValue > amountUsed)` to prevent replay
- ERC20 token integration (USDC)

**Dependencies**: OpenZeppelin EIP712, ERC20 interface

### 2. New Scheme: "exact-scaled"

**Location**: `typescript/packages/x402/src/schemes/exact-scaled/`

Create new scheme variant to avoid breaking existing `exact` scheme:

#### 2.1 Types & Schemas

**File**: `typescript/packages/x402/src/types/verify/x402Specs.ts`

- Extend `PaymentRequirementsSchema` with optional scaled fields:
  - `isLocked?: boolean`
  - `amountLocked?: string`
  - `maxAmountLockRequired?: string`
  - `lockupExpiry?: string`
  - `paymentContract?: string` (address)
- New `ScaledPaymentPayloadSchema` with `totalValue` instead of per-request `value`
- Update `schemes` enum to include `"exact-scaled"`

#### 2.2 Client-Side Payment Creation

**File**: `typescript/packages/x402/src/schemes/exact-scaled/client.ts`

- `createCumulativePayment()` - Creates signature with cumulative `totalValue`
- `prepareCumulativePaymentHeader()` - Prepares unsigned payload with `totalValue`
- Integration with deposit contract to fetch current `amountUsed`
- Handle first request (deposit required) vs subsequent requests (cumulative)
- EIP-712 signing with new typehash: `TransferWithAuthorization(address from,address to,uint256 totalValue)`

**Key Logic**:

```typescript
// Fetch last totalValue from facilitator or local storage
const lastTotalValue = await getLastTotalValue(client, server);
const newTotalValue = BigInt(lastTotalValue) + BigInt(paymentRequirements.maxAmountRequired);
```

#### 2.3 Facilitator Verification

**File**: `typescript/packages/x402/src/schemes/exact-scaled/facilitator.ts`

- `verify()` - Verify cumulative signature and check deposit coverage
- Check `totalValue > storedAmountUsed` (prevents replay)
- Verify `totalValue <= (depositAmount - amountUsed)` (sufficient funds)
- Verify signature validity via EIP-712 recovery
- Store last `totalValue` per client-server pair (database/cache)

#### 2.4 Batch Settlement

**File**: `typescript/packages/x402/src/schemes/exact-scaled/facilitator.ts`

- `settle()` - Call payment contract's `transferWithAuthorization()`
- Pass cumulative `totalValue` (not incremental amount)
- Contract calculates incremental: `totalValue - amountUsed`
- Settlement strategy: batch multiple client-server pairs in single transaction (optional optimization)

### 3. Facilitator Enhancements

#### 3.1 Deposit Status Endpoint

**File**: `typescript/packages/x402/src/facilitator/` (new or extend existing)

- New endpoint: `GET /deposit-status?client={address}&server={address}`
- Query payment contract for deposit info
- Return: `{ isLocked, amountLocked, amountUsed, lockupExpiry, paymentContract }`

#### 3.2 Last Signature Storage

**File**: `typescript/packages/x402/src/facilitator/storage.ts` (new)

- Database/cache to store last `totalValue` per `(client, server)` pair
- Used for verification: ensure `newTotalValue > storedTotalValue`
- Key: `${client}:${server}`
- Value: `{ totalValue: string, timestamp: number, signature: string }`

### 4. Server Middleware Integration

#### 4.1 Payment Requirements Enhancement

**File**: `typescript/packages/x402-express/src/index.ts`

- Check deposit status before returning 402 response
- Include deposit info in 402 response:
  ```typescript
  {
    isLocked: boolean,
    amountLocked: string,
    maxAmountLockRequired: string,
    lockupExpiry: string,
    paymentContract: string,
    maxAmountRequired: string, // Current request cost
    // ... existing fields
  }
  ```

- For `isLocked: false`, include deposit instructions
- For `isLocked: true`, include cumulative amount required

#### 4.2 Client Helper: Deposit Flow

**File**: `typescript/packages/x402-fetch/src/scaled.ts` (new)

- `checkDepositStatus()` - Query facilitator for deposit info
- `depositFunds()` - Helper to call payment contract `deposit()`
- `createCumulativePaymentHeader()` - Wrapper for cumulative payment creation
- Integration with `wrapFetchWithPayment` to auto-handle deposit flow

### 5. Smart Contract Deployment & Testing

**Location**: `contracts/x402-scaled/`

- Hardhat/Foundry setup for deployment scripts
- Test contracts: `test/Payment.test.ts`
- Test scenarios:
  - Deposit and withdrawal
  - Cumulative signature verification
  - Replay attack prevention
  - Batch settlement
  - Multiple client-server pairs

### 6. Type System Updates

**File**: `typescript/packages/x402/src/types/verify/x402Specs.ts`

- Add `ScaledPaymentRequirements` type extending `PaymentRequirements`
- Add `CumulativeAuthorization` type with `totalValue` field
- Update `PaymentPayloadSchema` to support both schemes (discriminated union or versioning)

### 7. Documentation & Examples

- Update README with X402-SCALED flow
- Example: `examples/typescript/scaled-payment/`
  - Client deposit flow
  - Cumulative payment creation
  - Batch settlement demonstration

## Implementation Phases

### Phase 1: Smart Contract (Foundation)

1. Write Solidity contract implementing `IPayment`
2. Write comprehensive tests
3. Deploy to testnet (polygon-amoy)
4. Verify contract functionality

### Phase 2: Type System & Schemas

1. Extend `PaymentRequirementsSchema` with scaled fields
2. Create `ScaledPaymentPayloadSchema`
3. Update `schemes` enum
4. Add TypeScript types

### Phase 3: Client-Side Implementation

1. Implement `exact-scaled` client functions
2. Create cumulative payment creation logic
3. Add deposit helper functions
4. Update `x402-fetch` wrapper

### Phase 4: Facilitator Implementation

1. Implement verification logic for cumulative signatures
2. Add deposit status endpoint
3. Implement signature storage (database/cache)
4. Implement batch settlement

### Phase 5: Server Middleware Integration

1. Update `x402-express` to check deposit status
2. Include deposit info in 402 responses
3. Support both `exact` and `exact-scaled` schemes

### Phase 6: Testing & Integration

1. End-to-end tests: deposit → multiple requests → settlement
2. Load testing with batched requests
3. Security audit of signature verification
4. Performance benchmarking vs standard x402

## Key Design Decisions

1. **Separate Scheme**: Use `"exact-scaled"` to maintain backward compatibility with existing `"exact"` scheme
2. **Cumulative Signatures**: Each signature authorizes cumulative `totalValue`, not incremental amount
3. **Deposit Model**: One-time deposit enables thousands of off-chain transactions
4. **Replay Prevention**: Contract enforces `totalValue > amountUsed` making old signatures invalid
5. **Optional Batching**: Facilitator can batch multiple client-server settlements in single transaction

## Files to Create/Modify

**New Files**:

- `contracts/x402-scaled/Payment.sol`
- `contracts/x402-scaled/IPayment.sol`
- `typescript/packages/x402/src/schemes/exact-scaled/client.ts`
- `typescript/packages/x402/src/schemes/exact-scaled/facilitator.ts`
- `typescript/packages/x402/src/schemes/exact-scaled/index.ts`
- `typescript/packages/x402/src/facilitator/depositStatus.ts`
- `typescript/packages/x402/src/facilitator/storage.ts`
- `examples/typescript/scaled-payment/`

**Modified Files**:

- `typescript/packages/x402/src/types/verify/x402Specs.ts` - Add scaled types
- `typescript/packages/x402-express/src/index.ts` - Deposit status checks
- `typescript/packages/x402-fetch/src/index.ts` - Scaled payment helpers

## Success Criteria

1. Smart contract deployed and verified on testnet
2. Client can deposit funds and make multiple API calls with cumulative signatures
3. Facilitator verifies cumulative signatures correctly
4. Batch settlement works: 1000+ API calls settled in single transaction
5. Gas costs reduced by >99% compared to per-request settlement
6. Latency <50ms for signature verification (vs ~200ms for on-chain)
7. Backward compatibility: existing `exact` scheme continues working

## Open Questions

1. Should facilitator store last signature in database or rely on contract state?
2. What's the optimal batch size for settlement? (configurable per server?)
3. Should we support partial withdrawals before expiry?
4. Multi-network support: same contract address or per-network deployment?