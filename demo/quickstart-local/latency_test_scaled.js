import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import 'dotenv/config';

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY not set");
}

const PAYMENT_CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS;
if (!PAYMENT_CONTRACT_ADDRESS) {
  throw new Error("PAYMENT_CONTRACT_ADDRESS not set");
}

const account = privateKeyToAccount(`0x${privateKey}`);
const client = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http()
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const url = 'http://127.0.0.1:4021/weather';

const ITERATIONS = parseInt(process.env.ITERATIONS || "5");

async function runTest() {
  const latencies = [];
  
  for (let i = 1; i <= ITERATIONS; i++) {
    const startTime = performance.now();
    try {
      const response = await fetchWithPayment(url, { method: "GET" });
      const endTime = performance.now();
      const latency = endTime - startTime;
      latencies.push(latency);
      process.stdout.write(`${i},${latency.toFixed(2)}\n`);
    } catch (error) {
      process.stdout.write(`${i},ERROR\n`);
    }
  }
}

runTest();

