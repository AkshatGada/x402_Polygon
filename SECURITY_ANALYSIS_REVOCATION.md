# X402-SCALED Revocation Vulnerability Analysis

## The Question
**"Can I pay for something and then revoke it by signing the same nonce somewhere else?"**

---

## Executive Summary

**Short Answer: NO**, you **cannot** revoke a payment once it's signed in the x402-scaled scheme, but the current design has a **subtle nonce/signature reuse vulnerability** that needs to be understood.

---

## How X402-SCALED Prevents Double-Spending

### The Cumulative TotalValue Mechanism

X402-SCALED uses **cumulative authorization**, not nonces:

```solidity
// Contract state: deposits[user][server].amountUsed tracks cumulative value
mapping(address => mapping(address => DepositInfo)) public deposits;

struct DepositInfo {
    uint256 amount;           // Total deposit amount
    uint256 expiresBy;        // Expiration timestamp
    uint256 amountUsed;       // Cumulative amount already used
}
```

### How Payment Verification Works

**Step 1: User Signs Authorization**
```typescript
// EIP-712 Signature Structure
{
  from: userAddress,
  to: serverAddress,
  totalValue: 1000000  // Cumulative total (NOT per-request)
}
// Signed: signature = signEIP712({ from, to, totalValue })
```

**Step 2: Facilitator Verifies Cumulative Progression**
```typescript
// From: typescript/packages/x402/src/schemes/exact-scaled/facilitator.ts

// CRITICAL CHECK at line 157-164
const newTotalValue = BigInt(payload.payload.authorization.totalValue);
if (newTotalValue <= lastTotalValue) {
  return {
    isValid: false,
    invalidReason: "totalValue_not_incremental",  // ❌ REJECTS!
  };
}
```

**Step 3: Contract Executes Transfer**
```solidity
// From: Payment.sol lines 148-172

// Verify cumulative progression
require(
    totalValue > depositInfo.amountUsed,
    "Payment: cumulative value must be greater than amount used"
);

// Calculate actual amount to transfer
uint256 amountToTransfer = totalValue - depositInfo.amountUsed;

// Update state for next request
depositInfo.amountUsed = totalValue;
```

---

## The Vulnerability You're Asking About

### Scenario 1: Can You Revoke by Signing Lower Value?

```
Timeline:
1. Sign message: totalValue = 1000000
2. Server processes payment
3. Contract updates: amountUsed = 1000000
4. Try to revoke by signing: totalValue = 500000 (lower value)
5. Send new signature to facilitator
```

**Result: ✅ PROTECTED**

The facilitator checks at line 157-164:
```typescript
if (newTotalValue <= lastTotalValue) {
  // 500000 <= 1000000 → REJECT
  return { isValid: false, invalidReason: "totalValue_not_incremental" }
}
```

---

### Scenario 2: Can You Sign Same Value Twice?

```
Timeline:
1. Sign: totalValue = 1000000, signature = sig1
2. Facilitator settles it → amountUsed = 1000000
3. Sign again: totalValue = 1000000, signature = sig1 (same)
4. Try to submit again
```

**Result: ✅ PROTECTED**

**At Facilitator Level (fastest):**
```typescript
// Line 157-164 in facilitator.ts
if (newTotalValue <= lastTotalValue) {
  // 1000000 <= 1000000 → REJECT
  return { isValid: false, invalidReason: "totalValue_not_incremental" }
}
```

**At Contract Level (backup):**
```solidity
// Payment.sol line 151-153
require(
    totalValue > depositInfo.amountUsed,
    "Payment: cumulative value must be greater than amount used"
);
// Contract: amountUsed = 1000000, so 1000000 > 1000000 → FALSE, REVERTS
```

---

### Scenario 3: ECDSA Signature Malleability Attack

**The Real Question:** Can someone take your valid signature and modify it to represent a different payment?

```
Valid Signature Format: (r, s, v)
  - r: 32 bytes (random point on curve)
  - s: 32 bytes (signature component)
  - v: 1 byte (recovery id)
```

**ECDSA Malleability:** You can negate the s value: `s' = n - s` (where n = order of curve)

**Result: ✅ PROTECTED by EIP-712**

EIP-712 signatures are structured:
```typescript
digest = keccak256(
  abi.encodePacked(
    "\x19\x01",           // EIP-191 prefix
    domainSeparator,      // chainId, verifyingContract, etc.
    structHash(from, to, totalValue)
  )
)
```

Because `totalValue` is **part of the hash**, any modification to `s` that tries to trick the signature would:
1. Fail ECDSA recovery (wrong point on curve)
2. Recover to a different address (not the payer)
3. Get rejected by contract: `require(recoveredAddress == from)`

---

## The ACTUAL Vulnerability: Facilitator State Management

### The Problem

The facilitator maintains `lastTotalValue` in **memory (in-process state)**:

```typescript
// From: demo/test-facilitator-scaled/src/storage.ts
export class SignatureStorage {
  private storage: Map<string, SignatureState> = new Map()
  
  getLastTotalValue(from: Address, to: Address): bigint {
    const key = `${from}:${to}`
    return this.storage.get(key)?.lastTotalValue ?? 0n
  }
}

export const signatureStorage = new SignatureStorage()  // ⚠️ IN MEMORY
```

### Attack Vector

```
Timeline:
1. User pays: totalValue = 1000000
2. Facilitator verifies: ✅ (1000000 > 0)
3. Facilitator settles on-chain
4. FACILITATOR RESTARTS (crash, deploy, etc.)
5. In-memory state is LOST!
6. storage.getLastTotalValue() returns 0n again
7. User submits SAME signature: totalValue = 1000000
8. Facilitator verifies: 1000000 > 0? ✅ YES!
9. Facilitator tries to settle... but CONTRACT PREVENTS IT!
```

**Result: Partially Protected**

- ✅ Contract has `amountUsed = 1000000` (on-chain)
- ✅ Second settlement reverts: `totalValue > depositInfo.amountUsed` fails
- ❌ But facilitator accepted it again (wasted gas, network spam)

---

## The REAL Replay Attack That Works

### Vector: Replay Attack via Storage Eviction

If facilitator uses **time-based cache expiration**:

```typescript
// Hypothetical vulnerable code
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

function getLastTotalValue(from, to) {
  const key = `${from}:${to}`
  const entry = cache.get(key)
  
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.value
  }
  
  cache.delete(key)  // ⚠️ EXPIRED, STATE LOST
  return 0n          // ⚠️ VULNERABLE!
}
```

**Attack:**
1. Pay with `totalValue = 1000`
2. Wait 5+ minutes
3. Submit same signature again
4. Facilitator has forgotten, accepts it
5. Contract rejects it (backup protection)

---

## Defense Layers in X402-SCALED

### Layer 1: EIP-712 Signature (Client-Side)
- ✅ Cannot forge signature without private key
- ✅ Cannot modify authorization without breaking signature
- ✅ Signature is cryptographically bound to `(from, to, totalValue, chainId, contract)`

### Layer 2: Facilitator Verification (Off-Chain)
- ✅ Checks `totalValue > lastTotalValue` (replay prevention)
- ⚠️ But relies on **in-memory state** (can be lost)
- ⚠️ Should persist to database for production

### Layer 3: Contract Enforcement (On-Chain)
- ✅ Checks `totalValue > amountUsed` (hard on-chain state)
- ✅ Cannot be bypassed (immutable, consensus-verified)
- ✅ Final defense against any bypass of Layer 1-2

---

## How X402-EXACT Handles This Differently

### X402-EXACT: Per-Request Nonces

```typescript
// Each request has unique nonce
{
  from: userAddress,
  to: serverAddress,
  nonce: uniquePerRequest  // ✅ Different every time
}
```

**Advantage:**
- ✅ Simpler: just check if `(from, to, nonce)` was used before
- ✅ No state needed: just mark nonces as "used"

**Disadvantage:**
- ❌ Requires nonce management on client
- ❌ More gas per settlement (no batching)
- ❌ Requires external nonce source

### X402-SCALED: Cumulative Values

```typescript
// Each request uses higher cumulative value
{
  from: userAddress,
  to: serverAddress,
  totalValue: 1000   // Request 1
}
// Then next:
{
  from: userAddress,
  to: serverAddress,
  totalValue: 2000   // Request 2 (must be > 1000)
}
```

**Advantage:**
- ✅ Natural ordering (no nonce management)
- ✅ Enables batch settlement (many payments → 1 on-chain tx)
- ✅ Client-side state is automatic

**Disadvantage:**
- ⚠️ Requires state management on facilitator

---

## Recommendations to Fix Vulnerability

### For Production X402-SCALED:

**1. Persist Facilitator State to Database**
```typescript
import { Database } from 'better-sqlite3'

class SignatureStorageDB {
  private db: Database
  
  constructor(filepath: string) {
    this.db = new Database(filepath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signatures (
        user TEXT,
        server TEXT,
        lastTotalValue TEXT,
        updatedAt INTEGER,
        PRIMARY KEY (user, server)
      )
    `)
  }
  
  getLastTotalValue(user: Address, server: Address): bigint {
    const row = this.db.prepare(
      'SELECT lastTotalValue FROM signatures WHERE user = ? AND server = ?'
    ).get(user, server)
    return row ? BigInt(row.lastTotalValue) : 0n
  }
  
  storeSignature(user: Address, server: Address, totalValue: bigint) {
    this.db.prepare(`
      INSERT OR REPLACE INTO signatures (user, server, lastTotalValue, updatedAt)
      VALUES (?, ?, ?, ?)
    `).run(user, server, totalValue.toString(), Date.now())
  }
}
```

**2. Add Nonce to Authorization**
```typescript
// Hybrid approach: cumulative + nonce
{
  from: userAddress,
  to: serverAddress,
  totalValue: 1000,
  requestId: uuid()  // Unique per request
}
```

**3. Use Transaction Hash as Finality Marker**
```typescript
// Track settled transactions
const settledTxs = new Set<Hex>()

function hasBeenSettled(txHash: Hex): boolean {
  return settledTxs.has(txHash)
}

function markAsSettled(txHash: Hex) {
  settledTxs.add(txHash)
}
```

**4. Implement Idempotency Keys**
```typescript
app.post('/settle', (req, res) => {
  const idempotencyKey = req.headers['idempotency-key']
  
  if (settledIdempotencyKeys.has(idempotencyKey)) {
    // Return cached response instead of re-settling
    return res.json(cachedResponse)
  }
  
  // Process settlement
  const result = await settle(payload)
  
  settledIdempotencyKeys.add(idempotencyKey)
  return res.json(result)
})
```

---

## Summary Table

| Scenario | Protected? | Why |
|----------|-----------|-----|
| Sign lower value to revoke | ✅ YES | Cumulative check: `newValue > oldValue` |
| Sign same value twice | ✅ YES | Facilitator + Contract both reject |
| ECDSA signature malleability | ✅ YES | EIP-712 binds to totalValue |
| Replay after facilitator restart | ⚠️ PARTIALLY | Contract protects, but wastes gas |
| Replay if cache expires | ⚠️ PARTIALLY | Contract prevents on-chain, facilitator accepts off-chain |
| Forge completely new signature | ✅ YES | ECDSA cryptographic security |
| Change recipient address | ✅ YES | Address is part of EIP-712 hash |

---

## Conclusion

**Your original question: "Can't I revoke by signing something else?"**

**Answer: NO** - because:

1. **You can't sign "something else" without your private key** - signature is cryptographically bound
2. **You can't sign a lower value** - facilitator rejects non-incremental values
3. **You can't sign the same value twice** - both facilitator and contract check for progression
4. **The contract is the ultimate authority** - it has `amountUsed` on-chain, immutable across restarts

**However**, for production deployment, the facilitator should:
- ✅ Persist `lastTotalValue` to persistent storage (not just memory)
- ✅ Use idempotency keys to prevent double-settlement
- ✅ Add transaction tracking for audit trail
- ✅ Implement request deduplication

The current test facilitator is **secure for testing** but **should not be used in production** without persistent state management.

---

**Status:** ✅ SECURE AGAINST REVOCATION ATTACKS
**Recommendation:** Move facilitator state to database for production
**Risk Level:** LOW (contract protects against worst-case scenarios)

