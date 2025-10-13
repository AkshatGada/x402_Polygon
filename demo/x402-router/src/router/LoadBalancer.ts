/**
 * Load balancer for selecting the best facilitator endpoint
 */

import { FacilitatorEndpoint } from '../types';
import { HealthDatabase } from '../health/HealthDatabase';

/**
 * Selects the best facilitator endpoint based on health metrics
 */
export class LoadBalancer {
  private db: HealthDatabase;

  /**
   * Create a new load balancer
   * @param db - Health database for querying metrics
   */
  constructor(db: HealthDatabase) {
    this.db = db;
  }

  /**
   * Select the best facilitator endpoint for a request
   * 
   * Selection algorithm:
   * 1. Filter by network support
   * 2. Exclude URLs in excludeList
   * 3. Calculate score for each candidate:
   *    - score = latency * 1.0
   *    - if unhealthy: score += 1000000 (huge penalty)
   *    - score += consecutiveFailures * 1000
   *    - score += priority * 100
   * 4. Return candidate with lowest score
   * 
   * @param endpoints - List of all facilitator endpoints
   * @param network - Required network support (e.g., "polygon", "amoy")
   * @param excludeUrls - URLs to exclude from selection (for retries)
   * @returns Selected endpoint or null if no valid candidates
   */
  selectBest(
    endpoints: FacilitatorEndpoint[],
    network: string,
    excludeUrls: string[] = []
  ): FacilitatorEndpoint | null {
    // Filter candidates
    const candidates = endpoints.filter(endpoint => {
      // Must support the requested network
      if (!endpoint.networks.includes(network)) {
        return false;
      }

      // Must not be in exclude list
      if (excludeUrls.includes(endpoint.url)) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Calculate scores for each candidate
    const scored = candidates.map(endpoint => {
      const health = this.db.getHealth(endpoint.url);

      let score = 0;

      if (health) {
        // Base score from latency
        score += health.lastLatencyMs * 1.0;

        // Huge penalty for unhealthy (but still consider as last resort)
        if (!health.isHealthy) {
          score += 1000000;
        }

        // Penalty for recent failures
        score += health.consecutiveFailures * 1000;
      } else {
        // No health data - moderate default score
        score += 5000;
      }

      // Priority bonus (lower priority = higher score)
      score += endpoint.priority * 100;

      return {
        endpoint,
        score
      };
    });

    // Sort by score (ascending - lower is better)
    scored.sort((a, b) => a.score - b.score);

    // Return best candidate
    return scored[0].endpoint;
  }

  /**
   * Count how many facilitators are healthy for a given network
   * @param endpoints - List of all facilitator endpoints
   * @param network - Network to check
   * @returns Number of healthy facilitators
   */
  getHealthyCount(endpoints: FacilitatorEndpoint[], network: string): number {
    let count = 0;

    for (const endpoint of endpoints) {
      // Must support the network
      if (!endpoint.networks.includes(network)) {
        continue;
      }

      const health = this.db.getHealth(endpoint.url);
      if (health && health.isHealthy) {
        count++;
      }
    }

    return count;
  }
}

