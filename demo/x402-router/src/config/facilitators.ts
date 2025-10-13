/**
 * Facilitator registry and default configuration
 */

import { FacilitatorEndpoint, RouterConfig } from '../types';

/**
 * Registry of known x402 facilitator endpoints
 * Priority: Lower numbers = higher priority
 */
export const FACILITATOR_REGISTRY: FacilitatorEndpoint[] = [
  {
    url: 'https://x402-amoy.polygon.technology',
    networks: ['polygon', 'polygon-amoy', 'amoy'],
    priority: 1
  },
  {
    url: 'https://facilitator.x402.rs',
    networks: ['polygon', 'polygon-amoy', 'base', 'base-sepolia', 'amoy'],
    priority: 2
  },
  {
    url: 'https://facilitator.payai.network',
    networks: ['polygon', 'polygon-amoy', 'base', 'base-sepolia'],
    priority: 3
  }
];

/**
 * Default router configuration
 * All values are configurable at runtime
 */
export const DEFAULT_CONFIG: RouterConfig = {
  /** Health check interval: 10 seconds */
  healthCheckInterval: 10000,

  /** Request timeout: 5 seconds */
  requestTimeout: 5000,

  /** Mark unhealthy after 3 consecutive failures */
  maxConsecutiveFailures: 3,

  /** Maximum 2 retry attempts per request */
  maxRetries: 2
};

