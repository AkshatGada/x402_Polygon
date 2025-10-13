const { createX402Client } = require('x402-axios');
const { ethers } = require('ethers');
require('dotenv').config();

// Configuration
const FACILITATOR_URL = 'http://localhost:3000'; // Update this with your facilitator URL
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Make sure to set this in .env
const CHAIN_ID = 80001; // Mumbai testnet

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('Please set PRIVATE_KEY in .env file');
  }

  // Create wallet instance
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log('Using wallet address:', wallet.address);

  // Create x402 client
  const client = createX402Client({
    baseURL: FACILITATOR_URL,
    chainId: CHAIN_ID,
    signer: wallet
  });

  try {
    // Test /verify endpoint
    console.log('\nTesting /verify endpoint...');
    const verifyResponse = await client.verify({
      amount: '1000000000000000', // 0.001 MATIC
      recipient: wallet.address,
      data: '0x'
    });
    console.log('Verify Response:', verifyResponse);

    // Test /settle endpoint
    console.log('\nTesting /settle endpoint...');
    const settleResponse = await client.settle({
      amount: '1000000000000000', // 0.001 MATIC
      recipient: wallet.address,
      data: '0x'
    });
    console.log('Settle Response:', settleResponse);

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during testing:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

main().catch(console.error); 