/**
 * Core type definitions for x402 Facilitator Router SDK
 */

/**
 * Configuration for a single facilitator endpoint
 */
export interface FacilitatorEndpoint {
  /** Base URL of the facilitator (e.g., "https://x402.polygon.technology") */
  url: string;

  /** List of supported networks (e.g., ["polygon", "amoy"]) */
  networks: string[];

  /** Priority level - lower numbers = higher priority (1, 2, 3...) */
  priority: number;
}

/**
 * Health status of a facilitator endpoint
 */
export interface HealthStatus {
  /** Facilitator URL */
  url: string;

  /** Whether the facilitator is currently healthy */
  isHealthy: boolean;

  /** Last measured latency in milliseconds */
  lastLatencyMs: number;

  /** Unix timestamp of last health check */
  lastCheckTime: number;

  /** Number of consecutive failures (for marking unhealthy) */
  consecutiveFailures: number;

  /** Total number of requests sent to this facilitator */
  totalRequests: number;

  /** Number of successful requests */
  successfulRequests: number;
}

/**
 * Configuration options for the router
 */
export interface RouterConfig {
  /** Interval between health checks in milliseconds (default: 10000) */
  healthCheckInterval: number;

  /** Request timeout in milliseconds (default: 5000) */
  requestTimeout: number;

  /** Number of consecutive failures before marking unhealthy (default: 3) */
  maxConsecutiveFailures: number;

  /** Maximum number of retry attempts on failure (default: 2) */
  maxRetries: number;
}

/**
 * Payment payload structure for x402 protocol
 */
export interface PaymentPayload {
  /** Payer wallet address */
  from: string;

  /** Recipient wallet address */
  to: string;

  /** Amount in wei (as string to handle large numbers) */
  value: string;

  /** Unix timestamp - payment valid after this time */
  validAfter: number;

  /** Unix timestamp - payment valid before this time */
  validBefore: number;

  /** Unique nonce (bytes32 hex string) */
  nonce: string;

  /** EIP-712 signature components */
  signature: {
    v: number;
    r: string;
    s: string;
  };
}

/**
 * Event payload for health-changed events
 */
export interface HealthChangedEvent {
  /** Facilitator URL that changed */
  url: string;

  /** New health status */
  healthy: boolean;

  /** Full health status */
  status: HealthStatus;
}

/**
 * Aggregate metrics across all facilitators
 */
export interface AggregateMetrics {
  /** Total requests across all facilitators */
  totalRequests: number;

  /** Total successful requests */
  successfulRequests: number;

  /** Overall success rate (0-100) */
  successRate: number;

  /** Average latency across all healthy facilitators */
  averageLatency: number;

  /** Number of healthy facilitators */
  healthyCount: number;

  /** Number of unhealthy facilitators */
  unhealthyCount: number;

  /** Per-facilitator breakdown */
  byFacilitator: Record<string, HealthStatus>;
}

