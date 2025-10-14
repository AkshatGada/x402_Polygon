import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import { StorageService } from './storage.service.js';
import { config } from '../config/index.js';
import type { StoredWallet, EncryptedData } from '../types/index.js';

export class WalletService {
  private encryptionKey: Buffer;

  constructor() {
    // Derive 256-bit key from user-provided passphrase
    this.encryptionKey = createHash('sha256')
      .update(config.WALLET_ENCRYPTION_KEY)
      .digest();
  }

  /**
   * Create new HD wallet
   */
  async createWallet(label: string): Promise<{ address: string; mnemonic: string }> {
    const mnemonic = generateMnemonic(english);
    const account = mnemonicToAccount(mnemonic);

    // Get private key from account
    const privateKey = account.getHdKey().privateKey;
    if (!privateKey) {
      throw new Error('Failed to derive private key from mnemonic');
    }

    const privateKeyHex = `0x${Buffer.from(privateKey).toString('hex')}`;
    const encryptedKey = await this.encryptPrivateKey(privateKeyHex);

    await StorageService.saveWallet({
      address: account.address,
      encryptedPrivateKey: encryptedKey,
      label,
      createdAt: Date.now(),
      network: config.NETWORK,
    });

    return {
      address: account.address,
      mnemonic,
    };
  }

  /**
   * Import wallet from private key
   */
  async importWallet(privateKey: string, label: string): Promise<string> {
    // Ensure private key has 0x prefix
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const encryptedKey = await this.encryptPrivateKey(formattedKey);

    await StorageService.saveWallet({
      address: account.address,
      encryptedPrivateKey: encryptedKey,
      label,
      createdAt: Date.now(),
      network: config.NETWORK,
    });

    return account.address;
  }

  /**
   * Get decrypted wallet for signing
   */
  async getWallet(address?: string): Promise<{ privateKey: string; address: string }> {
    const stored = address
      ? await StorageService.getWallet(address)
      : await StorageService.getActiveWallet();

    const privateKey = await this.decryptPrivateKey(stored.encryptedPrivateKey);

    return {
      privateKey,
      address: stored.address,
    };
  }

  /**
   * Encrypt private key with AES-256-GCM
   */
  private async encryptPrivateKey(privateKey: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const encryptedData: EncryptedData = {
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    };

    return JSON.stringify(encryptedData);
  }

  /**
   * Decrypt private key
   */
  private async decryptPrivateKey(encryptedDataStr: string): Promise<string> {
    const { iv, encrypted, authTag } = JSON.parse(encryptedDataStr) as EncryptedData;

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

