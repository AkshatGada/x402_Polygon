#!/usr/bin/env node
/**
 * Migration script to convert existing JSON file storage to SQLite database
 * Usage: npx tsx scripts/migrate-to-sqlite.ts [path-to-old-data-dir]
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { homedir } from 'os';

const DEFAULT_OLD_DIR = join(homedir(), '.llm-wallet');
const NEW_DB_PATH = join(DEFAULT_OLD_DIR, 'llm-wallet.db');

interface OldWallet {
  address: string;
  encryptedPrivateKey: string;
  label: string;
  network: string;
  createdAt: number;
}

interface OldLimits {
  [address: string]: {
    maxTransactionAmount?: string;
    dailyLimit?: string;
    dailySpent: string;
    lastResetTimestamp: number;
    requireApproval: boolean;
    approvalThreshold: string;
  };
}

interface OldPayment {
  id: string;
  walletAddress?: string;
  timestamp: number;
  paymentHeader: string;
  verified: boolean;
  settled: boolean;
  transactionHash?: string;
  amount: string;
  network: string;
  resource?: string;
}

interface OldApiConfig {
  [name: string]: {
    name: string;
    endpoint: string;
    description?: string;
    method?: string;
    paymentConfig?: {
      maxAmount?: string;
      network?: string;
      payTo?: string;
    };
    headers?: Record<string, string>;
    inputSchema?: any;
  };
}

async function migrate() {
  const oldDir = process.argv[2] || DEFAULT_OLD_DIR;

  console.log(`\n🔄 Starting migration from ${oldDir} to SQLite database\n`);

  // Check if database already exists
  try {
    await fs.access(NEW_DB_PATH);
    console.log(`⚠️  Database already exists at ${NEW_DB_PATH}`);
    console.log('Please backup and remove it before running migration.');
    process.exit(1);
  } catch {
    // Database doesn't exist, continue
  }

  // Initialize database
  console.log('📦 Creating new SQLite database...');
  const db = new Database(NEW_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Load and execute schema
  const schemaPath = join(import.meta.dirname, '../src/db/schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('✅ Database schema created\n');

  let totalMigrated = 0;

  // Migrate wallets
  try {
    const walletsData = await fs.readFile(join(oldDir, 'wallets.json'), 'utf-8');
    const wallets: OldWallet[] = JSON.parse(walletsData);

    if (wallets.length > 0) {
      console.log(`📝 Migrating ${wallets.length} wallets...`);
      const stmt = db.prepare(`
        INSERT INTO wallets (address, encrypted_private_key, label, network, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const wallet of wallets) {
        stmt.run(
          wallet.address,
          wallet.encryptedPrivateKey,
          wallet.label,
          wallet.network,
          wallet.createdAt
        );
      }
      console.log(`✅ Migrated ${wallets.length} wallets`);
      totalMigrated += wallets.length;
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('❌ Error migrating wallets:', error.message);
    } else {
      console.log('ℹ️  No wallets found');
    }
  }

  // Migrate spending limits
  try {
    const limitsData = await fs.readFile(join(oldDir, 'limits.json'), 'utf-8');
    const limits: OldLimits = JSON.parse(limitsData);
    const limitsCount = Object.keys(limits).length;

    if (limitsCount > 0) {
      console.log(`\n📝 Migrating ${limitsCount} spending limits...`);
      const stmt = db.prepare(`
        INSERT INTO spending_limits (
          wallet_address, max_transaction_amount, daily_limit, daily_spent,
          last_reset_timestamp, require_approval, approval_threshold
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [address, limit] of Object.entries(limits)) {
        stmt.run(
          address.toLowerCase(),
          limit.maxTransactionAmount || null,
          limit.dailyLimit || null,
          limit.dailySpent,
          limit.lastResetTimestamp,
          limit.requireApproval ? 1 : 0,
          limit.approvalThreshold
        );
      }
      console.log(`✅ Migrated ${limitsCount} spending limits`);
      totalMigrated += limitsCount;
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('❌ Error migrating limits:', error.message);
    } else {
      console.log('ℹ️  No spending limits found');
    }
  }

  // Migrate payment history
  try {
    const historyData = await fs.readFile(join(oldDir, 'history.json'), 'utf-8');
    const history: OldPayment[] = JSON.parse(historyData);

    if (history.length > 0) {
      console.log(`\n📝 Migrating ${history.length} payment records...`);
      const stmt = db.prepare(`
        INSERT INTO payment_history (
          id, wallet_address, timestamp, payment_header, verified, settled,
          transaction_hash, amount, network, resource
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const payment of history) {
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
      console.log(`✅ Migrated ${history.length} payment records`);
      totalMigrated += history.length;
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('❌ Error migrating history:', error.message);
    } else {
      console.log('ℹ️  No payment history found');
    }
  }

  // Migrate API configs to registry
  try {
    const apiConfigsData = await fs.readFile(join(oldDir, 'api-configs.json'), 'utf-8');
    const apiConfigs: OldApiConfig = JSON.parse(apiConfigsData);
    const apiCount = Object.keys(apiConfigs).length;

    if (apiCount > 0) {
      console.log(`\n📝 Migrating ${apiCount} API configurations to registry...`);
      const stmt = db.prepare(`
        INSERT INTO api_registry (
          name, endpoint, description, method, price, network, scheme,
          pay_to, headers, input_schema, registered_at, call_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      for (const [name, config] of Object.entries(apiConfigs)) {
        stmt.run(
          name,
          config.endpoint,
          config.description || null,
          config.method || 'GET',
          config.paymentConfig?.maxAmount || '0.10',
          config.paymentConfig?.network || 'polygon-amoy',
          'exact',
          config.paymentConfig?.payTo || '',
          config.headers ? JSON.stringify(config.headers) : null,
          config.inputSchema ? JSON.stringify(config.inputSchema) : null,
          Date.now()
        );
      }
      console.log(`✅ Migrated ${apiCount} API configurations`);
      totalMigrated += apiCount;
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('❌ Error migrating API configs:', error.message);
    } else {
      console.log('ℹ️  No API configurations found');
    }
  }

  db.close();

  console.log(`\n✨ Migration complete!`);
  console.log(`📊 Total records migrated: ${totalMigrated}`);
  console.log(`📁 New database location: ${NEW_DB_PATH}`);
  console.log(`\n⚠️  Please backup your old JSON files before deleting them.`);
}

migrate().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});

