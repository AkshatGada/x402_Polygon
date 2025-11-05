import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPublicClient, getWalletClient, approveUsdc, getUsdcBalance, checkTestnetHealth, waitForConfirmation, TEST_WALLET_ADDRESS, TEST_SERVER_ADDRESS, PAYMENT_CONTRACT_ADDRESS, TEST_AMOUNTS, TIMEOUTS } from './e2e-config'
import { Address, Hex } from 'viem'

/**
 * E2E Test: Deposit Flow
 * 
 * Tests the complete deposit flow:
 * 1. Check wallet has USDC balance
 * 2. Approve USDC spending for Payment contract
 * 3. Create deposit on Payment contract
 * 4. Wait for confirmation
 * 5. Query contract to verify deposit
 */

describe('E2E: Deposit Flow', () => {
  let initialBalance: bigint
  let approvalTxHash: Hex | null = null
  let depositTxHash: Hex | null = null

  beforeAll(async () => {
    console.log('\n[Setup] Checking testnet health...')
    const health = await checkTestnetHealth()

    if (!health.healthy) {
      console.error('❌ Testnet health check failed:', health.details)
      throw new Error('Testnet not healthy. Check facilitator and RPC connection.')
    }

    console.log('✓ Testnet healthy')
    console.log('  Block:', health.details.blockNumber)
    console.log('  Balance:', health.details.balance)
    console.log('  Facilitator:', health.details.facilitatorHealthy ? 'OK' : 'ERROR')

    if (!PAYMENT_CONTRACT_ADDRESS) {
      throw new Error('PAYMENT_CONTRACT_ADDRESS not set. Please deploy Payment.sol first.')
    }

    console.log('\n[Setup] Payment contract:', PAYMENT_CONTRACT_ADDRESS)

    // Get initial balance
    initialBalance = await getUsdcBalance(TEST_WALLET_ADDRESS)
    console.log('[Setup] Initial USDC balance:', (initialBalance / BigInt(10 ** 6)).toString(), 'USDC')

    if (initialBalance < BigInt(TEST_AMOUNTS.deposit)) {
      throw new Error(
        `Insufficient USDC balance. Have ${(initialBalance / BigInt(10 ** 6)).toString()}, need ${(BigInt(TEST_AMOUNTS.deposit) / BigInt(10 ** 6)).toString()}`
      )
    }
  }, TIMEOUTS.deposit + 10000)

  it('should approve USDC spending', async () => {
    console.log('\n[Test] Approving USDC spending for Payment contract...')

    try {
      approvalTxHash = await approveUsdc(PAYMENT_CONTRACT_ADDRESS, TEST_AMOUNTS.deposit)
      console.log('[Test] Approval TX:', approvalTxHash)

      expect(approvalTxHash).toBeDefined()
      expect(approvalTxHash).toMatch(/^0x[a-f0-9]{64}$/)

      console.log('[Test] Waiting for approval confirmation...')
      await waitForConfirmation(approvalTxHash, 1)
      console.log('✓ Approval confirmed')
    } catch (error) {
      console.error('❌ Approval failed:', error)
      throw error
    }
  }, TIMEOUTS.deposit)

  it('should create deposit on Payment contract', async () => {
    console.log('\n[Test] Creating deposit on Payment contract...')

    if (!approvalTxHash) {
      throw new Error('Approval transaction not completed')
    }

    try {
      const walletClient = getWalletClient()

      const PAYMENT_ABI = [
        {
          inputs: [
            { name: 'server', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'expiresBy', type: 'uint256' }
          ],
          name: 'deposit',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ] as const

      depositTxHash = await walletClient.writeContract({
        address: PAYMENT_CONTRACT_ADDRESS as Address,
        abi: PAYMENT_ABI,
        functionName: 'deposit',
        args: [
          TEST_SERVER_ADDRESS as Address,
          BigInt(TEST_AMOUNTS.deposit),
          BigInt(TEST_AMOUNTS.depositExpiry)
        ]
      }) as Hex

      console.log('[Test] Deposit TX:', depositTxHash)

      expect(depositTxHash).toBeDefined()
      expect(depositTxHash).toMatch(/^0x[a-f0-9]{64}$/)

      console.log('[Test] Waiting for deposit confirmation...')
      await waitForConfirmation(depositTxHash, 1)
      console.log('✓ Deposit confirmed')
    } catch (error) {
      console.error('❌ Deposit failed:', error)
      throw error
    }
  }, TIMEOUTS.deposit)

  it('should verify deposit on contract', async () => {
    console.log('\n[Test] Verifying deposit on Payment contract...')

    if (!depositTxHash) {
      throw new Error('Deposit transaction not completed')
    }

    try {
      const client = getPublicClient()

      const PAYMENT_ABI = [
        {
          inputs: [
            { name: 'user', type: 'address' },
            { name: 'server', type: 'address' }
          ],
          name: 'deposits',
          outputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'expiresBy', type: 'uint256' },
            { name: 'amountUsed', type: 'uint256' }
          ],
          stateMutability: 'view',
          type: 'function'
        }
      ] as const

      const deposit = await client.readContract({
        address: PAYMENT_CONTRACT_ADDRESS as Address,
        abi: PAYMENT_ABI,
        functionName: 'deposits',
        args: [TEST_WALLET_ADDRESS as Address, TEST_SERVER_ADDRESS as Address]
      }) as [bigint, bigint, bigint]

      const [amount, expiresBy, amountUsed] = deposit

      console.log('[Test] Deposit verified:')
      console.log('  Amount locked:', (amount / BigInt(10 ** 6)).toString(), 'USDC')
      console.log('  Amount used:', (amountUsed / BigInt(10 ** 6)).toString(), 'USDC')
      console.log('  Expires at:', new Date(Number(expiresBy) * 1000).toISOString())

      // Assertions
      expect(amount).toBe(BigInt(TEST_AMOUNTS.deposit))
      expect(amountUsed).toBe(0n)
      expect(expiresBy).toBe(BigInt(TEST_AMOUNTS.depositExpiry))

      console.log('✓ Deposit verification passed')
    } catch (error) {
      console.error('❌ Deposit verification failed:', error)
      throw error
    }
  }, TIMEOUTS.rpc)

  it('should show decreased USDC balance', async () => {
    console.log('\n[Test] Checking USDC balance after deposit...')

    try {
      const finalBalance = await getUsdcBalance(TEST_WALLET_ADDRESS)
      const spent = initialBalance - finalBalance

      console.log('[Test] Balance check:')
      console.log('  Initial:', (initialBalance / BigInt(10 ** 6)).toString(), 'USDC')
      console.log('  Final:', (finalBalance / BigInt(10 ** 6)).toString(), 'USDC')
      console.log('  Spent:', (spent / BigInt(10 ** 6)).toString(), 'USDC')

      // Should have spent the deposit amount (plus some gas)
      expect(spent).toBeGreaterThan(0n)
      expect(spent).toBeGreaterThanOrEqual(BigInt(TEST_AMOUNTS.deposit))

      console.log('✓ Balance check passed')
    } catch (error) {
      console.error('❌ Balance check failed:', error)
      throw error
    }
  }, TIMEOUTS.rpc)

  afterAll(async () => {
    console.log('\n[Cleanup] Deposit flow test completed')
    console.log('  Approval TX:', approvalTxHash)
    console.log('  Deposit TX:', depositTxHash)
  })
})
