/**
 * @polygon/x402-router
 * 
 * Intelligent router for x402 facilitators on Polygon network.
 * Provides automatic failover, load balancing, and health monitoring
 * for multiple facilitator endpoints.
 * 
 * @example
 * ```typescript
 * import { facilitator } from '@polygon/x402-router';
 * 
 * // Use instead of hardcoded facilitator URL
 * const response = await facilitator.verify(payload, 'polygon');
 * 
 * // Monitor health
 * facilitator.on('health-changed', ({ url, healthy }) => {
 *   console.log(`${url} is now ${healthy ? 'healthy' : 'unhealthy'}`);
 * });
 * ```
 */

import { FacilitatorRouter } from './router/FacilitatorRouter';

// Export types
export * from './types';

// Export main router class for custom instances
export { FacilitatorRouter };

// Export singleton instance for easy drop-in replacement
export const facilitator = new FacilitatorRouter();

// Default export is the singleton
export default facilitator;

