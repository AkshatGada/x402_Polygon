import axios from 'axios';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config({ path: '../.env.local' });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:5401';
const RESOURCE_URL = process.env.QUICKSTART_RESOURCE_URL || process.env.RESOURCE_SERVER_URL || 'http://127.0.0.1:8080';

const wallet = new ethers.Wallet(PRIVATE_KEY);

async function waitForSeller() {
  console.log('Waiting for seller at', RESOURCE_URL);
  const maxWaitMs = 20000;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await axios.get(`${RESOURCE_URL}/healthz`);
      if (r.status === 200) return;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Seller readiness timed out');
}

async function run() {
  await waitForSeller();

  // Initial request (expect 402)
  try {
    await axios.post(`${RESOURCE_URL}/premium/summarize`);
  } catch (e) {
    if (!(e.response && e.response.status === 402)) {
      console.error('Unexpected error calling resource', e.message);
      return;
    }
    console.log('Received 402, building payment payload');

    const now = Math.floor(Date.now() / 1000);
    const PAY_TO = process.env.CDP_PAY_TO || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const payload = {
      from: wallet.address,
      to: PAY_TO,
      value: Number(process.env.PAYMENT_AMOUNT || 10000),
      validAfter: now - 60,
      validBefore: now + 3600,
      nonce: ethers.hexlify(ethers.randomBytes(32)),
      verifyingContract: process.env.AMOY_USDC_ADDRESS || '',
      chainId: 80002
    };

    const domain = { name: 'USDC', version: '2', chainId: payload.chainId, verifyingContract: payload.verifyingContract };
    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    payload.signature = await wallet.signTypedData(domain, types, {
      from: payload.from,
      to: payload.to,
      value: payload.value,
      validAfter: payload.validAfter,
      validBefore: payload.validBefore,
      nonce: payload.nonce
    });

    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Retry original request with X-PAYMENT header (seller will call facilitator /verify and /settle)
    try {
      const retr = await axios.post(`${RESOURCE_URL}/premium/summarize`, {}, { headers: { 'x-payment': b64 } });
      console.log('Retry response', retr.status, retr.data);
      const payResp = retr.headers && retr.headers['x-payment-response'];
      if (payResp) console.log('X-PAYMENT-RESPONSE (retry):', payResp);
    } catch (e) {
      console.error('Retry failed', e.response?.data || e.message);
    }
  }
}

run().catch(console.error); 