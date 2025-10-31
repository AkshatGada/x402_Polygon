# X402-SCALED Payment Contract

Smart contract implementation for X402-SCALED batch payment settlement.

## Overview

This contract enables:
- One-time deposits that lock funds for a server
- Cumulative EIP-712 signatures for multiple API calls
- Batch settlement with a single on-chain transaction
- Automatic replay attack prevention via cumulative value tracking

## Key Features

1. **Deposit Model**: Users deposit funds once, enabling thousands of off-chain transactions
2. **Cumulative Signatures**: Each signature authorizes a cumulative `totalValue`, not an incremental amount
3. **Replay Prevention**: Contract enforces `totalValue > amountUsed`, making old signatures invalid
4. **Batch Settlement**: Many API calls can be settled with one transaction

## Contract Functions

### `deposit(address server, uint256 amount, uint256 expiresBy)`
Locks funds for a specific server until expiration.

### `withdraw(address server)`
Withdraws unused funds after deposit expiration.

### `transferWithAuthorization(...)`
Settles cumulative payment authorization. Transfers incremental amount (`totalValue - amountUsed`).

### `receiveWithAuthorization(...)`
Server-initiated pull payment with server signature.

## EIP-712 Signature Structure

```
TransferWithAuthorization(address from,address to,uint256 totalValue)
```

**Note**: `totalValue` is cumulative, not incremental. The contract calculates the incremental amount automatically.

## Security Considerations

- Replay attacks prevented by `require(totalValue > amountUsed)`
- Expired deposits cannot be used for new transfers
- Zero-address checks prevent invalid operations
- SafeERC20 used for token transfers

## Deployment

Deploy with:
- Domain name: "X402Payment"
- Domain version: "1"
- Token address: USDC contract address for the network

## Testing

Run tests with:
```bash
npm test
```

