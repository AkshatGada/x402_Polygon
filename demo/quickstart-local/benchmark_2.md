# x402 Facilitator Benchmark Results - Round 2

## Test Configuration
- **Date**: October 9, 2025
- **Environment**: Node.js v24.1.0
- **Network**: Polygon Amoy Testnet
- **Test Type**: Multi-wallet concurrent transactions
- **Metrics**: Transaction time, success rate, throughput

## Test Results

### 1. Polygon x402 Facilitator
**Facilitator URL**: `https://x402-amoy.polygon.technology`

#### 2-Wallet Tests

| Delay  | Total Time | Success/Total | Success Rate | Avg Time/TX |
|--------|------------|---------------|--------------|-------------|
| 500ms  | 8.621s    | 2/2           | 100%         | 4.31s       |
| 1000ms | 8.816s    | 2/2           | 100%         | 4.41s       |
| 2000ms | 9.729s    | 2/2           | 100%         | 4.86s       |

Transaction Details:
- 500ms Test:
  - Wallet 1: TX 0x555cf3a4c2afd42d690f5ee9920b5fc22cc54cfade8cc38d85f2ee0b0c9e24ad
  - Wallet 2: TX 0x64674f27f682cf624e5ffa4e9317f91a68c644fc0c71677b3e93921d700c9672

- 1000ms Test:
  - Wallet 1: TX 0x8979b01a9a3b3981d627e4ccd8fb2cf8c754671a38365e73fd90249a7d3d9ba7
  - Wallet 2: TX 0xf2f4df2f120802d01ed829659b56fd3fbc2e7fc57112b6bccfe82f5ac7d986ea

- 2000ms Test:
  - Wallet 1: TX 0x55c7172c53ece4e6bcc1d2212ed6775c221605833b47ff3a76629132a58fe5a6
  - Wallet 2: TX 0x5f41ada9c163d3d3dc1cd7b754b4ac8c4e832b9540bcaf069a4b9cef0ccea5e9

#### 3-Wallet Tests

| Delay  | Total Time | Success/Total | Success Rate | Avg Time/TX |
|--------|------------|---------------|--------------|-------------|
| 500ms  | 9.279s    | 3/3           | 100%         | 3.09s       |
| 1000ms | 9.847s    | 3/3           | 100%         | 3.28s       |
| 2000ms | 11.786s   | 3/3           | 100%         | 3.93s       |

Transaction Details:
- 500ms Test:
  - Wallet 1: TX 0x69a58d78a83d54e483ae45cabfee0f7bb4b305e6e8be5f2f6d4beeca3b90899e
  - Wallet 2: TX 0x345dca0a78c14060dcb654093c8001c45970d272cbd530447f6ede75bba1bb20
  - Wallet 3: TX 0x33423d8c8adb8787afe8e38391b6b22dfcfc4a885469ed8062dd25c2c4bed1b3

### 2. PayAI Facilitator
**Facilitator URL**: `https://facilitator.payai.network`

#### 2-Wallet Tests

| Delay  | Total Time | Success/Total | Success Rate | Avg Time/TX |
|--------|------------|---------------|--------------|-------------|
| 500ms  | 6.647s    | 1/2           | 50%          | 6.65s       |
| 1000ms | 9.971s    | 2/2           | 100%         | 4.99s       |
| 2000ms | 8.435s    | 2/2           | 100%         | 4.22s       |

Transaction Details:
- 500ms Test:
  - Wallet 1: TX 0x716296f29bdc63e29108e34e8ec2e7b80a96fb79b748e1a11e75a28d5b214229
  - Wallet 2: Failed - No payment response

- 1000ms Test:
  - Wallet 1: TX 0x1ff35bfc5d307bec40345cd79021f6de269193f3a2017e1b63d1447a9f5a1736
  - Wallet 2: TX 0xcbdc6cb1b80d6e6f615bfa479ac10bea6ee0b95d795ed7206efa1ae7b730e481

- 2000ms Test:
  - Wallet 1: TX 0x61a2ba9176df46bcd0bd1135dfcef5ce39de3b2c1f1f0a31965cf40a75dee7f3
  - Wallet 2: TX 0x84b26e9404cb7273c50b470a8aece62b1cb2743921e36f75ac7acbce22527d59

#### 3-Wallet Tests

| Delay  | Total Time | Success/Total | Success Rate | Avg Time/TX |
|--------|------------|---------------|--------------|-------------|
| 500ms  | 10.534s   | 3/3           | 100%         | 3.51s       |
| 1000ms | 8.468s    | 3/3           | 100%         | 2.82s       |
| 2000ms | 10.504s   | 3/3           | 100%         | 3.50s       |

Transaction Details:
- 500ms Test:
  - Wallet 1: TX 0xbb129f08532255c170ceceee524a915343856d4a89812f27d1998ab48532803e
  - Wallet 2: TX 0x81aa88bbf156d735e1472b075fc0a069f689bff5332c9bce7644361402161476
  - Wallet 3: TX 0x48e90d657c24eaa19caf48ca6e7bdb2b9e958bc05eaf2df1b4ba7fbced6287d1

## Analysis

### Performance Comparison

1. **Transaction Success Rate**:
   - Polygon: 100% success rate across all tests (12/12 transactions)
   - PayAI: 92% success rate (11/12 transactions)

2. **Average Transaction Times**:
   - Polygon:
     - 2 Wallets: 4.53s average
     - 3 Wallets: 3.43s average
   - PayAI:
     - 2 Wallets: 5.29s average
     - 3 Wallets: 3.28s average

3. **Concurrency Handling**:
   - Polygon shows consistent performance with both wallet counts
   - PayAI shows better performance with 3 wallets than 2 wallets
   - Both facilitators handle higher delays better

### Key Findings

1. **Reliability**:
   - Polygon facilitator shows more consistent performance
   - PayAI has occasional issues with very low delays (500ms)

2. **Scaling**:
   - Both facilitators handle increased wallet count well
   - Transaction times don't increase linearly with wallet count

3. **Optimal Configuration**:
   - Minimum 1000ms delay recommended for both facilitators
   - 3-wallet concurrent transactions show better per-transaction performance

### Recommendations

1. **For Production Use**:
   - Implement minimum 1000ms delay between concurrent transactions
   - Include retry logic for failed transactions
   - Monitor transaction times and adjust delays accordingly

2. **For Development**:
   - Start with 1000ms delay for testing
   - Implement proper error handling
   - Log transaction hashes for verification

3. **For Optimization**:
   - Consider batch processing for multiple transactions
   - Implement dynamic delay adjustment based on network conditions
   - Monitor and log performance metrics
