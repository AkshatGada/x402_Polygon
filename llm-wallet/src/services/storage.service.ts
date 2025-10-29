import Database from 'better-sqlite3';
import { join } from 'path';
import { readFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { config } from '../config/index.js';
import type { StoredWallet, SpendingLimits, StoredSpendingLimits, PaymentHistory } from '../types/index.js';

export class StorageService {
  private static db: Database.Database;
  private static DB_FILE = join(config.STORAGE_DIR, 'llm-wallet.db');

  static async init(): Promise<void> {
    // Ensure storage directory exists
    await mkdir(config.STORAGE_DIR, { recursive: true });

    // Initialize database
    this.db = new Database(this.DB_FILE);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.db.pragma('foreign_keys = ON'); // Enable foreign key constraints

    // Load and execute schema
    const schemaPath = new URL('../db/schema.sql', import.meta.url).pathname;
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  // Wallet operations
  static async saveWallet(wallet: StoredWallet): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO wallets (address, encrypted_private_key, label, network, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      wallet.address,
      wallet.encryptedPrivateKey,
      wallet.label,
      wallet.network,
      wallet.createdAt
    );
  }

  static async getWallets(): Promise<StoredWallet[]> {
    const stmt = this.db.prepare('SELECT * FROM wallets ORDER BY created_at ASC');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      address: row.address,
      encryptedPrivateKey: row.encrypted_private_key,
      label: row.label,
      network: row.network,
      createdAt: row.created_at,
    }));
  }

  static async getWallet(address: string): Promise<StoredWallet> {
    const stmt = this.db.prepare('SELECT * FROM wallets WHERE address = ? COLLATE NOCASE');
    const row = stmt.get(address) as any;
    if (!row) {
      throw new Error(`Wallet not found: ${address}`);
    }
    return {
      address: row.address,
      encryptedPrivateKey: row.encrypted_private_key,
      label: row.label,
      network: row.network,
      createdAt: row.created_at,
    };
  }

  static async getActiveWallet(): Promise<StoredWallet> {
    const wallets = await this.getWallets();
    if (wallets.length === 0) {
      throw new Error('No wallets found. Please create a wallet first.');
    }
    // Return the most recently created wallet
    return wallets[wallets.length - 1];
  }

  // Spending limits operations
  static async saveWalletLimits(address: string, limits: SpendingLimits): Promise<void> {
    const stored: any = {
      wallet_address: address.toLowerCase(),
      daily_spent: limits.dailySpent.toString(),
      last_reset_timestamp: limits.lastResetTimestamp,
      require_approval: limits.requireApproval ? 1 : 0,
      approval_threshold: limits.approvalThreshold.toString(),
    };

    // Only include optional fields if they're defined
    if (limits.maxTransactionAmount !== undefined) {
      stored.max_transaction_amount = limits.maxTransactionAmount.toString();
    }
    if (limits.dailyLimit !== undefined) {
      stored.daily_limit = limits.dailyLimit.toString();
    }

    const stmt = this.db.prepare(`
      INSERT INTO spending_limits (
        wallet_address, max_transaction_amount, daily_limit, daily_spent,
        last_reset_timestamp, require_approval, approval_threshold
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        max_transaction_amount = excluded.max_transaction_amount,
        daily_limit = excluded.daily_limit,
        daily_spent = excluded.daily_spent,
        last_reset_timestamp = excluded.last_reset_timestamp,
        require_approval = excluded.require_approval,
        approval_threshold = excluded.approval_threshold
    `);

    stmt.run(
      stored.wallet_address,
      stored.max_transaction_amount || null,
      stored.daily_limit || null,
      stored.daily_spent,
      stored.last_reset_timestamp,
      stored.require_approval,
      stored.approval_threshold
    );
  }

  static async getWalletLimits(address: string): Promise<SpendingLimits> {
    const stmt = this.db.prepare('SELECT * FROM spending_limits WHERE wallet_address = ? COLLATE NOCASE');
    const row = stmt.get(address.toLowerCase()) as any;

    if (!row) {
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
      maxTransactionAmount: row.max_transaction_amount ? BigInt(row.max_transaction_amount) : undefined,
      dailyLimit: row.daily_limit ? BigInt(row.daily_limit) : undefined,
      dailySpent: BigInt(row.daily_spent),
      lastResetTimestamp: row.last_reset_timestamp,
      requireApproval: row.require_approval === 1,
      approvalThreshold: BigInt(row.approval_threshold),
    };
  }

  // Payment history operations
  static async savePayment(payment: PaymentHistory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO payment_history (
        id, wallet_address, timestamp, payment_header, verified, settled,
        transaction_hash, amount, network, resource
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      payment.id,
      payment.walletAddress || '',
      payment.timestamp,
      payment.paymentHeader,
      payment.verified ? 1 : 0,
      payment.settled ? 1 : 0,
      payment.transactionHash || null,
      payment.amount,
      payment.network,
      payment.resource || null
    );
  }

  static async getHistory(limit = 10, offset = 0): Promise<PaymentHistory[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_history
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(row => ({
      id: row.id,
      walletAddress: row.wallet_address,
      timestamp: row.timestamp,
      paymentHeader: row.payment_header,
      verified: row.verified === 1,
      settled: row.settled === 1,
      transactionHash: row.transaction_hash || undefined,
      amount: row.amount,
      network: row.network,
      resource: row.resource || undefined,
    }));
  }

  // API Configuration operations (legacy support)
  static async saveApiConfig(name: string, apiConfig: any): Promise<void> {
    // For backward compatibility, we store API configs in the registry
    await this.addToPublicRegistry({
      name,
      endpoint: apiConfig.endpoint,
      description: apiConfig.description || '',
      method: apiConfig.method || 'GET',
      price: apiConfig.paymentConfig?.maxAmount || '0.10',
      network: apiConfig.paymentConfig?.network || 'polygon-amoy',
      scheme: 'exact',
      pay_to: apiConfig.paymentConfig?.payTo || '',
      headers: apiConfig.headers ? JSON.stringify(apiConfig.headers) : null,
      input_schema: apiConfig.inputSchema ? JSON.stringify(apiConfig.inputSchema) : null,
      registered_at: Date.now(),
    });
  }

  static async getApiConfig(name: string): Promise<any | null> {
    const api = await this.getPublicApi(name);
    if (!api) return null;

    // Convert back to old format for compatibility
    return {
      name: api.name,
      endpoint: api.endpoint,
      description: api.description,
      method: api.method,
      paymentConfig: {
        maxAmount: api.price,
        network: api.network,
        payTo: api.pay_to,
      },
      headers: api.headers ? JSON.parse(api.headers) : undefined,
      inputSchema: api.input_schema ? JSON.parse(api.input_schema) : undefined,
      requiresPayment: true,
    };
  }

  static async getAllApiConfigs(): Promise<Record<string, any>> {
    const apis = await this.listPublicApis();
    const configs: Record<string, any> = {};

    for (const api of apis) {
      configs[api.name] = {
        name: api.name,
        endpoint: api.endpoint,
        description: api.description,
        method: api.method,
        paymentConfig: {
          maxAmount: api.price,
          network: api.network,
          payTo: api.pay_to,
        },
        headers: api.headers ? JSON.parse(api.headers) : undefined,
        inputSchema: api.input_schema ? JSON.parse(api.input_schema) : undefined,
        requiresPayment: true,
      };
    }

    return configs;
  }

  static async deleteApiConfig(name: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM api_registry WHERE name = ?');
    stmt.run(name);
  }

  // Public API Registry operations
  static async addToPublicRegistry(registry: {
    name: string;
    endpoint: string;
    description?: string;
    method?: string;
    price: string;
    network?: string;
    scheme?: string;
    pay_to: string;
    headers?: string | null;
    input_schema?: string | null;
    registered_at: number;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO api_registry (
        name, endpoint, description, method, price, network, scheme,
        pay_to, headers, input_schema, registered_at, call_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(name) DO UPDATE SET
        endpoint = excluded.endpoint,
        description = excluded.description,
        method = excluded.method,
        price = excluded.price,
        network = excluded.network,
        scheme = excluded.scheme,
        pay_to = excluded.pay_to,
        headers = excluded.headers,
        input_schema = excluded.input_schema
    `);

    stmt.run(
      registry.name,
      registry.endpoint,
      registry.description || null,
      registry.method || 'GET',
      registry.price,
      registry.network || 'polygon-amoy',
      registry.scheme || 'exact',
      registry.pay_to,
      registry.headers || null,
      registry.input_schema || null,
      registry.registered_at
    );
  }

  static async listPublicApis(network?: string, limit = 50): Promise<any[]> {
    let query = 'SELECT * FROM api_registry';
    const params: any[] = [];

    if (network) {
      query += ' WHERE network = ?';
      params.push(network);
    }

    query += ' ORDER BY registered_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      name: row.name,
      endpoint: row.endpoint,
      description: row.description,
      method: row.method,
      price: row.price,
      network: row.network,
      scheme: row.scheme,
      pay_to: row.pay_to,
      headers: row.headers,
      input_schema: row.input_schema,
      registered_at: row.registered_at,
      last_called_at: row.last_called_at,
      call_count: row.call_count,
    }));
  }

  static async searchPublicApis(query: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM api_registry
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY call_count DESC, registered_at DESC
      LIMIT 50
    `);

    const searchPattern = `%${query}%`;
    const rows = stmt.all(searchPattern, searchPattern) as any[];

    return rows.map(row => ({
      name: row.name,
      endpoint: row.endpoint,
      description: row.description,
      method: row.method,
      price: row.price,
      network: row.network,
      scheme: row.scheme,
      pay_to: row.pay_to,
      headers: row.headers,
      input_schema: row.input_schema,
      registered_at: row.registered_at,
      last_called_at: row.last_called_at,
      call_count: row.call_count,
    }));
  }

  static async getPublicApi(name: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM api_registry WHERE name = ?');
    const row = stmt.get(name) as any;

    if (!row) return null;

    return {
      name: row.name,
      endpoint: row.endpoint,
      description: row.description,
      method: row.method,
      price: row.price,
      network: row.network,
      scheme: row.scheme,
      pay_to: row.pay_to,
      headers: row.headers,
      input_schema: row.input_schema,
      registered_at: row.registered_at,
      last_called_at: row.last_called_at,
      call_count: row.call_count,
    };
  }

  static async incrementApiCallCount(name: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE api_registry
      SET call_count = call_count + 1, last_called_at = ?
      WHERE name = ?
    `);
    stmt.run(Date.now(), name);
  }
}
