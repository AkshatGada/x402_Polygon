import { Request, Response } from 'express'
import {
  createPublicClient,
  http,
  PublicClient,
  verifyTypedData,
  Address,
  getAddress
} from 'viem'
import { polygonAmoy } from 'viem/chains'
import { logger } from './logger'
import { signatureStorage } from './storage'

interface VerifyRequest {
  x402Version: number
  paymentPayload: {
    x402Version: number
    scheme: string
    network: string
    payload: {
      signature: string
      authorization: {
        from: string
        to: string
        totalValue: string
      }
    }
  }
  paymentRequirements: {
    scheme: string
    network: string
    paymentContract: string
    payTo: string
    maxAmountRequired: string
  }
}

interface VerifyResponse {
  isValid: boolean
  invalidReason?: string
  payer?: string
}

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

const cumulativeAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'totalValue', type: 'uint256' }
  ]
}

let cachedClient: PublicClient | null = null

function getAmoyClient(): PublicClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology')
    })
  }
  return cachedClient
}

async function verifyEIP712Signature(
  signature: string,
  authorization: { from: string; to: string; totalValue: string },
  paymentContract: string
): Promise<{ valid: boolean; signer?: Address }> {
  try {
    const chainId = 80002 // Polygon Amoy

    const typedData = {
      types: cumulativeAuthorizationTypes as any,
      primaryType: 'TransferWithAuthorization' as const,
      domain: {
        name: 'X402Payment',
        version: '1',
        chainId,
        verifyingContract: getAddress(paymentContract)
      },
      message: {
        from: getAddress(authorization.from),
        to: getAddress(authorization.to),
        totalValue: BigInt(authorization.totalValue)
      }
    }

    const recovered = await verifyTypedData({
      address: getAddress(authorization.from),
      signature: signature as `0x${string}`,
      ...typedData
    })

    logger.debug('EIP-712 signature verified', {
      signer: recovered,
      expectedSigner: authorization.from,
      match: recovered.toLowerCase() === authorization.from.toLowerCase()
    })

    return {
      valid: recovered.toLowerCase() === authorization.from.toLowerCase(),
      signer: recovered
    }
  } catch (error) {
    logger.error('EIP-712 signature verification failed', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { valid: false }
  }
}

async function queryDepositFromAmoy(
  client: Address,
  server: Address,
  paymentContract: Address
): Promise<{ amount: bigint; expiresBy: bigint; amountUsed: bigint }> {
  try {
    const amoyClient = getAmoyClient()

    const result = await amoyClient.readContract({
      address: paymentContract,
      abi: PAYMENT_ABI,
      functionName: 'deposits',
      args: [client, server]
    })

    const [amount, expiresBy, amountUsed] = result as [bigint, bigint, bigint]

    logger.debug('Deposit queried from Amoy', {
      client,
      server,
      amount: amount.toString(),
      expiresBy: expiresBy.toString(),
      amountUsed: amountUsed.toString()
    })

    return { amount, expiresBy, amountUsed }
  } catch (error) {
    logger.error('Failed to query deposit from Amoy', {
      error: error instanceof Error ? error.message : String(error),
      client,
      server
    })
    throw error
  }
}

export async function handleVerify(
  req: Request,
  res: Response<VerifyResponse>
): Promise<void> {
  try {
    const body = req.body as VerifyRequest

    logger.info('Verify request received', {
      scheme: body.paymentRequirements.scheme,
      from: body.paymentPayload.payload.authorization.from,
      totalValue: body.paymentPayload.payload.authorization.totalValue
    })

    // 1. Validate request structure
    if (!body.paymentPayload || !body.paymentRequirements) {
      logger.warn('Invalid verify request structure')
      res.status(400).json({
        isValid: false,
        invalidReason: 'invalid_request_structure'
      })
      return
    }

    const { authorization } = body.paymentPayload.payload
    const { paymentContract, payTo } = body.paymentRequirements

    const clientAddr = getAddress(authorization.from) as Address
    const serverAddr = getAddress(payTo) as Address
    const contractAddr = getAddress(paymentContract) as Address

    // 2. Verify EIP-712 signature
    const sigResult = await verifyEIP712Signature(
      body.paymentPayload.payload.signature,
      authorization,
      paymentContract
    )

    if (!sigResult.valid) {
      logger.warn('Invalid signature', { from: authorization.from })
      res.status(200).json({
        isValid: false,
        invalidReason: 'invalid_signature',
        payer: authorization.from
      })
      return
    }

    // 3. Get stored last totalValue for replay prevention
    const lastTotalValue = signatureStorage.getLastTotalValue(clientAddr, serverAddr)
    const newTotalValue = BigInt(authorization.totalValue)

    logger.debug('Checking replay protection', {
      lastTotalValue: lastTotalValue.toString(),
      newTotalValue: newTotalValue.toString()
    })

    // 4. Check cumulative progression (replay prevention)
    if (newTotalValue <= lastTotalValue) {
      logger.warn('Replay attack detected or non-incremental totalValue', {
        from: authorization.from,
        lastTotalValue: lastTotalValue.toString(),
        newTotalValue: newTotalValue.toString()
      })
      res.status(200).json({
        isValid: false,
        invalidReason: 'totalValue_not_incremental',
        payer: authorization.from
      })
      return
    }

    // 5. Query Polygon Amoy for deposit status
    let deposit
    try {
      deposit = await queryDepositFromAmoy(clientAddr, serverAddr, contractAddr)
    } catch (error) {
      logger.error('Failed to query deposit', { error })
      res.status(200).json({
        isValid: false,
        invalidReason: 'deposit_query_failed',
        payer: authorization.from
      })
      return
    }

    // 6. Check if deposit exists
    if (deposit.amount === 0n) {
      logger.warn('No deposit found', { from: authorization.from, to: payTo })
      res.status(200).json({
        isValid: false,
        invalidReason: 'no_deposit',
        payer: authorization.from
      })
      return
    }

    // 7. Check deposit expiry
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (deposit.expiresBy < now) {
      logger.warn('Deposit expired', {
        from: authorization.from,
        expiresBy: deposit.expiresBy.toString(),
        now: now.toString()
      })
      res.status(200).json({
        isValid: false,
        invalidReason: 'deposit_expired',
        payer: authorization.from
      })
      return
    }

    // 8. Check deposit coverage
    const incrementalAmount = newTotalValue - deposit.amountUsed
    const availableBalance = deposit.amount - deposit.amountUsed

    logger.debug('Checking coverage', {
      incrementalAmount: incrementalAmount.toString(),
      availableBalance: availableBalance.toString()
    })

    if (incrementalAmount > availableBalance) {
      logger.warn('Insufficient deposit', {
        from: authorization.from,
        incrementalAmount: incrementalAmount.toString(),
        availableBalance: availableBalance.toString()
      })
      res.status(200).json({
        isValid: false,
        invalidReason: 'insufficient_deposit',
        payer: authorization.from
      })
      return
    }

    // 9. All checks passed - store signature for next request
    signatureStorage.storeSignature(clientAddr, serverAddr, authorization.totalValue, body.paymentPayload.payload.signature)

    logger.info('Payment verified successfully', {
      from: authorization.from,
      totalValue: authorization.totalValue
    })

    res.status(200).json({
      isValid: true,
      payer: authorization.from
    })
  } catch (error) {
    logger.error('Verify handler error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    res.status(500).json({
      isValid: false,
      invalidReason: 'verify_handler_error'
    })
  }
}
