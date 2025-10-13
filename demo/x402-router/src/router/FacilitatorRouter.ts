/**
 * Main orchestrator for the x402 facilitator router
 */

import { EventEmitter } from 'events';
import {
  FacilitatorEndpoint,
  RouterConfig,
  PaymentPayload,
  HealthStatus,
  AggregateMetrics,
  HealthChangedEvent
} from '../types';
import { FACILITATOR_REGISTRY, DEFAULT_CONFIG } from '../config/facilitators';
import { HealthDatabase } from '../health/HealthDatabase';
import { HealthChecker } from '../health/HealthChecker';
import { LoadBalancer } from './LoadBalancer';
import { RequestHandler } from './RequestHandler';
import { ProxyServer } from '../server/ProxyServer';

/**
 * Main router class that orchestrates health monitoring, load balancing,
 * and request routing with automatic failover
 */
export class FacilitatorRouter extends EventEmitter {
  private endpoints: FacilitatorEndpoint[];
  private config: RouterConfig;
  private db: HealthDatabase;
  private healthChecker: HealthChecker;
  private loadBalancer: LoadBalancer;
  private requestHandler: RequestHandler;
  private proxyServer: ProxyServer;
  public url: string = '';

  /**
   * Create a new facilitator router
   * @param config - Optional configuration (merged with defaults)
   */
  constructor(config?: Partial<RouterConfig>) {
    super();

    // Merge config with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    // Load facilitator registry
    this.endpoints = FACILITATOR_REGISTRY;

    // Initialize database
    this.db = new HealthDatabase();

    // Initialize components
    this.loadBalancer = new LoadBalancer(this.db);
    this.requestHandler = new RequestHandler(this.db, this.config);
    this.healthChecker = new HealthChecker(
      this.endpoints,
      this.db,
      this.config
    );

    // Initialize proxy server
    this.proxyServer = new ProxyServer(this);

    // Forward health-changed events from HealthChecker
    this.healthChecker.on('health-changed', (event: HealthChangedEvent) => {
      this.emit('health-changed', event);
    });

    // Start health monitoring
    this.healthChecker.start();

    // Start proxy server and set URL
    this.startProxyServer();

    // Register cleanup handlers
    this.registerCleanup();
  }

  /**
   * Start the local proxy server
   */
  private async startProxyServer(): Promise<void> {
    try {
      this.url = await this.proxyServer.start();
    } catch (error) {
      console.error('Failed to start proxy server:', error);
      // Don't throw - router can still be used directly without HTTP
    }
  }

  /**
   * Verify a payment payload with the facilitator
   * @param payload - Payment payload to verify
   * @param paymentRequirements - Payment requirements
   * @returns Verification response from facilitator
   */
  async verify(payload: any, paymentRequirements: any): Promise<any> {
    return this.routeRequest('verify', paymentRequirements.network, {
      payload,
      paymentRequirements
    });
  }

  /**
   * Settle a payment with the facilitator
   * @param payload - Payment payload to settle
   * @param paymentRequirements - Payment requirements
   * @returns Settlement response from facilitator
   */
  async settle(payload: any, paymentRequirements: any): Promise<any> {
    return this.routeRequest('settle', paymentRequirements.network, {
      payload,
      paymentRequirements
    });
  }

  /**
   * Get supported networks and assets from facilitators
   * @returns Supported configuration
   */
  async supported(): Promise<any> {
    // Use 'polygon' as default network for supported endpoint
    // Most facilitators support polygon
    return this.routeRequest('supported', 'polygon');
  }

  /**
   * Route a request to the best available facilitator with automatic failover
   * 
   * @param path - API path to call
   * @param network - Required network support
   * @param payload - Payment payload (optional)
   * @returns Response from facilitator
   * @throws Error if all facilitators fail
   */
  private async routeRequest(
    path: 'verify' | 'settle' | 'supported',
    network: string,
    data?: any
  ): Promise<any> {
    const excludeUrls: string[] = [];
    let lastError: Error | null = null;

    // Try up to maxRetries + 1 attempts (initial + retries)
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Select best facilitator
      const endpoint = this.loadBalancer.selectBest(
        this.endpoints,
        network,
        excludeUrls
      );

      if (!endpoint) {
        // No more candidates available
        const tried = excludeUrls.length > 0 ? ` Tried: ${excludeUrls.join(', ')}` : '';
        throw new Error(
          `No available facilitators for network: ${network}.${tried}`
        );
      }

      try {
        // Attempt the request
        const result = await this.requestHandler.proxyRequest(
          endpoint,
          path,
          data
        );

        // Success! Return the result
        return result;
      } catch (error: any) {
        // Request failed, exclude this facilitator and try next
        lastError = error;
        excludeUrls.push(endpoint.url);

        // Continue to next attempt
      }
    }

    // All attempts exhausted
    throw new Error(
      `All facilitators failed for network ${network}. Last error: ${lastError?.message || 'Unknown'}`
    );
  }

  /**
   * Get current health status of all facilitators
   * @returns Health status keyed by facilitator URL
   */
  getHealth(): Record<string, HealthStatus> {
    const allHealth = this.db.getAllHealth();
    const result: Record<string, HealthStatus> = {};

    for (const health of allHealth) {
      result[health.url] = health;
    }

    return result;
  }

  /**
   * Get aggregate metrics across all facilitators
   * @returns Aggregate performance metrics
   */
  getMetrics(): AggregateMetrics {
    const allHealth = this.db.getAllHealth();

    let totalRequests = 0;
    let successfulRequests = 0;
    let totalLatency = 0;
    let healthyCount = 0;
    let unhealthyCount = 0;
    let healthyFacilitatorsWithLatency = 0;

    const byFacilitator: Record<string, HealthStatus> = {};

    for (const health of allHealth) {
      totalRequests += health.totalRequests;
      successfulRequests += health.successfulRequests;

      if (health.isHealthy) {
        healthyCount++;
        if (health.lastLatencyMs > 0) {
          totalLatency += health.lastLatencyMs;
          healthyFacilitatorsWithLatency++;
        }
      } else {
        unhealthyCount++;
      }

      byFacilitator[health.url] = health;
    }

    const successRate = totalRequests > 0
      ? (successfulRequests / totalRequests) * 100
      : 0;

    const averageLatency = healthyFacilitatorsWithLatency > 0
      ? totalLatency / healthyFacilitatorsWithLatency
      : 0;

    return {
      totalRequests,
      successfulRequests,
      successRate: Math.round(successRate * 100) / 100, // Round to 2 decimals
      averageLatency: Math.round(averageLatency),
      healthyCount,
      unhealthyCount,
      byFacilitator
    };
  }

  /**
   * Gracefully shutdown the router
   * Stops health monitoring, proxy server, and closes database
   */
  async shutdown(): Promise<void> {
    this.healthChecker.stop();
    await this.proxyServer.stop();
    this.db.close();
  }

  /**
   * Register cleanup handlers for process exit
   */
  private registerCleanup(): void {
    const cleanup = () => {
      this.shutdown();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}

