import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { config } from '../config/index.js';
import type { EnvironmentProfile } from '../types/index.js';

export class EnvironmentService {
  private static ENV_ID_FILE = join(config.STORAGE_DIR, '.environment-id');
  private static ENV_PROFILES_FILE = join(config.STORAGE_DIR, 'environment-profiles.json');

  /**
   * Detect or generate environment ID
   */
  static async getEnvironmentId(): Promise<string> {
    // Check for explicit environment variable
    if (process.env.MCP_ENVIRONMENT) {
      return process.env.MCP_ENVIRONMENT;
    }

    // Check for Claude
    if (process.env.CLAUDE_USER || process.env.ANTHROPIC_HOME) {
      return 'claude';
    }

    // Check for Cursor
    if (process.env.CURSOR_ENV || process.env.CURSOR_WORKSPACE_ROOT) {
      return 'cursor';
    }

    // Check for ChatGPT
    if (process.env.CHATGPT_MODE) {
      return 'chatgpt';
    }

    // Check for VSCode
    if (process.env.TERM_PROGRAM === 'vscode') {
      return 'vscode';
    }

    // Read or generate persistent ID
    return this.getPersistentEnvironmentId();
  }

  /**
   * Get persistent environment ID (stored locally)
   */
  private static async getPersistentEnvironmentId(): Promise<string> {
    try {
      const id = await fs.readFile(EnvironmentService.ENV_ID_FILE, 'utf-8');
      return id.trim();
    } catch {
      // Generate new ID if file doesn't exist
      const newId = `env-${randomBytes(8).toString('hex')}`;
      await this.initEnvironmentStorage();
      await fs.writeFile(EnvironmentService.ENV_ID_FILE, newId);
      return newId;
    }
  }

  /**
   * Initialize environment storage
   */
  static async initEnvironmentStorage(): Promise<void> {
    try {
      await fs.access(EnvironmentService.ENV_PROFILES_FILE);
    } catch {
      await fs.writeFile(EnvironmentService.ENV_PROFILES_FILE, JSON.stringify({}));
    }
  }

  /**
   * Get environment profile
   */
  static async getEnvironmentProfile(envId: string): Promise<EnvironmentProfile | null> {
    try {
      const data = await fs.readFile(EnvironmentService.ENV_PROFILES_FILE, 'utf-8');
      const profiles: Record<string, EnvironmentProfile> = JSON.parse(data);
      return profiles[envId] || null;
    } catch {
      return null;
    }
  }

  /**
   * Set active wallet for environment
   */
  static async setActiveWalletForEnvironment(envId: string, walletAddress: string): Promise<void> {
    await this.initEnvironmentStorage();
    const data = await fs.readFile(EnvironmentService.ENV_PROFILES_FILE, 'utf-8');
    const profiles: Record<string, EnvironmentProfile> = JSON.parse(data);

    profiles[envId] = {
      activeWalletAddress: walletAddress.toLowerCase(),
      environmentId: envId,
      lastAccess: Date.now(),
    };

    await fs.writeFile(EnvironmentService.ENV_PROFILES_FILE, JSON.stringify(profiles, null, 2));
  }

  /**
   * List all environment profiles
   */
  static async listEnvironmentProfiles(): Promise<Record<string, EnvironmentProfile>> {
    try {
      const data = await fs.readFile(EnvironmentService.ENV_PROFILES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * Get active wallet address for environment (falls back to first wallet if not set)
   */
  static async getActiveWalletAddressForEnvironment(envId: string, allWallets: string[]): Promise<string | null> {
    const profile = await this.getEnvironmentProfile(envId);
    if (profile?.activeWalletAddress) {
      // Verify wallet still exists
      if (allWallets.some(addr => addr.toLowerCase() === profile.activeWalletAddress.toLowerCase())) {
        return profile.activeWalletAddress;
      }
    }
    // Fallback to first wallet
    return allWallets[0] || null;
  }
}

