/**
 * Background health monitoring for facilitator endpoints
 */

import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { FacilitatorEndpoint, HealthStatus, RouterConfig, HealthChangedEvent } from '../types';
import { HealthDatabase } from './HealthDatabase';

/**
 * Monitors facilitator health in the background and emits events on status changes
 */
export class HealthChecker extends EventEmitter {
  private endpoints: FacilitatorEndpoint[];
  private db: HealthDatabase;
  private config: RouterConfig;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Create a new health checker
   * @param endpoints - List of facilitator endpoints to monitor
   * @param db - Health database for persistence
   * @param config - Router configuration
   */
  constructor(
    endpoints: FacilitatorEndpoint[],
    db: HealthDatabase,
    config: RouterConfig
  ) {
    super();
    this.endpoints = endpoints;
    this.db = db;
    this.config = config;
  }

  /**
   * Start background health monitoring
   */
  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    // Run immediately on start
    this.runHealthChecks().catch(err => {
      console.error('[HealthChecker] Initial health check failed:', err);
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runHealthChecks().catch(err => {
        console.error('[HealthChecker] Health check failed:', err);
      });
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop background health monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run health checks on all endpoints concurrently
   */
  private async runHealthChecks(): Promise<void> {
    const checks = this.endpoints.map(endpoint =>
      this.checkEndpoint(endpoint)
    );

    await Promise.allSettled(checks);
  }

  /**
   * Check health of a single endpoint
   * @param endpoint - Facilitator endpoint to check
   */
  private async checkEndpoint(endpoint: FacilitatorEndpoint): Promise<void> {
    const startTime = Date.now();

    // Get current health status
    let currentHealth = this.db.getHealth(endpoint.url);

    // Initialize if not exists
    if (!currentHealth) {
      currentHealth = {
        url: endpoint.url,
        isHealthy: true,
        lastLatencyMs: 0,
        lastCheckTime: 0,
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0
      };
      this.db.upsertHealth(currentHealth);
    }

    // Create abort controller for timeout (3 seconds for health checks)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      // Call /supported endpoint (lightweight)
      const response = await fetch(`${endpoint.url}/supported`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (response.ok) {
        // Success - mark healthy
        const wasUnhealthy = !currentHealth.isHealthy;

        const newHealth: HealthStatus = {
          ...currentHealth,
          isHealthy: true,
          lastLatencyMs: latency,
          lastCheckTime: Date.now(),
          consecutiveFailures: 0
        };

        this.db.upsertHealth(newHealth);

        // Emit event if status changed
        if (wasUnhealthy) {
          this.emitHealthChanged(endpoint.url, true, newHealth);
        }
      } else {
        // Non-OK response - treat as failure
        this.handleFailure(endpoint.url, currentHealth);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      // Network error or timeout - treat as failure
      this.handleFailure(endpoint.url, currentHealth);
    }
  }

  /**
   * Handle a failed health check
   * @param url - Facilitator URL
   * @param currentHealth - Current health status
   */
  private handleFailure(url: string, currentHealth: HealthStatus): void {
    const wasHealthy = currentHealth.isHealthy;
    const newConsecutiveFailures = currentHealth.consecutiveFailures + 1;
    const isNowUnhealthy = newConsecutiveFailures >= this.config.maxConsecutiveFailures;

    const newHealth: HealthStatus = {
      ...currentHealth,
      isHealthy: !isNowUnhealthy,
      lastCheckTime: Date.now(),
      consecutiveFailures: newConsecutiveFailures
    };

    this.db.upsertHealth(newHealth);

    // Emit event if status changed from healthy to unhealthy
    if (wasHealthy && isNowUnhealthy) {
      this.emitHealthChanged(url, false, newHealth);
    }
  }

  /**
   * Emit a health-changed event
   * @param url - Facilitator URL
   * @param healthy - New health status
   * @param status - Full health status
   */
  private emitHealthChanged(url: string, healthy: boolean, status: HealthStatus): void {
    const event: HealthChangedEvent = {
      url,
      healthy,
      status
    };

    this.emit('health-changed', event);
  }
}

