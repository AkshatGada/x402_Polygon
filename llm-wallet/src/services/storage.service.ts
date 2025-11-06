import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '../config/index.js';
import { EnvironmentService } from './environment.service.js';
import type { StoredWallet, SpendingLimits, StoredSpendingLimits, PaymentHistory } from '../types/index.js';

export class StorageService {
  private static STORAGE_DIR = config.STORAGE_DIR;
  private static WALLETS_FILE = join(StorageService.STORAGE_DIR, 'wallets.json');
  private static LIMITS_FILE = join(StorageService.STORAGE_DIR, 'limits.json');
  private static HISTORY_FILE = join(StorageService.STORAGE_DIR, 'history.json');
  private static API_CONFIGS_FILE = join(StorageService.STORAGE_DIR, 'api-configs.json');

  static async init(): Promise<void> {
    await fs.mkdir(StorageService.STORAGE_DIR, { recursive: true });

    // Initialize files if they don't exist
    const arrayFiles = [
      StorageService.WALLETS_FILE,
      StorageService.HISTORY_FILE,
    ];

    const objectFiles = [
      StorageService.LIMITS_FILE,
      StorageService.API_CONFIGS_FILE,
    ];

    for (const file of arrayFiles) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify([]));
      }
    }

    for (const file of objectFiles) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify({}));
      }
    }

    // Initialize environment tracking
    await EnvironmentService.initEnvironmentStorage();
  }

  // Wallet operations
  static async saveWallet(wallet: StoredWallet): Promise<void> {
    const wallets = await this.getWallets();
    wallets.push(wallet);
    await fs.writeFile(StorageService.WALLETS_FILE, JSON.stringify(wallets, null, 2));
  }

  static async getWallets(): Promise<StoredWallet[]> {
    const data = await fs.readFile(StorageService.WALLETS_FILE, 'utf-8');
    return JSON.parse(data);
  }

  static async getWallet(address: string): Promise<StoredWallet> {
    const wallets = await this.getWallets();
    const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (!wallet) {
      throw new Error(`Wallet not found: ${address}`);
    }
    return wallet;
  }

  static async deleteWallet(address: string): Promise<void> {
    const wallets = await this.getWallets();
    const initialLength = wallets.length;
    const filteredWallets = wallets.filter(w => w.address.toLowerCase() !== address.toLowerCase());
    
    if (filteredWallets.length === initialLength) {
      throw new Error(`Wallet not found: ${address}`);
    }

    // Delete wallet limits if they exist
    const allLimits = await this.getAllLimits();
    delete allLimits[address.toLowerCase()];
    
    // Update wallets and limits files
    await fs.writeFile(StorageService.WALLETS_FILE, JSON.stringify(filteredWallets, null, 2));
    await fs.writeFile(StorageService.LIMITS_FILE, JSON.stringify(allLimits, null, 2));
  }

  static async getActiveWallet(): Promise<StoredWallet> {
    const wallets = await this.getWallets();
    if (wallets.length === 0) {
      throw new Error('No wallets found. Please create a wallet first.');
    }

    // Get environment ID and its active wallet preference
    const envId = await EnvironmentService.getEnvironmentId();
    const allAddresses = wallets.map(w => w.address);
    const activeAddress = await EnvironmentService.getActiveWalletAddressForEnvironment(envId, allAddresses);

    if (activeAddress) {
      const wallet = wallets.find(w => w.address.toLowerCase() === activeAddress.toLowerCase());
      if (wallet) {
        return wallet;
      }
    }

    // Fallback to first wallet
    return wallets[0];
  }

  // Spending limits operations
  static async saveWalletLimits(address: string, limits: SpendingLimits): Promise<void> {
    const allLimits = await this.getAllLimits();
    const stored: StoredSpendingLimits = {
      dailySpent: limits.dailySpent.toString(),
      lastResetTimestamp: limits.lastResetTimestamp,
      requireApproval: limits.requireApproval,
      approvalThreshold: limits.approvalThreshold.toString(),
    };

    // Only include optional fields if they're defined
    if (limits.maxTransactionAmount !== undefined) {
      stored.maxTransactionAmount = limits.maxTransactionAmount.toString();
    }
    if (limits.dailyLimit !== undefined) {
      stored.dailyLimit = limits.dailyLimit.toString();
    }

    allLimits[address.toLowerCase()] = stored;
    await fs.writeFile(StorageService.LIMITS_FILE, JSON.stringify(allLimits, null, 2));
  }

  static async getWalletLimits(address: string): Promise<SpendingLimits> {
    const allLimits = await this.getAllLimits();
    const stored = allLimits[address.toLowerCase()];

    if (!stored) {
      // Return default limits (no restrictions)
      return {
        dailySpent: BigInt(0),
        lastResetTimestamp: Date.now(),
        requireApproval: false,
        approvalThreshold: BigInt(0),
      };
    }

    // Convert string back to BigInt
    return {
      maxTransactionAmount: stored.maxTransactionAmount ? BigInt(stored.maxTransactionAmount) : undefined,
      dailyLimit: stored.dailyLimit ? BigInt(stored.dailyLimit) : undefined,
      dailySpent: BigInt(stored.dailySpent),
      lastResetTimestamp: stored.lastResetTimestamp,
      requireApproval: stored.requireApproval,
      approvalThreshold: BigInt(stored.approvalThreshold),
    };
  }

  private static async getAllLimits(): Promise<Record<string, StoredSpendingLimits>> {
    try {
      const data = await fs.readFile(StorageService.LIMITS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  // Payment history operations
  static async savePayment(payment: PaymentHistory): Promise<void> {
    const history = await this.getHistory();
    history.push(payment);
    await fs.writeFile(StorageService.HISTORY_FILE, JSON.stringify(history, null, 2));
  }

  static async getHistory(limit = 10, offset = 0): Promise<PaymentHistory[]> {
    const data = await fs.readFile(StorageService.HISTORY_FILE, 'utf-8');
    const history = JSON.parse(data);
    return history.slice(offset, offset + limit);
  }

  // API Configuration operations
  static async saveApiConfig(name: string, config: any): Promise<void> {
    const allConfigs = await this.getAllApiConfigs();
    allConfigs[name] = config;
    await fs.writeFile(StorageService.API_CONFIGS_FILE, JSON.stringify(allConfigs, null, 2));
  }

  static async getApiConfig(name: string): Promise<any | null> {
    const allConfigs = await this.getAllApiConfigs();
    return allConfigs[name] || null;
  }

  static async getAllApiConfigs(): Promise<Record<string, any>> {
    try {
      const data = await fs.readFile(StorageService.API_CONFIGS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  static async deleteApiConfig(name: string): Promise<void> {
    const allConfigs = await this.getAllApiConfigs();
    delete allConfigs[name];
    await fs.writeFile(StorageService.API_CONFIGS_FILE, JSON.stringify(allConfigs, null, 2));
  }

  // Environment-aware wallet operations
  static async setActiveWalletForEnvironment(walletAddress: string): Promise<void> {
    const envId = await EnvironmentService.getEnvironmentId();
    await EnvironmentService.setActiveWalletForEnvironment(envId, walletAddress);
  }

  static async shareWalletWithEnvironment(walletAddress: string, environmentId: string): Promise<void> {
    const wallets = await this.getWallets();
    const wallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());

    if (!wallet) {
      throw new Error(`Wallet not found: ${walletAddress}`);
    }

    // Add environment to accessibleBy list
    if (!wallet.accessibleBy) {
      wallet.accessibleBy = [];
    }
    if (!wallet.accessibleBy.includes(environmentId)) {
      wallet.accessibleBy.push(environmentId);
    }

    // Update wallet
    const index = wallets.findIndex(w => w.address.toLowerCase() === walletAddress.toLowerCase());
    wallets[index] = wallet;
    await fs.writeFile(StorageService.WALLETS_FILE, JSON.stringify(wallets, null, 2));
  }

  static async getWalletsForEnvironment(): Promise<StoredWallet[]> {
    const wallets = await this.getWallets();
    const envId = await EnvironmentService.getEnvironmentId();

    // Filter wallets accessible to this environment
    return wallets.filter(wallet => {
      if (!wallet.accessibleBy || wallet.accessibleBy.length === 0) {
        // Wallets with no access list are accessible to everyone
        return true;
      }
      return wallet.accessibleBy.includes(envId);
    });
  }

  static async getEnvironmentInfo(): Promise<{
    environmentId: string;
    activeWallet: StoredWallet | null;
    accessibleWallets: StoredWallet[];
  }> {
    const envId = await EnvironmentService.getEnvironmentId();
    const profile = await EnvironmentService.getEnvironmentProfile(envId);
    const accessibleWallets = await this.getWalletsForEnvironment();

    let activeWallet: StoredWallet | null = null;
    if (profile?.activeWalletAddress) {
      activeWallet =
        accessibleWallets.find(w => w.address.toLowerCase() === profile.activeWalletAddress.toLowerCase()) || null;
    }

    return {
      environmentId: envId,
      activeWallet,
      accessibleWallets,
    };
  }
}

