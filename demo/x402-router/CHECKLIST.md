# x402 Facilitator Router SDK - Implementation Checklist

## Project Overview
Building an intelligent TypeScript SDK that acts as a reverse proxy and load balancer for multiple x402 facilitator endpoints on Polygon network.

**Target Metrics:**
- 3x throughput improvement (~150 TPS)
- 99.5% uptime through automatic failover
- <5 minute drop-in replacement integration

---

## Phase 1: Project Setup & Foundation

### 1.1 Initialize Project Structure
- [ ] Create base directory structure
  - [ ] `src/` (source files)
  - [ ] `src/types/` (TypeScript interfaces)
  - [ ] `src/config/` (facilitator registry)
  - [ ] `src/health/` (monitoring components)
  - [ ] `src/router/` (routing logic)
  - [ ] `dist/` (compiled output - gitignored)
- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json` with strict mode
- [ ] Create `.gitignore` (node_modules, dist, *.db)
- [ ] Create basic `README.md` structure

### 1.2 Install Dependencies
- [ ] Production: `better-sqlite3@^9.2.2`
- [ ] Production: `node-fetch@^3.3.2`
- [ ] Dev: `typescript@^5.3.3`
- [ ] Dev: `@types/node@^20.10.6`
- [ ] Dev: `@types/better-sqlite3@^7.6.8`
- [ ] Dev: `jest@^29.7.0`
- [ ] Dev: `@types/jest@^29.5.11`

---

## Phase 2: Core Type Definitions

### 2.1 Create `src/types/index.ts`
- [ ] Define `FacilitatorEndpoint` interface
  - [ ] `url: string`
  - [ ] `networks: string[]`
  - [ ] `priority: number`
- [ ] Define `HealthStatus` interface
  - [ ] `url: string`
  - [ ] `isHealthy: boolean`
  - [ ] `lastLatencyMs: number`
  - [ ] `lastCheckTime: number`
  - [ ] `consecutiveFailures: number`
  - [ ] `totalRequests: number`
  - [ ] `successfulRequests: number`
- [ ] Define `RouterConfig` interface
  - [ ] `healthCheckInterval: number`
  - [ ] `requestTimeout: number`
  - [ ] `maxConsecutiveFailures: number`
  - [ ] `maxRetries: number`
- [ ] Define `PaymentPayload` interface
  - [ ] `from: string`
  - [ ] `to: string`
  - [ ] `value: string`
  - [ ] `validAfter: number`
  - [ ] `validBefore: number`
  - [ ] `nonce: string`
  - [ ] `signature: { v: number; r: string; s: string }`
- [ ] Export all types

---

## Phase 3: Configuration Layer

### 3.1 Create `src/config/facilitators.ts`
- [ ] Import types from `../types`
- [ ] Define `FACILITATOR_REGISTRY` array
  - [ ] Add `https://x402.polygon.technology` (priority 1, polygon/amoy)
  - [ ] Add `https://facilitator.x402.rs` (priority 2, polygon/base/amoy)
  - [ ] Add `https://facilitator.payai.network` (priority 3, polygon/base)
- [ ] Define `DEFAULT_CONFIG` object
  - [ ] `healthCheckInterval: 10000`
  - [ ] `requestTimeout: 5000`
  - [ ] `maxConsecutiveFailures: 3`
  - [ ] `maxRetries: 2`
- [ ] Export both constants

---

## Phase 4: Health Database Layer

### 4.1 Create `src/health/HealthDatabase.ts`
- [ ] Import `better-sqlite3` and types
- [ ] Create `HealthDatabase` class
- [ ] Constructor
  - [ ] Accept optional `dbPath` parameter (default: `~/.x402-router/health.db`)
  - [ ] Create database directory if doesn't exist
  - [ ] Initialize SQLite connection
  - [ ] Create `facilitators_health` table if not exists
    - [ ] `url TEXT PRIMARY KEY`
    - [ ] `is_healthy INTEGER DEFAULT 1`
    - [ ] `last_latency_ms INTEGER DEFAULT 0`
    - [ ] `last_check_time INTEGER DEFAULT 0`
    - [ ] `consecutive_failures INTEGER DEFAULT 0`
    - [ ] `total_requests INTEGER DEFAULT 0`
    - [ ] `successful_requests INTEGER DEFAULT 0`
- [ ] Implement `upsertHealth(status: HealthStatus): void`
  - [ ] Use INSERT OR REPLACE statement
  - [ ] Convert boolean to integer for SQLite
- [ ] Implement `getHealth(url: string): HealthStatus | null`
  - [ ] Query by URL
  - [ ] Convert integer to boolean
  - [ ] Return null if not found
- [ ] Implement `getAllHealth(): HealthStatus[]`
  - [ ] Query all rows
  - [ ] Convert integers to booleans
- [ ] Implement `incrementRequests(url: string, success: boolean): void`
  - [ ] Increment `total_requests`
  - [ ] If success: increment `successful_requests`
- [ ] Implement `close(): void`
  - [ ] Close database connection
- [ ] Add error handling for database operations
- [ ] Add JSDoc comments for all public methods

---

## Phase 5: Health Checker Component

### 5.1 Create `src/health/HealthChecker.ts`
- [ ] Import EventEmitter, types, and HealthDatabase
- [ ] Create `HealthChecker` class extending EventEmitter
- [ ] Private properties
  - [ ] `endpoints: FacilitatorEndpoint[]`
  - [ ] `db: HealthDatabase`
  - [ ] `config: RouterConfig`
  - [ ] `intervalId: NodeJS.Timeout | null`
- [ ] Constructor
  - [ ] Accept `endpoints`, `db`, `config` parameters
  - [ ] Initialize properties
  - [ ] Don't start monitoring yet (manual start)
- [ ] Implement `start(): void`
  - [ ] Start setInterval with `healthCheckInterval`
  - [ ] Call `runHealthChecks()` immediately
  - [ ] Store interval ID
- [ ] Implement `stop(): void`
  - [ ] Clear interval
  - [ ] Set intervalId to null
- [ ] Implement private `runHealthChecks(): Promise<void>`
  - [ ] Map over all endpoints
  - [ ] Call `checkEndpoint()` for each
  - [ ] Use Promise.all to check concurrently
  - [ ] Handle errors gracefully
- [ ] Implement private `checkEndpoint(endpoint): Promise<void>`
  - [ ] Create AbortController with 3-second timeout
  - [ ] Fetch `${endpoint.url}/supported`
  - [ ] Measure latency with Date.now()
  - [ ] Get current health from database
  - [ ] If success (status 200):
    - [ ] Reset consecutive failures to 0
    - [ ] Update latency
    - [ ] Mark healthy
    - [ ] Check if status changed, emit event if so
  - [ ] If failure:
    - [ ] Increment consecutive failures
    - [ ] If >= maxConsecutiveFailures: mark unhealthy
    - [ ] Check if status changed, emit event if so
  - [ ] Update database with new health status
  - [ ] Clear timeout
- [ ] Add error handling for network failures
- [ ] Add JSDoc comments

---

## Phase 6: Load Balancer Component

### 6.1 Create `src/router/LoadBalancer.ts`
- [ ] Import types and HealthDatabase
- [ ] Create `LoadBalancer` class
- [ ] Private properties
  - [ ] `db: HealthDatabase`
- [ ] Constructor
  - [ ] Accept `db: HealthDatabase` parameter
- [ ] Implement `selectBest(endpoints, network, excludeUrls): FacilitatorEndpoint | null`
  - [ ] Filter candidates by network support
  - [ ] Filter out excluded URLs
  - [ ] For each candidate:
    - [ ] Get health status from database
    - [ ] Calculate score:
      - [ ] `score = lastLatencyMs * 1.0`
      - [ ] If not healthy: `score += 1000000`
      - [ ] `score += consecutiveFailures * 1000`
      - [ ] `score += priority * 100`
  - [ ] Sort by score (ascending)
  - [ ] Return first (lowest score) or null if no candidates
- [ ] Implement `getHealthyCount(endpoints, network): number`
  - [ ] Filter by network support
  - [ ] Count how many are healthy
- [ ] Add JSDoc comments

---

## Phase 7: Request Handler Component

### 7.1 Create `src/router/RequestHandler.ts`
- [ ] Import node-fetch, types, and HealthDatabase
- [ ] Create `RequestHandler` class
- [ ] Private properties
  - [ ] `db: HealthDatabase`
  - [ ] `config: RouterConfig`
- [ ] Constructor
  - [ ] Accept `db`, `config` parameters
- [ ] Implement `proxyRequest(endpoint, path, payload?): Promise<any>`
  - [ ] Create AbortController with requestTimeout
  - [ ] Build full URL: `${endpoint.url}/${path}`
  - [ ] Determine HTTP method (GET for /supported, POST for others)
  - [ ] Build request options
    - [ ] method
    - [ ] headers (Content-Type: application/json)
    - [ ] body (JSON.stringify if payload exists)
    - [ ] signal (from AbortController)
  - [ ] Record start time
  - [ ] Make fetch request
  - [ ] If response.ok:
    - [ ] Calculate latency
    - [ ] Parse JSON response
    - [ ] Call `recordSuccess(url, latency)`
    - [ ] Return parsed data
  - [ ] If not ok:
    - [ ] Call `recordFailure(url)`
    - [ ] Throw error with status and statusText
  - [ ] Clear timeout
  - [ ] Handle errors (network, timeout, etc.)
- [ ] Implement private `recordSuccess(url, latency): void`
  - [ ] Update database with successful request
  - [ ] Update latency in health status
  - [ ] Increment request counters
- [ ] Implement private `recordFailure(url): void`
  - [ ] Increment total requests
  - [ ] Do NOT increment successful requests
- [ ] Add JSDoc comments

---

## Phase 8: Main Router Orchestrator

### 8.1 Create `src/router/FacilitatorRouter.ts`
- [ ] Import EventEmitter, all components, types, and config
- [ ] Create `FacilitatorRouter` class extending EventEmitter
- [ ] Private properties
  - [ ] `endpoints: FacilitatorEndpoint[]`
  - [ ] `config: RouterConfig`
  - [ ] `db: HealthDatabase`
  - [ ] `healthChecker: HealthChecker`
  - [ ] `loadBalancer: LoadBalancer`
  - [ ] `requestHandler: RequestHandler`
- [ ] Constructor
  - [ ] Accept optional `config: Partial<RouterConfig>`
  - [ ] Merge with DEFAULT_CONFIG
  - [ ] Load FACILITATOR_REGISTRY
  - [ ] Initialize HealthDatabase
  - [ ] Initialize LoadBalancer
  - [ ] Initialize RequestHandler
  - [ ] Initialize HealthChecker
  - [ ] Forward 'health-changed' events from HealthChecker
  - [ ] Call `healthChecker.start()`
  - [ ] Register SIGINT/SIGTERM handlers for cleanup
- [ ] Implement `verify(payload, network): Promise<any>`
  - [ ] Call `routeRequest('verify', network, payload)`
- [ ] Implement `settle(payload, network): Promise<any>`
  - [ ] Call `routeRequest('settle', network, payload)`
- [ ] Implement `supported(): Promise<any>`
  - [ ] Call `routeRequest('supported', 'polygon')` (any network)
- [ ] Implement private `routeRequest(path, network, payload?): Promise<any>`
  - [ ] Initialize `excludeUrls = []`
  - [ ] Loop for maxRetries attempts:
    - [ ] Call `loadBalancer.selectBest(endpoints, network, excludeUrls)`
    - [ ] If null: throw "No available facilitators for network"
    - [ ] Try:
      - [ ] Call `requestHandler.proxyRequest(endpoint, path, payload)`
      - [ ] Return result on success
    - [ ] Catch:
      - [ ] Add endpoint.url to excludeUrls
      - [ ] Continue to next attempt
  - [ ] After all attempts: throw "All facilitators failed"
- [ ] Implement `getHealth(): Record<string, HealthStatus>`
  - [ ] Get all health from database
  - [ ] Convert array to object keyed by URL
- [ ] Implement `getMetrics(): Record<string, any>`
  - [ ] Calculate aggregate metrics from health data
  - [ ] Include: total requests, success rate, average latency
- [ ] Implement `shutdown(): void`
  - [ ] Stop health checker
  - [ ] Close database
  - [ ] Log shutdown message
- [ ] Add JSDoc comments for all public methods

---

## Phase 9: Public API & Exports

### 9.1 Create `src/index.ts`
- [ ] Import FacilitatorRouter
- [ ] Export all types from `./types`
- [ ] Create singleton instance: `export const facilitator = new FacilitatorRouter()`
- [ ] Export FacilitatorRouter class for custom instances
- [ ] Add package-level JSDoc comment

---

## Phase 10: Build Configuration

### 10.1 Configure TypeScript Build
- [ ] Verify `tsconfig.json` settings
  - [ ] target: ES2020
  - [ ] module: commonjs
  - [ ] declaration: true (for .d.ts files)
  - [ ] outDir: ./dist
  - [ ] rootDir: ./src
  - [ ] strict: true
- [ ] Test build: `npm run build`
- [ ] Verify dist/ contains compiled JS and .d.ts files

---

## Phase 11: Testing

### 11.1 Unit Tests - HealthDatabase
- [ ] Create `src/health/__tests__/HealthDatabase.test.ts`
- [ ] Test: Database initialization creates schema
- [ ] Test: upsertHealth inserts new record
- [ ] Test: upsertHealth updates existing record
- [ ] Test: getHealth returns correct data
- [ ] Test: getHealth returns null for non-existent URL
- [ ] Test: getAllHealth returns all records
- [ ] Test: incrementRequests updates counters correctly
- [ ] Test: close() closes connection

### 11.2 Unit Tests - LoadBalancer
- [ ] Create `src/router/__tests__/LoadBalancer.test.ts`
- [ ] Test: selectBest chooses lowest latency when all healthy
- [ ] Test: selectBest avoids unhealthy facilitators
- [ ] Test: selectBest filters by network support
- [ ] Test: selectBest respects excludeUrls
- [ ] Test: selectBest considers priority in scoring
- [ ] Test: selectBest returns null when no candidates
- [ ] Test: getHealthyCount returns correct count

### 11.3 Unit Tests - RequestHandler
- [ ] Create `src/router/__tests__/RequestHandler.test.ts`
- [ ] Test: proxyRequest succeeds with valid endpoint
- [ ] Test: proxyRequest handles timeout
- [ ] Test: proxyRequest records success metrics
- [ ] Test: proxyRequest records failure metrics
- [ ] Test: proxyRequest throws on non-ok response

### 11.4 Unit Tests - FacilitatorRouter
- [ ] Create `src/router/__tests__/FacilitatorRouter.test.ts`
- [ ] Test: verify routes to best facilitator
- [ ] Test: settle routes to best facilitator
- [ ] Test: supported returns aggregated data
- [ ] Test: automatic failover on primary failure
- [ ] Test: throws when all facilitators exhausted
- [ ] Test: getHealth returns current status
- [ ] Test: getMetrics returns aggregated data
- [ ] Test: shutdown cleans up resources

### 11.5 Integration Tests
- [ ] Create `src/__tests__/integration.test.ts`
- [ ] Test: End-to-end verify request flow
- [ ] Test: End-to-end settle request flow
- [ ] Test: Health check updates after request
- [ ] Test: Failover behavior with mock endpoints
- [ ] Test: Long-running test (no memory leaks)

---

## Phase 12: Documentation

### 12.1 Complete README.md
- [ ] Add project description
- [ ] Add installation instructions
- [ ] Add quick start example (5 lines)
- [ ] Add configuration options
- [ ] Add API reference
  - [ ] `facilitator.verify()`
  - [ ] `facilitator.settle()`
  - [ ] `facilitator.supported()`
  - [ ] `facilitator.getHealth()`
  - [ ] `facilitator.getMetrics()`
  - [ ] `facilitator.shutdown()`
  - [ ] Event: `health-changed`
- [ ] Add "How It Works" section
- [ ] Add troubleshooting guide
- [ ] Add example Express integration

### 12.2 Inline Documentation
- [ ] Review all JSDoc comments for completeness
- [ ] Add examples in JSDoc where helpful
- [ ] Document error scenarios
- [ ] Add @throws tags for error cases

---

## Phase 13: Polish & Refinement

### 13.1 Code Quality
- [ ] Run linter (if configured)
- [ ] Fix any TypeScript strict mode errors
- [ ] Remove console.logs (replace with proper logging)
- [ ] Add consistent error messages
- [ ] Validate all input parameters

### 13.2 Performance Optimization
- [ ] Profile database queries (<1ms requirement)
- [ ] Verify SDK overhead <10ms per request
- [ ] Test with 1000+ requests
- [ ] Check for memory leaks

### 13.3 Security Review
- [ ] Validate all user inputs
- [ ] No SQL injection risks (use prepared statements)
- [ ] Safe database path creation
- [ ] Proper timeout handling

---

## Phase 14: Manual Testing

### 14.1 Integration Testing
- [ ] Install package in demo application
- [ ] Replace hardcoded facilitator URL
- [ ] Make 100 verify requests
- [ ] Verify all succeed or fail with clear errors
- [ ] Simulate facilitator downtime
- [ ] Verify automatic failover works
- [ ] Run for 1 hour continuous operation
- [ ] Check for memory leaks
- [ ] Verify `getHealth()` accuracy
- [ ] Verify `getMetrics()` accuracy

---

## Phase 15: Release Preparation

### 15.1 Package Preparation
- [ ] Verify package.json completeness
  - [ ] Correct name: `@polygon/x402-router`
  - [ ] Version: 1.0.0
  - [ ] Description
  - [ ] Keywords
  - [ ] License
  - [ ] Repository URL
  - [ ] Author
- [ ] Add LICENSE file
- [ ] Add CHANGELOG.md
- [ ] Create .npmignore (exclude tests, src)

### 15.2 Final Checks
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Package size reasonable (<500KB)
- [ ] No security vulnerabilities: `npm audit`

---

## Acceptance Criteria Summary

### Definition of Done
- [x] All TypeScript files compile without errors
- [ ] All unit tests pass
- [ ] Integration tests validate end-to-end flows
- [ ] README.md documentation complete
- [ ] Package builds successfully
- [ ] Facilitator object can be imported
- [ ] Health monitoring runs in background
- [ ] Failed requests automatically retry
- [ ] Health and metrics methods return accurate data
- [ ] Graceful shutdown on SIGINT/SIGTERM

---

## Implementation Order (Recommended)

1. **Foundation** (Phases 1-3): Project setup, types, config
2. **Database Layer** (Phase 4): HealthDatabase implementation
3. **Monitoring** (Phase 5): HealthChecker implementation
4. **Routing Logic** (Phases 6-7): LoadBalancer and RequestHandler
5. **Orchestration** (Phase 8-9): FacilitatorRouter and exports
6. **Build** (Phase 10): Compile and verify
7. **Testing** (Phase 11): Write and run all tests
8. **Documentation** (Phase 12): Complete README and inline docs
9. **Polish** (Phase 13): Code quality and optimization
10. **Release** (Phases 14-15): Manual testing and package prep

---

## Notes for Implementation

- Use strict TypeScript mode throughout
- Handle all errors explicitly (no silent failures)
- Clean up resources properly (database, intervals)
- Make database operations synchronous (better-sqlite3 supports it)
- Use EventEmitter for loose coupling
- Keep SDK overhead minimal (<10ms per request)
- Ensure thread-safety for health checks
- Log important events but avoid console spam
- Make the API feel natural for Express.js developers

---

## Estimated Timeline

- **Phase 1-3** (Setup): 1-2 hours
- **Phase 4-5** (Database & Monitoring): 3-4 hours
- **Phase 6-8** (Routing & Orchestration): 4-5 hours
- **Phase 9-10** (Exports & Build): 1 hour
- **Phase 11** (Testing): 4-6 hours
- **Phase 12-13** (Docs & Polish): 2-3 hours
- **Phase 14-15** (Manual Testing & Release): 2-3 hours

**Total Estimated Time**: 17-24 hours

---

## Success Metrics Tracking

Track these metrics during development and testing:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Throughput | ~150 TPS | TBD | ⏳ |
| Uptime | 99.5% | TBD | ⏳ |
| Average Latency | <1500ms | TBD | ⏳ |
| Failover Time | <100ms | TBD | ⏳ |
| SDK Overhead | <10ms | TBD | ⏳ |
| Integration Time | <5 min | TBD | ⏳ |

---

**Last Updated**: October 4, 2025
**Status**: Ready to begin implementation

