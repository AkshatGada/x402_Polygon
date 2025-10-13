# Polygon x402 Facilitator Throughput Test Results

**Date**: October 9, 2025  
**Network**: Polygon Amoy Testnet  
**Facilitator**: https://x402-amoy.polygon.technology

## Test Summary

| Test Configuration                 | TPS  | Success Rate | Avg TX Time | Successful | Failed |
|------------------------------------|------|--------------|-------------|------------|--------|
| Burst Test - 5 simultaneous        | 0.24 | 40%          | 8.46s       | 2/5        | 3/5    |
| Burst Test - 10 simultaneous       | 0.48 | 40%          | 8.12s       | 4/10       | 6/10   |
| Burst Test - 20 simultaneous       | 0.84 | 35%          | 8.08s       | 7/20       | 13/20  |
| Burst Test - 30 simultaneous       | 1.21 | 33%          | 8.01s       | 10/30      | 20/30  |
| Sustained - 10 TPS (100ms delay)   | 0.47 | 40%          | 7.72s       | 4/10       | 6/10   |
| Sustained - 20 TPS (50ms delay)    | 0.80 | 35%          | 7.71s       | 7/20       | 13/20  |

## Key Findings

### 1. **Actual Throughput**
- **Maximum observed TPS**: 1.21 transactions/second (with 30 simultaneous transactions)
- **Typical throughput**: 0.5-1.0 TPS range
- **Transaction time**: Consistent 7.7-8.5 seconds per transaction

### 2. **Success Rate Pattern**
- Overall success rate: 33-40% across all tests
- **Critical finding**: Failures are concentrated in wallets 2 and 3
- Wallet 1 (`0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00`) has nearly 100% success rate
- Wallets 2 and 3 have very low success rates

### 3. **Root Cause Analysis**

**Issue**: Nonce Management in Concurrent Transactions

The failures occur because:
1. Multiple transactions from the same wallet are sent simultaneously
2. Each transaction tries to use the same nonce
3. Only the first transaction succeeds; others fail with 402 errors
4. Wallet 1 succeeds because it's processing transactions sequentially

**Evidence**:
- Failed transactions return 402 status with payment requirements
- The `payer` addresses in failed transactions are different from the wallet addresses
  - Wallet 2 failures show payer: `0x2ED9b2C0d0063a16f647CC677718BCBcc15b2754`
  - Wallet 3 failures show payer: `0x4B2588Efe64e46933Cf8aCdb83F1009c2026Cc67`
- This suggests the x402-fetch library is creating new addresses internally for payment

### 4. **Performance Metrics**

**Sustained Load**:
- Adding delays (50ms, 100ms) between transactions doesn't significantly improve success rates
- Similar failure patterns persist regardless of delay

**Transaction Timing**:
- Minimum transaction time: ~7.66 seconds
- Maximum transaction time: ~8.48 seconds
- Average: ~8.0 seconds
- Very consistent timing across all successful transactions

## Implications

### For Production Use:

1. **Realistic TPS**: ~0.3-0.5 TPS per wallet
   - With proper nonce management, could potentially reach 1-2 TPS
   - Current implementation limited by sequential transaction processing

2. **Scaling Strategy**:
   - **Vertical**: Not effective - single wallet is the bottleneck
   - **Horizontal**: Use multiple wallets (each can handle ~0.3 TPS)
   - For 10 TPS: Need approximately 20-30 wallets

3. **Concurrency Limits**:
   - Do NOT send concurrent transactions from the same wallet
   - Implement transaction queuing per wallet
   - Use nonce tracking and management

### Bottlenecks Identified:

1. **Blockchain Transaction Time**: 7-8 seconds per tx (inherent to Polygon Amoy)
2. **Facilitator Processing**: Appears sequential, not parallel
3. **Nonce Management**: Not designed for concurrent transactions from same wallet

## Recommendations

### Immediate Actions:
1. Implement transaction queuing per wallet address
2. Use nonce tracking to ensure sequential transaction submission
3. Distribute load across multiple wallet addresses

### For Higher Throughput:
1. **Multi-Wallet Architecture**:
   ```
   Target TPS: 10
   Wallets needed: 20-30
   Each wallet: 0.3-0.5 TPS
   ```

2. **Transaction Management**:
   - Queue transactions per wallet
   - Wait for transaction confirmation before sending next
   - Implement retry logic with exponential backoff

3. **Monitoring**:
   - Track nonce values per wallet
   - Monitor transaction pool
   - Alert on nonce gaps or failures

### Optimization Opportunities:
1. Pre-approve transactions to reduce latency
2. Use transaction batching where possible
3. Implement parallel processing across multiple wallets
4. Consider using meta-transactions for gas optimization

## Conclusion

The Polygon x402 facilitator is capable of processing transactions reliably, but with specific constraints:

- **Single wallet throughput**: ~0.3-0.5 TPS
- **Transaction latency**: ~8 seconds
- **Scalability**: Requires horizontal scaling with multiple wallets

For applications requiring higher throughput, a multi-wallet architecture is essential. Each wallet should process transactions sequentially with proper nonce management.
