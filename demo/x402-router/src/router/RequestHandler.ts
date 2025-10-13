/**
 * HTTP request handler for proxying requests to facilitators
 */

import fetch from 'node-fetch';
import { FacilitatorEndpoint, PaymentPayload, RouterConfig } from '../types';
import { HealthDatabase } from '../health/HealthDatabase';

/**
 * Handles HTTP requests to facilitator endpoints with timeout and metrics
 */
export class RequestHandler {
  private db: HealthDatabase;
  private config: RouterConfig;

  /**
   * Create a new request handler
   * @param db - Health database for recording metrics
   * @param config - Router configuration
   */
  constructor(db: HealthDatabase, config: RouterConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Proxy a request to a facilitator endpoint
   * 
   * @param endpoint - Facilitator endpoint to call
   * @param path - API path ('verify', 'settle', or 'supported')
   * @param data - Request data (for verify/settle: {payload, paymentRequirements})
   * @returns Response data from facilitator
   * @throws Error if request fails or times out
   */
  async proxyRequest(
    endpoint: FacilitatorEndpoint,
    path: 'verify' | 'settle' | 'supported',
    data?: any
  ): Promise<any> {
    const url = `${endpoint.url}/${path}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.requestTimeout
    );

    const startTime = Date.now();

    try {
      // Determine HTTP method
      const method = path === 'supported' ? 'GET' : 'POST';

      // Build request options
      const options: any = {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      };

      // Add body for POST requests
      if (method === 'POST' && data) {
        // Format the request body as expected by facilitator API
        const requestBody = {
          x402Version: data.payload?.x402Version || 1,
          paymentPayload: data.payload,
          paymentRequirements: data.paymentRequirements
        };
        options.body = JSON.stringify(requestBody);

        // Debug logging
        if (process.env.DEBUG_ROUTER === 'true') {
          console.log(`\n[RequestHandler] Sending to ${endpoint.url}/${path}:`);
          console.log(JSON.stringify(requestBody, null, 2));
        }
      }

      // Make the request
      const response = await fetch(url, options);

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      // Check response status
      if (response.ok) {
        const data = await response.json();

        // Record success
        this.recordSuccess(endpoint.url, latency);

        return data;
      } else {
        // Record failure
        this.recordFailure(endpoint.url);

        throw new Error(
          `Facilitator request failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Record failure
      this.recordFailure(endpoint.url);

      // Re-throw with context
      if (error.name === 'AbortError') {
        throw new Error(`Request to ${endpoint.url} timed out after ${this.config.requestTimeout}ms`);
      }

      throw new Error(`Request to ${endpoint.url} failed: ${error.message}`);
    }
  }

  /**
   * Record a successful request
   * @param url - Facilitator URL
   * @param latency - Response latency in milliseconds
   */
  private recordSuccess(url: string, latency: number): void {
    // Increment request counters
    this.db.incrementRequests(url, true);

    // Update latency
    const health = this.db.getHealth(url);
    if (health) {
      health.lastLatencyMs = latency;
      health.lastCheckTime = Date.now();
      this.db.upsertHealth(health);
    }
  }

  /**
   * Record a failed request
   * @param url - Facilitator URL
   */
  private recordFailure(url: string): void {
    // Increment total requests but not successful requests
    this.db.incrementRequests(url, false);
  }
}

