/**
 * SQLite database wrapper for facilitator health persistence
 */

import Database from 'better-sqlite3';
import { HealthStatus } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Manages persistent storage of facilitator health data using SQLite
 */
export class HealthDatabase {
  private db: Database.Database;
  private dbPath: string;

  /**
   * Initialize the health database
   * @param dbPath - Path to SQLite database file (default: ~/.x402-router/health.db)
   */
  constructor(dbPath?: string) {
    // Default path: ~/.x402-router/health.db
    this.dbPath = dbPath || path.join(os.homedir(), '.x402-router', 'health.db');

    // Create directory if it doesn't exist
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database connection
    this.db = new Database(this.dbPath);

    // Create schema if not exists
    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS facilitators_health (
        url TEXT PRIMARY KEY,
        is_healthy INTEGER DEFAULT 1,
        last_latency_ms INTEGER DEFAULT 0,
        last_check_time INTEGER DEFAULT 0,
        consecutive_failures INTEGER DEFAULT 0,
        total_requests INTEGER DEFAULT 0,
        successful_requests INTEGER DEFAULT 0
      )
    `;

    this.db.exec(createTableSQL);
  }

  /**
   * Insert or update health status for a facilitator
   * @param status - Health status to store
   */
  upsertHealth(status: HealthStatus): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO facilitators_health (
        url,
        is_healthy,
        last_latency_ms,
        last_check_time,
        consecutive_failures,
        total_requests,
        successful_requests
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      status.url,
      status.isHealthy ? 1 : 0,  // Convert boolean to integer
      status.lastLatencyMs,
      status.lastCheckTime,
      status.consecutiveFailures,
      status.totalRequests,
      status.successfulRequests
    );
  }

  /**
   * Get health status for a specific facilitator
   * @param url - Facilitator URL
   * @returns Health status or null if not found
   */
  getHealth(url: string): HealthStatus | null {
    const stmt = this.db.prepare(`
      SELECT * FROM facilitators_health WHERE url = ?
    `);

    const row = stmt.get(url) as any;

    if (!row) {
      return null;
    }

    return {
      url: row.url,
      isHealthy: row.is_healthy === 1,  // Convert integer to boolean
      lastLatencyMs: row.last_latency_ms,
      lastCheckTime: row.last_check_time,
      consecutiveFailures: row.consecutive_failures,
      totalRequests: row.total_requests,
      successfulRequests: row.successful_requests
    };
  }

  /**
   * Get health status for all facilitators
   * @returns Array of health statuses
   */
  getAllHealth(): HealthStatus[] {
    const stmt = this.db.prepare(`
      SELECT * FROM facilitators_health
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      url: row.url,
      isHealthy: row.is_healthy === 1,
      lastLatencyMs: row.last_latency_ms,
      lastCheckTime: row.last_check_time,
      consecutiveFailures: row.consecutive_failures,
      totalRequests: row.total_requests,
      successfulRequests: row.successful_requests
    }));
  }

  /**
   * Increment request counters for a facilitator
   * @param url - Facilitator URL
   * @param success - Whether the request was successful
   */
  incrementRequests(url: string, success: boolean): void {
    // First ensure the record exists
    const existing = this.getHealth(url);
    if (!existing) {
      // Initialize with default values
      this.upsertHealth({
        url,
        isHealthy: true,
        lastLatencyMs: 0,
        lastCheckTime: Date.now(),
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0
      });
    }

    // Increment counters
    if (success) {
      const stmt = this.db.prepare(`
        UPDATE facilitators_health 
        SET total_requests = total_requests + 1,
            successful_requests = successful_requests + 1
        WHERE url = ?
      `);
      stmt.run(url);
    } else {
      const stmt = this.db.prepare(`
        UPDATE facilitators_health 
        SET total_requests = total_requests + 1
        WHERE url = ?
      `);
      stmt.run(url);
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the database file path
   */
  getPath(): string {
    return this.dbPath;
  }
}

