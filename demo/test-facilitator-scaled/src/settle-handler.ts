import { Request, Response } from 'express'
import {
  createWalletClient,
  http,
  getAddress,
  Address,
  Hex,
  Chain
} from 'viem'
import { polygonAmoy } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { logger } from './logger'
import { handleVerify } from './verify-handler'

interface SettleRequest {
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

interface SettleResponse {
  success: boolean
  transaction?: string
  errorReason?: string
  network?: string
  payer?: string
}

const PAYMENT_ABI = [
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'totalValue', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' }
    ],
    name: 'transferWithAuthorization',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

let walletClient: ReturnType<typeof createWalletClient> | null = null

function getWalletClient(): ReturnType<typeof createWalletClient> {
  if (!walletClient) {
    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set')
    }

    const account = privateKeyToAccount(privateKey as Hex)

    walletClient = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http(process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology')
    })
  }
  return walletClient
}

function parseSignature(signature: string): { v: number; r: Hex; s: Hex } {
  // Remove 0x prefix and parse
  const sig = signature.startsWith('0x') ? signature.slice(2) : signature

  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 chars, got ${sig.length}`)
  }

  const r = ('0x' + sig.slice(0, 64)) as Hex
  const s = ('0x' + sig.slice(64, 128)) as Hex
  const vByte = sig.slice(128, 130)

  let v = parseInt(vByte, 16)
  // Normalize v to 27 or 28
  if (v === 0 || v === 1) {
    v = v + 27
  }

  logger.debug('Signature parsed', {
    r: r.slice(0, 10) + '...',
    s: s.slice(0, 10) + '...',
    v
  })

  return { v, r, s }
}

export async function handleSettle(
  req: Request,
  res: Response<SettleResponse>
): Promise<void> {
  try {
    const body = req.body as SettleRequest

    logger.info('Settle request received', {
      from: body.paymentPayload.payload.authorization.from,
      totalValue: body.paymentPayload.payload.authorization.totalValue
    })

    // 1. Validate request structure
    if (!body.paymentPayload || !body.paymentRequirements) {
      logger.warn('Invalid settle request structure')
      res.status(400).json({
        success: false,
        errorReason: 'invalid_request_structure'
      })
      return
    }

    // 2. First verify the payment (same checks as /verify)
    const verifyReq = {
      json: async () => body
    } as any

    const verifyRes: any = {
      status: (code: number) => ({
        json: (data: any) => {
          verifyRes.statusCode = code
          verifyRes.body = data
          return verifyRes
        }
      }),
      json: (data: any) => {
        verifyRes.body = data
        return verifyRes
      }
    }

    await handleVerify(verifyReq, verifyRes)

    if (!verifyRes.body?.isValid) {
      logger.warn('Settlement rejected - verification failed', {
        invalidReason: verifyRes.body?.invalidReason
      })
      res.status(200).json({
        success: false,
        errorReason: verifyRes.body?.invalidReason || 'verification_failed',
        network: body.paymentRequirements.network,
        payer: body.paymentPayload.payload.authorization.from
      })
      return
    }

    // 3. Parse signature
    let vrs
    try {
      vrs = parseSignature(body.paymentPayload.payload.signature)
    } catch (error) {
      logger.error('Signature parsing failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      res.status(200).json({
        success: false,
        errorReason: 'invalid_signature_format',
        network: body.paymentRequirements.network,
        payer: body.paymentPayload.payload.authorization.from
      })
      return
    }

    // 4. Get wallet client
    let walletCli
    try {
      walletCli = getWalletClient()
    } catch (error) {
      logger.error('Failed to get wallet client', {
        error: error instanceof Error ? error.message : String(error)
      })
      res.status(500).json({
        success: false,
        errorReason: 'wallet_configuration_error',
        network: body.paymentRequirements.network,
        payer: body.paymentPayload.payload.authorization.from
      })
      return
    }

    // 5. Call Payment.transferWithAuthorization
    const { authorization } = body.paymentPayload.payload
    const { paymentContract, payTo } = body.paymentRequirements

    logger.info('Submitting settlement transaction', {
      from: authorization.from,
      to: payTo,
      totalValue: authorization.totalValue,
      contract: paymentContract
    })

    let txHash: Hex
    try {
      txHash = await walletCli.writeContract({
        address: getAddress(paymentContract) as Address,
        abi: PAYMENT_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          getAddress(authorization.from) as Address,
          getAddress(payTo) as Address,
          BigInt(authorization.totalValue),
          vrs.v as 0 | 1 | 27 | 28,
          vrs.r,
          vrs.s
        ],
        chain: polygonAmoy as Chain,
        account: walletCli.account
      }) as Hex
    } catch (error) {
      logger.error('Settlement transaction submission failed', {
        error: error instanceof Error ? error.message : String(error),
        from: authorization.from,
        to: payTo
      })
      res.status(200).json({
        success: false,
        errorReason: 'settlement_submission_failed',
        network: body.paymentRequirements.network,
        payer: authorization.from
      })
      return
    }

    logger.info('Settlement transaction submitted', {
      txHash,
      from: authorization.from,
      to: payTo,
      totalValue: authorization.totalValue
    })

    // 6. Wait for confirmation (optional, could be done async)
    // For now, just return the tx hash immediately
    res.status(200).json({
      success: true,
      transaction: txHash,
      network: body.paymentRequirements.network,
      payer: authorization.from
    })

    // 7. Log settlement completion
    logger.info('Settlement completed', {
      txHash,
      from: authorization.from,
      totalValue: authorization.totalValue
    })
  } catch (error) {
    logger.error('Settle handler error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    res.status(500).json({
      success: false,
      errorReason: 'settle_handler_error'
    })
  }
}
