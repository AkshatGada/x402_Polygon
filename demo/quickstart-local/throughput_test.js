import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { wrapFetchWithPayment } from 'x402-fetch';
import 'dotenv/config';

const WALLETS = [
  { address: '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00', key: 'c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9' },
  { address: '0x48c83C7DE03D2019C5465059d3b611F89A23cAe8', key: '5abb4ecc577b9be46412b6e247ca2e5f2ed793ace48d21e5d3d2de4827da608e' },
  { address: '0x744eC296Ba22E8296Ae5a83E0f3f0057f7E10Be3', key: 'cdc8af8f37b38684f8f18a2266b6e701174f0f331b97f08184393ea92de43c40' },
];

const url = process.env.QUICKSTART_RESOURCE_URL || 'http://127.0.0.1:4021/weather';

// Test configurations
const TEST_CONFIGS = [
  { wallets: 50, delay: 0, name: 'Burst Test - 50 simultaneous' },
];

async function makePayment(walletInfo, id) {
  const startTime = Date.now();

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

    if (response.status === 200 && body.report) {
      const rawPaymentResponse = response.headers.get("x-payment-response");
      const paymentResponse = JSON.parse(atob(rawPaymentResponse));

      return {
        success: true,
        wallet: walletInfo.address,
        txHash: paymentResponse.transaction,
        time: (endTime - startTime) / 1000,
        id
      };
    } else {
      return {
        success: false,
        wallet: walletInfo.address,
        error: body,
        time: (endTime - startTime) / 1000,
        id
      };
    }
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      wallet: walletInfo.address,
      error: error.message,
      time: (endTime - startTime) / 1000,
      id
    };
  }
}

async function runThroughputTest(config) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${config.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Configuration:`);
  console.log(`   - Number of transactions: ${config.wallets}`);
  console.log(`   - Delay between transactions: ${config.delay}ms`);
  console.log(`   - Target TPS: ${config.delay === 0 ? 'MAX' : (1000 / config.delay).toFixed(2)}`);
  console.log(`${'='.repeat(80)}\n`);

  const promises = [];
  const testStartTime = Date.now();

  // Launch all transactions
  for (let i = 0; i < config.wallets; i++) {
    const wallet = WALLETS[i % WALLETS.length];

    if (config.delay > 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }

    promises.push(makePayment(wallet, i + 1));
    console.log(`   [${i + 1}/${config.wallets}] Launched transaction from ${wallet.address}`);
  }

  console.log(`\nWaiting for all transactions to complete...\n`);

  // Wait for all to complete
  const results = await Promise.all(promises);
  const testEndTime = Date.now();
  const totalTestTime = (testEndTime - testStartTime) / 1000;

  // Calculate statistics
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const successRate = (successful.length / results.length) * 100;
  const avgTxTime = successful.length > 0
    ? successful.reduce((sum, r) => sum + r.time, 0) / successful.length
    : 0;
  const minTxTime = successful.length > 0
    ? Math.min(...successful.map(r => r.time))
    : 0;
  const maxTxTime = successful.length > 0
    ? Math.max(...successful.map(r => r.time))
    : 0;
  const actualTPS = successful.length / totalTestTime;

  // Print results
  console.log(`${'='.repeat(80)}`);
  console.log(`RESULTS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Successful: ${successful.length}/${config.wallets} (${successRate.toFixed(2)}%)`);
  console.log(`Failed: ${failed.length}/${config.wallets}`);
  console.log(`Total test time: ${totalTestTime.toFixed(2)}s`);
  console.log(`Actual TPS: ${actualTPS.toFixed(2)} transactions/second`);
  console.log(`Average TX time: ${avgTxTime.toFixed(2)}s`);
  console.log(`Min TX time: ${minTxTime.toFixed(2)}s`);
  console.log(`Max TX time: ${maxTxTime.toFixed(2)}s`);
  console.log(`${'='.repeat(80)}\n`);

  // Print failed transactions if any
  if (failed.length > 0) {
    console.log(`Failed Transactions:`);
    failed.forEach(f => {
      console.log(`   [${f.id}] ${f.wallet}: ${JSON.stringify(f.error)}`);
    });
    console.log();
  }

  // Print all successful transactions
  if (successful.length > 0) {
    console.log(`All Successful Transactions:`);
    successful.forEach(s => {
      console.log(`   [${s.id}] ${s.wallet}`);
      console.log(`       TX Hash: ${s.txHash}`);
      console.log(`       Time: ${s.time.toFixed(2)}s`);
    });
    console.log();
  }

  return {
    config,
    totalTime: totalTestTime,
    successful: successful.length,
    failed: failed.length,
    successRate,
    actualTPS,
    avgTxTime,
    minTxTime,
    maxTxTime,
  };
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('POLYGON FACILITATOR THROUGHPUT TEST');
  console.log('='.repeat(80));
  console.log(`Target URL: ${url}`);
  console.log(`Network: Polygon Amoy`);
  console.log(`Wallets: ${WALLETS.length} (rotating)`);
  console.log('='.repeat(80));

  const allResults = [];

  for (const config of TEST_CONFIGS) {
    const result = await runThroughputTest(config);
    allResults.push(result);

    // Wait between tests to avoid rate limiting
    console.log('Waiting 10 seconds before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('THROUGHPUT TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('\n| Test Name                          | TPS    | Success Rate | Avg TX Time |');
  console.log('|------------------------------------|--------|--------------|-------------|');

  allResults.forEach(r => {
    const name = r.config.name.padEnd(34);
    const tps = r.actualTPS.toFixed(2).padStart(6);
    const success = `${r.successRate.toFixed(0)}%`.padStart(12);
    const avgTime = `${r.avgTxTime.toFixed(2)}s`.padStart(11);
    console.log(`| ${name} | ${tps} | ${success} | ${avgTime} |`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('All tests completed successfully.');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);

