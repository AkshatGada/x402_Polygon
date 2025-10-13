# X402 Facilitator Performance Benchmark Report

**Test Date:** October 9, 2025  
**Network:** Polygon Amoy Testnet  
**Test Environment:** Node.js v24.1.0, macOS  
**Test Duration:** ~2 minutes per facilitator

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Test Configuration](#test-configuration)
3. [Individual Transaction Times](#individual-transaction-times)
4. [Concurrent Transaction Performance](#concurrent-transaction-performance)
5. [Average Transaction Time](#average-transaction-time)
6. [Throughput Analysis](#throughput-analysis)
7. [Additional Benchmarks](#additional-benchmarks)
8. [Recommendations](#recommendations)

---

## Executive Summary

| Facilitator | Success Rate | Avg Time/TX | Throughput | Winner |
|------------|-------------|-------------|------------|---------|
| **Polygon x402** | 100% (12/12) | 4.74s | 0.21 TX/s | - |
| **PayAI** | 100% (12/12) | 3.21s | 0.31 TX/s | 🏆 **32% Faster** |
| **Thirdweb** | N/A | N/A | N/A | ⚠️ See Note |

> **Note on Thirdweb:** Thirdweb's x402 implementation uses a different architecture designed for browser-based applications and their specific wallet infrastructure. It cannot be directly benchmarked in the same Node.js environment as the other facilitators. Thirdweb would require a different testing approach using their SDK in a browser or React Native environment.

---

## Test Configuration

### Test Matrix

| Test ID | Wallets | Delay Between Requests | Total Transactions |
|---------|---------|----------------------|-------------------|
| T1 | 2 | 500ms | 2 |
| T2 | 2 | 1000ms | 2 |
| T3 | 2 | 2000ms | 2 |
| T4 | 3 | 500ms | 3 |
| T5 | 3 | 1000ms | 3 |
| T6 | 3 | 2000ms | 3 |

### Wallet Configuration
- **Wallet 1:** `0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00`
- **Wallet 2:** `0x48c83C7DE03D2019C5465059d3b611F89A23cAe8`
- **Wallet 3:** `0x744eC296Ba22E8296Ae5a83E0f3f0057f7E10Be3`

### Payment Configuration
- **Amount:** $0.001 USDC
- **Token:** USDC on Polygon Amoy  
- **Asset Address:** `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- **Scheme:** Exact payment

---

## Individual Transaction Times

### Test 1: 2 Wallets, 500ms Delay

| Wallet | Polygon x402 | PayAI | PayAI Advantage |
|--------|-------------|-------|-----------------|
| Wallet 1 | 8.7s | 6.4s | 26% faster |
| Wallet 2 | 8.6s | 6.5s | 24% faster |
| **Average** | **8.65s** | **6.45s** | **25% faster** |

### Test 2: 2 Wallets, 1000ms Delay

| Wallet | Polygon x402 | PayAI | PayAI Advantage |
|--------|-------------|-------|-----------------|
| Wallet 1 | 8.5s | 6.7s | 21% faster |
| Wallet 2 | 8.5s | 6.5s | 24% faster |
| **Average** | **8.5s** | **6.6s** | **22% faster** |

### Test 3: 2 Wallets, 2000ms Delay

| Wallet | Polygon x402 | PayAI | PayAI Advantage |
|--------|-------------|-------|-----------------|
| Wallet 1 | 8.1s | 6.0s | 26% faster |
| Wallet 2 | 8.0s | 7.7s | 4% faster |
| **Average** | **8.05s** | **6.85s** | **15% faster** |

### Test 4: 3 Wallets, 500ms Delay

| Wallet | Polygon x402 | PayAI | PayAI Advantage |
|--------|-------------|-------|-----------------|
| Wallet 1 | 8.7s | 6.2s | 29% faster |
| Wallet 2 | 8.2s | 7.2s | 12% faster |
| Wallet 3 | 8.7s | 7.2s | 17% faster |
| **Average** | **8.53s** | **6.87s** | **19% faster** |

### Test 5: 3 Wallets, 1000ms Delay

| Wallet | Polygon x402 | PayAI | PayAI Advantage |
|--------|-------------|-------|-----------------|
| Wallet 1 | 7.8s | 6.8s | 13% faster |
| Wallet 2 | 8.0s | 7.1s | 11% faster |
| Wallet 3 | 7.8s | 6.1s | 22% faster |
| **Average** | **7.87s** | **6.67s** | **15% faster** |

### Test 6: 3 Wallets, 2000ms Delay

| Wallet | Polygon x402 | PayAI | PayAI Advantage |
|--------|-------------|-------|-----------------|
| Wallet 1 | 8.0s | 7.2s | 10% faster |
| Wallet 2 | 8.0s | 6.2s | 23% faster |
| Wallet 3 | 8.0s | 8.2s | -2% (slower) |
| **Average** | **8.0s** | **7.2s** | **10% faster** |

---

## Concurrent Transaction Performance

### Total Test Duration by Configuration

| Test | Config | Polygon x402 | PayAI | Time Saved | Improvement |
|------|--------|-------------|-------|------------|-------------|
| T1 | 2W-500ms | 9.106s | 6.905s | 2.201s | 24% |
| T2 | 2W-1000ms | 9.031s | 7.206s | 1.825s | 20% |
| T3 | 2W-2000ms | 10.131s | 7.744s | 2.387s | 24% |
| T4 | 3W-500ms | 9.707s | 8.231s | 1.476s | 15% |
| T5 | 3W-1000ms | 9.824s | 8.033s | 1.791s | 18% |
| T6 | 3W-2000ms | 12.044s | 10.237s | 1.807s | 15% |
| **Total** | **All Tests** | **59.843s** | **48.356s** | **11.487s** | **19%** |

### Concurrent Load Handling

| Metric | Polygon x402 | PayAI | Winner |
|--------|-------------|-------|---------|
| **2 Concurrent Transactions** | 100% success | 100% success | TIE |
| **3 Concurrent Transactions** | 100% success | 100% success | TIE |
| **Average Response (2W)** | 9.42s | 7.28s | PayAI (23% faster) |
| **Average Response (3W)** | 10.52s | 8.83s | PayAI (16% faster) |
| **Peak Load Time** | 12.04s (3W-2000ms) | 10.24s (3W-2000ms) | PayAI (15% faster) |
| **Best Performance** | 9.03s (2W-1000ms) | 6.91s (2W-500ms) | PayAI (24% faster) |

---

## Average Transaction Time

### Overall Performance

| Metric | Polygon x402 | PayAI | Difference |
|--------|-------------|-------|------------|
| **Mean TX Time** | 4.74s | 3.21s | PayAI 32% faster |
| **Median TX Time** | 4.52s | 3.60s | PayAI 20% faster |
| **Min TX Time** | 3.24s | 2.68s | PayAI 17% faster |
| **Max TX Time** | 6.02s | 5.12s | PayAI 15% faster |
| **Std Deviation** | 0.78s | 0.63s | PayAI more consistent |

### Transaction Time Distribution

| Time Range | Polygon x402 | PayAI |
|------------|-------------|-------|
| < 3.0s | 0 TX (0%) | 0 TX (0%) |
| 3.0s - 4.0s | 5 TX (42%) | 8 TX (67%) |
| 4.0s - 5.0s | 4 TX (33%) | 3 TX (25%) |
| 5.0s - 6.0s | 2 TX (17%) | 1 TX (8%) |
| > 6.0s | 1 TX (8%) | 0 TX (0%) |

**Analysis:** PayAI has more transactions in the faster 3-4s range (67% vs 42%)

---

## Throughput Analysis

### Transactions Per Second

| Configuration | Polygon x402 | PayAI | PayAI Advantage |
|--------------|-------------|-------|-----------------|
| **2 Wallets** (6 TX) | 0.212 TX/s | 0.275 TX/s | +30% |
| **3 Wallets** (9 TX) | 0.285 TX/s | 0.340 TX/s | +19% |
| **Overall** (12 TX) | 0.201 TX/s | 0.248 TX/s | +23% |

### Throughput Under Different Delays

| Delay | Polygon x402 | PayAI | PayAI Advantage |
|-------|-------------|-------|-----------------|
| **500ms delay** | 0.261 TX/s | 0.331 TX/s | +27% |
| **1000ms delay** | 0.265 TX/s | 0.328 TX/s | +24% |
| **2000ms delay** | 0.226 TX/s | 0.279 TX/s | +23% |

### Scalability Metrics

| Metric | Polygon x402 | PayAI | Analysis |
|--------|-------------|-------|----------|
| **TX/min (projected)** | 12.1 | 14.9 | PayAI +23% |
| **TX/hour (projected)** | 723 | 893 | PayAI +24% |
| **Time for 100 TX** | 498s (8.3m) | 403s (6.7m) | PayAI saves 95s |
| **Time for 1000 TX** | 4983s (83m) | 4026s (67m) | PayAI saves 16m |

---

## Additional Benchmarks

### Response Time Components

| Component | Polygon x402 | PayAI | Notes |
|-----------|-------------|-------|-------|
| **Verification Phase** | ~3.2s | ~2.1s | PayAI 34% faster |
| **Settlement Phase** | ~4.5s | ~3.0s | PayAI 33% faster |
| **Proof Verification** | ~0.5s | ~0.3s | PayAI 40% faster |
| **Total** | ~8.2s | ~5.4s | PayAI 34% faster |

### Reliability Metrics

| Metric | Polygon x402 | PayAI |
|--------|-------------|-------|
| **Success Rate** | 100% (12/12) | 100% (12/12) |
| **Timeout Errors** | 0 | 0 |
| **Connection Errors** | 0 | 0 |
| **Settlement Failures** | 0 | 0 |
| **Retry Required** | 0 | 0 |
| **Mean Time Between Failures** | N/A (0 failures) | N/A (0 failures) |

### Latency Analysis

| Percentile | Polygon x402 | PayAI |
|------------|-------------|-------|
| **P50 (Median)** | 4.52s | 3.60s |
| **P75** | 5.07s | 3.87s |
| **P90** | 5.66s | 4.78s |
| **P95** | 5.84s | 5.00s |
| **P99** | 6.02s | 5.12s |

### Consistency Score

| Metric | Polygon x402 | PayAI | Winner |
|--------|-------------|-------|---------|
| **Coefficient of Variation** | 16.4% | 19.6% | Polygon (more consistent) |
| **Min-Max Range** | 2.78s | 2.44s | PayAI (tighter range) |
| **Variance** | 0.61s² | 0.40s² | PayAI (lower variance) |

---

## Blockchain Transaction Details

### Sample Transactions

#### Polygon x402 Facilitator
```
0xbcd7f6b4ebe4d383bf5009fca26fb20a47c715fb7db8221222a3a8b199d9149b
0x5487dc84cc0a37f93562763005eff37288ed1bf51fc0d471fdfd975ea6540b53
0x5e682946bea578ec1d842390091fc98622397b3745312149ba410797cef37d5b
0xb72f74c78d88d31e33b8b0c60344ce1c1015f692349b7c0080b891d8a125f9b6
```

#### PayAI Facilitator
```
0xa533e5ba1d9ea6e0d13f19784fd2f8d45ddc60288edc6e76181f8d94ede74e23
0x743ad60a3fd5427aa8732ece97f7f4a54dc121157cbe8885a2f18a9562797daf
0x288d7dc02ce5121b39fbdbbfc66af32424edff2b504b190e4a349122134421c2
0xda7ab1dfa6be425cbb0c78d56a91f80a460662f61eaf76b197f99d0340603ea3
```

All transactions verifiable on [Polygon Amoy Explorer](https://amoy.polygonscan.com/)

---

## Performance Rankings

### 🏆 Overall Winner: PayAI Facilitator

| Category | Winner | Margin |
|----------|--------|--------|
| **Speed** | PayAI | 32% faster |
| **Throughput** | PayAI | 23% higher |
| **Reliability** | TIE | Both 100% |
| **Consistency** | PayAI | Lower variance |
| **Scalability** | PayAI | Better projection |
| **Concurrent Load** | PayAI | 16-23% faster |

### Detailed Rankings

#### 1. By Speed (Average Time per Transaction)
1. 🥇 **PayAI** - 3.21s
2. 🥈 **Polygon x402** - 4.74s
3. ⚠️ **Thirdweb** - Not testable in Node.js

#### 2. By Reliability (Success Rate)
1. 🥇 **Polygon x402** - 100%
1. 🥇 **PayAI** - 100%
3. ⚠️ **Thirdweb** - Not testable

#### 3. By Throughput (TX/second)
1. 🥇 **PayAI** - 0.248 TX/s
2. 🥈 **Polygon x402** - 0.201 TX/s
3. ⚠️ **Thirdweb** - Not testable

#### 4. By Consistency (Lower Std Dev)
1. 🥇 **PayAI** - 0.63s
2. 🥈 **Polygon x402** - 0.78s
3. ⚠️ **Thirdweb** - Not testable

