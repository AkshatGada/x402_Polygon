import { Address } from 'viem'
import { logger } from './logger'

interface SignatureState {
  client: Address
  server: Address
  lastTotalValue: bigint
  lastSignature: string
  lastVerifiedAt: number
  requestCount: number
}

export class SignatureStorage {
  private storage: Map<string, SignatureState> = new Map()

  private getKey(client: Address, server: Address): string {
    return `${client.toLowerCase()}:${server.toLowerCase()}`
  }

  getLastTotalValue(client: Address, server: Address): bigint {
    const key = this.getKey(client, server)
    const state = this.storage.get(key)
    const value = state ? state.lastTotalValue : 0n

    logger.debug('Retrieved last total value', {
      key,
      lastTotalValue: value.toString(),
      hasState: !!state
    })

    return value
  }

  storeSignature(
    client: Address,
    server: Address,
    totalValue: string,
    signature: string
  ): void {
    const key = this.getKey(client, server)
    const existing = this.storage.get(key)
    const newCount = existing ? existing.requestCount + 1 : 1

    this.storage.set(key, {
      client,
      server,
      lastTotalValue: BigInt(totalValue),
      lastSignature: signature,
      lastVerifiedAt: Date.now(),
      requestCount: newCount
    })

    logger.info('Signature stored', {
      client: key,
      totalValue,
      requestCount: newCount
    })
  }

  getState(client: Address, server: Address): SignatureState | undefined {
    const key = this.getKey(client, server)
    return this.storage.get(key)
  }

  clear(): void {
    logger.info('Clearing all stored signatures', {
      beforeCount: this.storage.size
    })
    this.storage.clear()
  }

  getStats(): { totalPairs: number; totalRequests: number } {
    let totalRequests = 0
    this.storage.forEach(state => {
      totalRequests += state.requestCount
    })
    return {
      totalPairs: this.storage.size,
      totalRequests
    }
  }

  getAllStates(): Record<string, SignatureState> {
    const result: Record<string, SignatureState> = {}
    this.storage.forEach((state, key) => {
      result[key] = state
    })
    return result
  }
}

export const signatureStorage = new SignatureStorage()
