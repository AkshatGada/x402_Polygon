import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';
import 'dotenv/config';

const WALLETS = [
  { address: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00', key: 'c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9', name: 'Wallet 1' },
  { address: '0x48c83C7DE03D2019C5465059d3b611F89A23cAe8', key: '5abb4ecc577b9be46412b6e247ca2e5f2ed793ace48d21e5d3d2de4827da608e', name: 'Wallet 2' },
  { address: '0x744eC296Ba22E8296Ae5a83E0f3f0057f7E10Be3', key: 'cdc8af8f37b38684f8f18a2266b6e701174f0f331b97f08184393ea92de43c40', name: 'Wallet 3' },
];

const TRANSACTIONS_PER_WALLET = 5;
const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';

async function makePayment(walletInfo, txNumber) {
  const startTime = Date.now();
  const txId = `${walletInfo.name}-TX${txNumber}`;

  console.log(`[${txId}] Starting transaction from ${walletInfo.address}`);

  try {
    // Create wallet client
    const account = privateKeyToAccount(`0x${walletInfo.key}`);
    const walletClient = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http()
    });

    const publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http()
    });

    const fetchWithPay = wrapFetchWithPayment(fetch, walletClient, publicClient);

    // Make payment request
    const response = await fetchWithPay(url, { method: 'GET' });
    const body = await response.json();
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    if (response.status === 200 && body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      const paymentResponse = JSON.parse(atob(rawPaymentResponse));

      console.log(`[${txId}] ✅ SUCCESS in ${duration.toFixed(2)}s - TX: ${paymentResponse.transaction.substring(0, 20)}...`);

      return {
        success: true,
        wallet: walletInfo.name,
        txNumber,
        txHash: paymentResponse.transaction,
        time: duration,
        id: txId
      };
    } else {
      console.log(`[${txId}] ❌ FAILED in ${duration.toFixed(2)}s - Status: ${response.status}`);

      return {
        success: false,
        wallet: walletInfo.name,
        txNumber,
        error: body,
        time: duration,
        status: response.status,
        id: txId
      };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`[${txId}] ❌ ERROR in ${duration.toFixed(2)}s - ${error.message}`);

    return {
      success: false,
      wallet: walletInfo.name,
      txNumber,
      error: error.message,
      time: duration,
      id: txId
    };
  }
}

async function runSequentialTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 SEQUENTIAL WALLET TEST - 5 Transactions per Wallet');
  console.log('='.repeat(80));
  console.log(`📍 Target URL: ${url}`);
  console.log(`🌐 Network: Polygon Amoy`);
  console.log(`💰 Total transactions: ${WALLETS.length * TRANSACTIONS_PER_WALLET} (${TRANSACTIONS_PER_WALLET} per wallet)`);
  console.log(`📊 Strategy: All transactions launched simultaneously`);
  console.log('='.repeat(80) + '\n');

  const testStartTime = Date.now();
  const allPromises = [];

  // Launch all transactions simultaneously
  for (const wallet of WALLETS) {
    for (let i = 1; i <= TRANSACTIONS_PER_WALLET; i++) {
      allPromises.push(makePayment(wallet, i));
    }
  }

  console.log(`\n⏳ Waiting for all ${allPromises.length} transactions to complete...\n`);

  // Wait for all transactions
  const results = await Promise.all(allPromises);
  const testEndTime = Date.now();
  const totalTestTime = (testEndTime - testStartTime) / 1000;

  // Analyze results by wallet
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS BY WALLET');
  console.log('='.repeat(80) + '\n');

  const walletStats = {};

  for (const wallet of WALLETS) {
    const walletResults = results.filter(r => r.wallet === wallet.name);
    const successful = walletResults.filter(r => r.success);
    const failed = walletResults.filter(r => !r.success);

    walletStats[wallet.name] = {
      total: walletResults.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / walletResults.length) * 100,
      avgTime: successful.length > 0
        ? successful.reduce((sum, r) => sum + r.time, 0) / successful.length
        : 0,
      successful_txs: successful,
      failed_txs: failed
    };

    console.log(`${wallet.name} (${wallet.address})`);
    console.log(`  ✅ Successful: ${successful.length}/${walletResults.length}`);
    console.log(`  ❌ Failed: ${failed.length}/${walletResults.length}`);
    console.log(`  📊 Success Rate: ${walletStats[wallet.name].successRate.toFixed(2)}%`);
    if (successful.length > 0) {
      console.log(`  ⏱️  Avg Time: ${walletStats[wallet.name].avgTime.toFixed(2)}s`);
      console.log(`  🔗 Transaction Hashes:`);
      successful.forEach(tx => {
        console.log(`      TX${tx.txNumber}: ${tx.txHash}`);
      });
    }
    console.log();
  }

  // Overall statistics
  const totalSuccessful = results.filter(r => r.success).length;
  const totalFailed = results.filter(r => !r.success).length;
  const overallSuccessRate = (totalSuccessful / results.length) * 100;
  const actualTPS = totalSuccessful / totalTestTime;

  console.log('='.repeat(80));
  console.log('📈 OVERALL RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Total Successful: ${totalSuccessful}/${results.length} (${overallSuccessRate.toFixed(2)}%)`);
  console.log(`❌ Total Failed: ${totalFailed}/${results.length}`);
  console.log(`⏱️  Total Test Time: ${totalTestTime.toFixed(2)}s`);
  console.log(`📊 Actual TPS: ${actualTPS.toFixed(2)} transactions/second`);
  console.log('='.repeat(80) + '\n');

  // Summary table
  console.log('📋 WALLET COMPARISON TABLE');
  console.log('='.repeat(80));
  console.log('| Wallet   | Success | Failed | Success Rate | Avg Time |');
  console.log('|----------|---------|--------|--------------|----------|');

  for (const wallet of WALLETS) {
    const stats = walletStats[wallet.name];
    const name = wallet.name.padEnd(8);
    const success = `${stats.successful}/${stats.total}`.padEnd(7);
    const failed = stats.failed.toString().padEnd(6);
    const rate = `${stats.successRate.toFixed(0)}%`.padEnd(12);
    const avgTime = stats.successful > 0 ? `${stats.avgTime.toFixed(2)}s`.padEnd(8) : 'N/A'.padEnd(8);
    console.log(`| ${name} | ${success} | ${failed} | ${rate} | ${avgTime} |`);
  }
  console.log('='.repeat(80) + '\n');

  // Failed transaction details
  if (totalFailed > 0) {
    console.log('❌ FAILED TRANSACTION DETAILS');
    console.log('='.repeat(80));
    const failedTxs = results.filter(r => !r.success);
    failedTxs.forEach(tx => {
      console.log(`[${tx.id}]`);
      console.log(`  Status: ${tx.status || 'Error'}`);
      console.log(`  Time: ${tx.time.toFixed(2)}s`);
      if (typeof tx.error === 'string') {
        console.log(`  Error: ${tx.error}`);
      } else if (tx.error && tx.error.payer) {
        console.log(`  Internal Payer Address: ${tx.error.payer}`);
      }
      console.log();
    });
  }

  return {
    totalSuccessful,
    totalFailed,
    overallSuccessRate,
    actualTPS,
    totalTestTime,
    walletStats
  };
}

runSequentialTest().catch(console.error);

