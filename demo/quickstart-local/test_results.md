# x402 Concurrent Transaction Tests

## Test Environment
- Network: Polygon Amoy Testnet
- Facilitator: https://x402.polygon.technology
- Test API: Weather endpoint (HTTP GET)
- Test Wallets: 3 different funded wallets

## Test Results

### Single Wallet (10 Concurrent Requests)
- Success Rate: 40% (4/10 transactions)
- Average Time: ~7 seconds per successful transaction
- Failures: Mostly at payment verification stage

### Multi-Wallet Tests

#### Two Wallets
| Delay | Success Rate | Time (s) |
|-------|--------------|----------|
| 500ms | 50% (1/2)   | 6.2      |
| 1000ms| 50% (1/2)   | 7.8      |
| 2000ms| 50% (1/2)   | 9.6      |

#### Three Wallets
| Delay | Success Rate | Time (s) |
|-------|--------------|----------|
| 500ms | 0% (0/3)    | 1.6      |
| 1000ms| 67% (2/3)   | 5.5      |
| 2000ms| 33% (1/3)   | 9.1      |

## Key Findings
1. Best Configuration: 1000ms delay with multiple wallets (67% success)
2. Optimal Delay: 1000ms between transactions
3. Concurrent Limit: 2-3 transactions per batch
4. Common Error: "Failed to settle payment: 400 Bad Request"

## Recommendations
1. Use 1000ms minimum delay between transactions
2. Limit concurrent transactions to 2-3
3. Implement retry logic for failed transactions
4. Use multiple wallets for higher throughput