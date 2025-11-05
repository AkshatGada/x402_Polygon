import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

// USDC address on Polygon Amoy testnet
const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'

interface DeploymentRecord {
  contractAddress: string
  deploymentTx: string
  deploymentBlock: number
  timestamp: string
  network: string
  tokenAddress: string
  gasUsed: string
  gasPrice: string
  deployer: string
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: string
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  X402-SCALED Payment.sol Deployment to Polygon Amoy      ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')

  // Get deployer
  const [deployer] = await ethers.getSigners()
  console.log(`[*] Deployer: ${deployer.address}`)

  // Check network
  const network = await ethers.provider.getNetwork()
  console.log(`[*] Network: ${network.name} (chainId: ${network.chainId})`)

  if (Number(network.chainId) !== 80002) {
    throw new Error('This script is configured for Polygon Amoy (chainId: 80002). Please switch networks.')
  }

  // Check USDC exists
  console.log(`[*] USDC Address: ${USDC_ADDRESS}`)
  const usdcCode = await ethers.provider.getCode(USDC_ADDRESS)
  if (usdcCode === '0x') {
    throw new Error('USDC contract not found at address. Make sure you are on Polygon Amoy.')
  }
  console.log('[✓] USDC contract verified')
  console.log('')

  // Get gas price
  const gasPrice = await ethers.provider.getFeeData()
  console.log(`[*] Gas price: ${gasPrice.gasPrice?.toString() || 'unknown'} wei`)
  console.log('')

  // Deploy Payment contract
  console.log('[→] Deploying Payment.sol...')
  const Payment = await ethers.getContractFactory('Payment')

  const payment = await Payment.deploy(
    'X402Payment',      // EIP-712 domain name
    '1',                // EIP-712 domain version
    USDC_ADDRESS        // USDC token address
  )

  await payment.waitForDeployment()
  const deploymentAddress = await payment.getAddress()

  console.log(`[✓] Payment contract deployed to: ${deploymentAddress}`)
  console.log('')

  // Get deployment transaction
  const deploymentTx = payment.deploymentTransaction()
  if (!deploymentTx) {
    throw new Error('Could not retrieve deployment transaction')
  }

  const receipt = await deploymentTx.wait()
  if (!receipt) {
    throw new Error('Deployment transaction receipt not found')
  }

  const gasUsed = receipt.gasUsed.toString()
  const blockNumber = receipt.blockNumber

  console.log(`[*] Deployment TX: ${deploymentTx.hash}`)
  console.log(`[*] Block: ${blockNumber}`)
  console.log(`[*] Gas used: ${gasUsed}`)
  console.log('')

  // Verify domain separator
  console.log('[→] Verifying EIP-712 domain...')
  try {
    const domainSeparator = await payment.DOMAIN_SEPARATOR()
    console.log(`[✓] Domain separator: ${domainSeparator}`)
  } catch (e) {
    console.log('[⚠] Domain separator verification skipped (EIP712 inherited)')
  }
  console.log('')

  // Create deployment record
  const deploymentRecord: DeploymentRecord = {
    contractAddress: deploymentAddress,
    deploymentTx: deploymentTx.hash,
    deploymentBlock: blockNumber,
    timestamp: new Date().toISOString(),
    network: 'polygon-amoy',
    tokenAddress: USDC_ADDRESS,
    gasUsed: gasUsed,
    gasPrice: gasPrice.gasPrice?.toString() || '0',
    deployer: deployer.address,
    domain: {
      name: 'X402Payment',
      version: '1',
      chainId: 80002,
      verifyingContract: deploymentAddress
    }
  }

  // Save deployment record
  const outputFile = path.join(__dirname, '..', '.deployed-amoy.json')
  fs.writeFileSync(outputFile, JSON.stringify(deploymentRecord, null, 2))
  console.log(`[✓] Deployment record saved to: ${outputFile}`)
  console.log('')

  // Print summary
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║                   DEPLOYMENT SUMMARY                      ║')
  console.log('╠═══════════════════════════════════════════════════════════╣')
  console.log(`║ Contract Address:  ${deploymentAddress.padEnd(50).substring(0, 50)} ║`)
  console.log(`║ Deployment TX:     ${deploymentTx.hash.substring(0, 50)} ║`)
  console.log(`║ Block:             ${blockNumber.toString().padEnd(50)} ║`)
  console.log(`║ Gas Used:          ${gasUsed.padEnd(50)} ║`)
  console.log(`║ Network:           ${'Polygon Amoy (80002)'.padEnd(50)} ║`)
  console.log(`║ Token:             ${'USDC'.padEnd(50)} ║`)
  console.log('╠═══════════════════════════════════════════════════════════╣')
  console.log('║                      NEXT STEPS                            ║')
  console.log('╠═══════════════════════════════════════════════════════════╣')
  console.log('║                                                            ║')
  console.log(`║ 1. Update PAYMENT_CONTRACT_ADDRESS in .env               ║`)
  console.log(`║    ${deploymentAddress}`)
  console.log('║                                                            ║')
  console.log('║ 2. Start the test facilitator:                           ║')
  console.log('║    cd demo/test-facilitator-scaled                       ║')
  console.log('║    npm install && npm start                              ║')
  console.log('║                                                            ║')
  console.log('║ 3. Run E2E tests:                                         ║')
  console.log('║    npm run test:e2e                                       ║')
  console.log('║                                                            ║')
  console.log('║ 4. View on Polygonscan:                                  ║')
  console.log(`║    https://amoy.polygonscan.com/address/${deploymentAddress}`)
  console.log('║                                                            ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')

  return deploymentRecord
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
