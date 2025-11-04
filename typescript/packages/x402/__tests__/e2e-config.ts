import { createPublicClient, createWalletClient, http, Account, PublicClient, WalletClient, Chain } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { Hex } from 'viem'

/**
 * E2E Test Configuration for X402-SCALED on Polygon Amoy
 */

// Test wallet (funded on testnet)
export const TEST_PRIVATE_KEY = 'c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9' as Hex
export const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY)
export const TEST_WALLET_ADDRESS = '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00'

// Test server address (receiving payments)
export const TEST_SERVER_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc0e7595f97D67'

// Network configuration
export const NETWORK_CONFIG = {
  name: 'Polygon Amoy',
  chainId: 80002,
  rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology'
}

// Token configuration
export const USDC_CONFIG = {
  address: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0a7043',
  name: 'USDC',
  decimals: 6
}

// Facilitator configuration
export const FACILITATOR_CONFIG = {
  url: process.env.FACILITATOR_URL || 'http://localhost:3333',
  timeout: 30000
}

// Payment contract (will be set during deployment)
export let PAYMENT_CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS || ''

// Test amounts
export const TEST_AMOUNTS = {
  deposit: '100000000', // 100 USDC (100 * 10^6)
  perRequest: '1000000', // 1 USDC per request
  depositExpiry: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
}

// Timeouts
export const TIMEOUTS = {
  deposit: 30000,
  verify: 5000,
  settle: 60000,
  rpc: 10000
}

// Client instances
let publicClient: PublicClient | null = null
let walletClient: WalletClient | null = null

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: polygonAmoy as Chain,
      transport: http(NETWORK_CONFIG.rpcUrl)
    })
  }
  return publicClient
}

export function getWalletClient(): WalletClient {
  if (!walletClient) {
    walletClient = createWalletClient({
      account: TEST_ACCOUNT,
      chain: polygonAmoy as Chain,
      transport: http(NETWORK_CONFIG.rpcUrl)
    })
  }
  return walletClient
}

export function setPaymentContractAddress(address: string): void {
  PAYMENT_CONTRACT_ADDRESS = address
}

/**
 * Helper: Wait for block confirmations
 */
export async function waitForConfirmation(txHash: Hex, confirmations: number = 1): Promise<void> {
  const client = getPublicClient()
  const maxAttempts = 60 // 60 seconds max wait
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash })
      if (receipt && receipt.blockNumber) {
        const currentBlock = await client.getBlockNumber()
        const confirmsReceived = Number(currentBlock) - Number(receipt.blockNumber)
        if (confirmsReceived >= confirmations) {
          return
        }
      }
    } catch (error) {
      // Transaction not yet mined
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
    attempts++
  }

  throw new Error(`Transaction ${txHash} did not confirm after ${maxAttempts} seconds`)
}

/**
 * Helper: Get USDC balance
 */
export async function getUsdcBalance(address: string): Promise<bigint> {
  const client = getPublicClient()

  const USDC_ABI = [
    {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    }
  ] as const

  try {
    const balance = await client.readContract({
      address: USDC_CONFIG.address as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    })
    return balance as bigint
  } catch (error) {
    console.error('Failed to get USDC balance:', error)
    return 0n
  }
}

/**
 * Helper: Approve USDC spending
 */
export async function approveUsdc(spender: string, amount: string): Promise<Hex> {
  const client = getWalletClient()

  const USDC_ABI = [
    {
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      name: 'approve',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function'
    }
  ] as const

  const txHash = await client.writeContract({
    account: TEST_ACCOUNT,
    address: USDC_CONFIG.address as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [spender as `0x${string}`, BigInt(amount)]
  })

  return txHash as Hex
}

/**
 * Helper: Check testnet health
 */
export async function checkTestnetHealth(): Promise<{ healthy: boolean; details: any }> {
  try {
    const client = getPublicClient()

    // Check RPC connection
    const blockNumber = await client.getBlockNumber()

    // Check USDC balance
    const balance = await getUsdcBalance(TEST_WALLET_ADDRESS)

    // Check facilitator
    const facilitatorResponse = await fetch(`${FACILITATOR_CONFIG.url}/health`)
    const facilitatorHealthy = facilitatorResponse.status === 200

    return {
      healthy: blockNumber > 0n && balance > 0n && facilitatorHealthy,
      details: {
        blockNumber: blockNumber.toString(),
        balance: (balance / BigInt(10 ** 6)).toString() + ' USDC',
        facilitatorUrl: FACILITATOR_CONFIG.url,
        facilitatorHealthy
      }
    }
  } catch (error) {
    return {
      healthy: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

export const E2E_CONFIG = {
  network: NETWORK_CONFIG,
  wallet: {
    address: TEST_WALLET_ADDRESS,
    privateKey: TEST_PRIVATE_KEY
  },
  server: TEST_SERVER_ADDRESS,
  token: USDC_CONFIG,
  facilitator: FACILITATOR_CONFIG,
  amounts: TEST_AMOUNTS,
  timeouts: TIMEOUTS
}
