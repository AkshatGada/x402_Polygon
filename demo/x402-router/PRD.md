# **Product Requirements Document (PRD)**
# **x402 Facilitator Router SDK**

***

## **Document Information**

| Field | Value |
|-------|-------|
| **Project Name** | x402 Facilitator Router SDK |
| **Package Name** | `@polygon/x402-router` |
| **Version** | 1.0.0 |
| **Author** | Polygon Labs |
| **Document Owner** | Technical Product Manager |
| **Target Release** | Q4 2025 |
| **Status** | Ready for Development |
| **Last Updated** | October 4, 2025 |

***

## **1. Executive Summary**

Build a TypeScript SDK that acts as an intelligent reverse proxy and load balancer for multiple x402 facilitator endpoints on Polygon network. The router automatically monitors facilitator health, routes payment requests to the best-performing endpoint, and provides automatic failover to increase throughput and stability.

**Problem**: Current x402 facilitators (`x402.polygon.technology`, `facilitator.x402.rs`, `facilitator.payai.network`) are slow, low-throughput (~50 TPS each), and unstable with frequent downtime.

**Solution**: A client-side SDK that aggregates multiple facilitators, providing 3x throughput (~150 TPS), 99.5% uptime through automatic failover, and intelligent routing to the fastest available endpoint.

***

## **2. Background & Strategic Context**

### **What is x402 Protocol?**

x402 is a payment protocol that enables HTTP-native crypto payments using the HTTP 402 "Payment Required" status code. It allows seamless USDC stablecoin transfers without users needing native gas tokens.

**Key Technical Concepts**:

- **EIP-3009**: "Transfer With Authorization" - allows gasless token transfers where users sign off-chain messages that a facilitator submits on-chain
- **Facilitator**: A backend service that validates user signatures, sponsors gas fees, and submits payment transactions to blockchain
- **x402 Flow**: Client requests resource → Server returns 402 with payment requirements → Client signs authorization → Facilitator validates & settles on-chain

### **Current Architecture Pain Points**

```
Application → Single Facilitator URL → Blockchain
                      ↓
            (Single point of failure)
            (Low throughput: ~50 TPS)
            (Frequent downtime: ~95% uptime)
```

### **Target Architecture**

```
Application → Router SDK → Multiple Facilitators → Blockchain
                 ↓              ↓
         (Load balancing)  (3x aggregate capacity)
         (Health monitoring) (99.5% uptime)
         (Auto failover)     (~150 TPS)
```

### **Strategic Alignment**

This router enables:
1. **Google AI Agent partnerships** - requires enterprise-grade reliability
2. **Production micro-payment processing** - needs high throughput
3. **Developer-friendly integration** - drop-in replacement for single URL

***

## **3. Success Metrics**

| Metric | Current (Single Facilitator) | Target (Router) |
|--------|------------------------------|-----------------|
| **Throughput** | ~50 TPS | ~150 TPS (3x improvement) |
| **Uptime** | ~95% | 99.5% |
| **Average Latency** | 2000ms | 1500ms (routed to fastest) |
| **Failover Time** | N/A (manual) | <100ms (automatic) |
| **Developer Integration Time** | N/A | <5 minutes (drop-in replacement) |

***

## **4. User Personas & Use Cases**

### **Primary Persona: Backend Developer**

**Profile**:
- Building x402-enabled API services
- Needs reliable payment processing
- Wants minimal infrastructure management
- Familiar with Node.js/TypeScript ecosystem

**Use Case**: 
Replace hardcoded facilitator URL with router object to automatically gain failover and load balancing without code changes.

```typescript
// Before
const facilitatorUrl = "https://x402.polygon.technology";

// After
import { facilitator } from "@polygon/x402-router";
// facilitator object handles all routing automatically
```

### **Secondary Persona: DevOps Engineer**

**Profile**:
- Monitors production payment systems
- Needs visibility into facilitator health
- Requires metrics for debugging failures

**Use Case**:
Access real-time health status and metrics via SDK methods to monitor facilitator performance and debug payment failures.

***

## **5. Technical Requirements**

### **5.1 Functional Requirements**

#### **FR-1: Health Monitoring**
- **Description**: Background service that continuously monitors all facilitator endpoints
- **Acceptance Criteria**:
  - Pings each facilitator's `/supported` endpoint every 10 seconds (configurable)
  - Measures response latency in milliseconds
  - Marks facilitator unhealthy after 3 consecutive failures (configurable)
  - Emits `health-changed` event when facilitator status changes
  - Stores health data in persistent local database (SQLite)

#### **FR-2: Intelligent Load Balancing**
- **Description**: Selects best facilitator for each request based on health metrics
- **Acceptance Criteria**:
  - Filters facilitators by network support (e.g., only route "polygon" requests to facilitators supporting Polygon)
  - Excludes unhealthy facilitators from selection
  - Calculates score based on: latency (60% weight) + consecutive failures (penalty) + priority (bonus)
  - Selects facilitator with lowest score
  - Updates selection algorithm with fresh health data on each request

#### **FR-3: Automatic Failover**
- **Description**: Retry failed requests on alternate facilitators
- **Acceptance Criteria**:
  - If primary facilitator fails, immediately retry on next-best facilitator
  - Maximum 2 failover attempts (configurable)
  - Each failed facilitator excluded from subsequent retry attempts
  - Total failure only if all facilitators unavailable
  - Failure tracking updates health metrics in database

#### **FR-4: Request Proxying**
- **Description**: Transparently proxy x402 API calls to selected facilitator
- **Acceptance Criteria**:
  - Support `/verify` endpoint (POST with payment payload)
  - Support `/settle` endpoint (POST with payment payload)
  - Support `/supported` endpoint (GET for network/token info)
  - Preserve request/response formats exactly as facilitator expects
  - Timeout requests after 5 seconds (configurable)
  - Return responses transparently to application

#### **FR-5: Metrics & Observability**
- **Description**: Expose facilitator performance data for monitoring
- **Acceptance Criteria**:
  - Track total requests per facilitator
  - Track successful vs failed requests per facilitator
  - Calculate success rate percentage
  - Record average latency per facilitator
  - Provide `getHealth()` method returning current status of all facilitators
  - Provide `getMetrics()` method returning aggregated performance data

### **5.2 Non-Functional Requirements**

#### **NFR-1: Performance**
- SDK overhead must be <10ms per request
- Local database reads must complete in <1ms
- Health checks must not block application requests

#### **NFR-2: Compatibility**
- Node.js >= 16.0.0
- TypeScript with full type definitions
- Zero external dependencies except: `better-sqlite3`, `node-fetch`

#### **NFR-3: Developer Experience**
- Drop-in replacement for single facilitator URL
- Zero configuration required (sensible defaults)
- Optional configuration for advanced use cases
- Clear TypeScript types for all interfaces

#### **NFR-4: Reliability**
- Graceful degradation if database unavailable
- Automatic cleanup of resources on process exit
- No memory leaks in long-running processes

***

## **6. Architecture Specification**

### **6.1 Component Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                 FacilitatorRouter                            │
│  (Main entry point, orchestrates all components)            │
└──────────┬─────────────┬─────────────┬─────────────┬────────┘
           │             │             │             │
           ↓             ↓             ↓             ↓
   ┌───────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐
   │  Health   │  │   Health   │  │  Load    │  │  Request    │
   │  Checker  │→ │  Database  │← │ Balancer │← │  Handler    │
   │(Background)│  │  (SQLite)  │  │(Selector)│  │  (Proxy)    │
   └───────────┘  └────────────┘  └──────────┘  └─────────────┘
```

### **6.2 Data Flow**

**Payment Request Flow**:
1. Application calls `facilitator.verify(payload, network)`
2. `FacilitatorRouter` delegates to `LoadBalancer.selectBest()`
3. `LoadBalancer` queries `HealthDatabase` for current health metrics
4. `LoadBalancer` calculates scores and returns best facilitator
5. `RequestHandler.proxyRequest()` sends HTTP request to selected facilitator
6. On success: Update success metrics in database, return response
7. On failure: Update failure metrics, retry with next-best facilitator

**Health Check Flow** (Background):
1. Every 10 seconds, `HealthChecker` pings all facilitators
2. Measure response time and success/failure
3. Calculate consecutive failures count
4. Write updated `HealthStatus` to `HealthDatabase`
5. If status changed (healthy ↔ unhealthy), emit `health-changed` event

### **6.3 Database Schema**

```sql
CREATE TABLE facilitators_health (
  url TEXT PRIMARY KEY,
  is_healthy INTEGER DEFAULT 1,        -- 1 = healthy, 0 = unhealthy
  last_latency_ms INTEGER DEFAULT 0,   -- Response time in milliseconds
  last_check_time INTEGER DEFAULT 0,   -- Unix timestamp of last health check
  consecutive_failures INTEGER DEFAULT 0, -- Counter for marking unhealthy
  total_requests INTEGER DEFAULT 0,    -- Lifetime request count
  successful_requests INTEGER DEFAULT 0 -- Lifetime success count
);
```

***

## **7. Implementation Specification**

### **7.1 Project Structure**

```
@polygon/x402-router/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Public exports
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   ├── config/
│   │   └── facilitators.ts         # Facilitator registry & defaults
│   ├── health/
│   │   ├── HealthDatabase.ts       # SQLite wrapper
│   │   └── HealthChecker.ts        # Background monitoring
│   └── router/
│       ├── FacilitatorRouter.ts    # Main orchestrator
│       ├── LoadBalancer.ts         # Selection algorithm
│       └── RequestHandler.ts       # HTTP proxy logic
└── dist/                           # Compiled JavaScript (generated)
```

### **7.2 Key Interfaces**

```typescript
// Core types that must be implemented

export interface FacilitatorEndpoint {
  url: string;              // e.g., "https://x402.polygon.technology"
  networks: string[];       // e.g., ["polygon", "amoy"]
  priority: number;         // Lower = higher priority (1, 2, 3...)
}

export interface HealthStatus {
  url: string;
  isHealthy: boolean;
  lastLatencyMs: number;
  lastCheckTime: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
}

export interface RouterConfig {
  healthCheckInterval: number;      // Default: 10000ms
  requestTimeout: number;           // Default: 5000ms
  maxConsecutiveFailures: number;   // Default: 3
  maxRetries: number;               // Default: 2
}

export interface PaymentPayload {
  from: string;           // User wallet address
  to: string;             // Recipient address
  value: string;          // Amount in wei
  validAfter: number;     // Unix timestamp
  validBefore: number;    // Unix timestamp
  nonce: string;          // Unique nonce (bytes32)
  signature: {
    v: number;
    r: string;
    s: string;
  };
}
```

### **7.3 Public API Surface**

```typescript
// What developers will use

import { facilitator } from "@polygon/x402-router";

// Core methods
await facilitator.verify(payload: PaymentPayload, network: string): Promise<any>
await facilitator.settle(payload: PaymentPayload, network: string): Promise<any>
await facilitator.supported(): Promise<any>

// Monitoring methods
facilitator.getHealth(): Record<string, HealthStatus>
facilitator.getMetrics(): Record<string, any>
facilitator.shutdown(): void

// Event listeners
facilitator.on('health-changed', ({ url, healthy }) => {
  console.log(`${url} is now ${healthy ? 'healthy' : 'unhealthy'}`);
});
```

### **7.4 Configuration**

**Facilitator Registry** (hardcoded in `src/config/facilitators.ts`):

```typescript
export const FACILITATOR_REGISTRY: FacilitatorEndpoint[] = [
  {
    url: 'https://x402.polygon.technology',
    networks: ['polygon', 'amoy'],
    priority: 1
  },
  {
    url: 'https://facilitator.x402.rs',
    networks: ['polygon', 'base', 'amoy'],
    priority: 2
  },
  {
    url: 'https://facilitator.payai.network',
    networks: ['polygon', 'base'],
    priority: 3
  }
];

export const DEFAULT_CONFIG: RouterConfig = {
  healthCheckInterval: 10000,
  requestTimeout: 5000,
  maxConsecutiveFailures: 3,
  maxRetries: 2
};
```

***

## **8. Detailed Component Specifications**

### **8.1 HealthDatabase Class**

**Responsibilities**:
- Manage SQLite database connection
- Provide CRUD operations for health data
- Ensure data persistence across app restarts

**Key Methods**:
```typescript
constructor(dbPath?: string)           // Default: ~/.x402-router/health.db
upsertHealth(status: HealthStatus): void
getHealth(url: string): HealthStatus | null
getAllHealth(): HealthStatus[]
incrementRequests(url: string, success: boolean): void
close(): void
```

**Implementation Notes**:
- Use `better-sqlite3` for synchronous, fast operations
- Create database directory if doesn't exist
- Initialize schema on first run
- Handle database errors gracefully

### **8.2 HealthChecker Class**

**Responsibilities**:
- Background monitoring of all facilitators
- Update health status in database
- Emit events on status changes

**Key Methods**:
```typescript
constructor(endpoints, db, config)
start(): void                          // Begin health checks
stop(): void                           // Stop health checks
private runHealthChecks(): Promise<void>
private checkEndpoint(endpoint): Promise<void>
private markUnhealthy(url, currentHealth): void
```

**Health Check Algorithm**:
1. Call `GET /supported` on facilitator (lightweight endpoint)
2. Measure response time with `Date.now()` before/after
3. If response OK (status 200): Mark healthy, reset failure count, record latency
4. If response fails or times out: Increment consecutive failures
5. If consecutive failures >= threshold: Mark unhealthy
6. If status changed from previous: Emit `health-changed` event

**Implementation Notes**:
- Use `setInterval()` for periodic checks
- Use `AbortController` for request timeouts (3 seconds)
- Handle network errors without crashing
- Extend EventEmitter for event emission

### **8.3 LoadBalancer Class**

**Responsibilities**:
- Select best facilitator for each request
- Implement scoring algorithm
- Support network filtering

**Key Methods**:
```typescript
constructor(db: HealthDatabase)
selectBest(
  endpoints: FacilitatorEndpoint[],
  network: string,
  excludeUrls: string[] = []
): FacilitatorEndpoint | null
getHealthyCount(endpoints, network): number
```

**Selection Algorithm**:
```
1. Filter candidates:
   - Must support requested network
   - Must not be in excludeUrls list

2. For each candidate, calculate score:
   score = lastLatencyMs * 1.0
   if (!isHealthy) score += 1000000  // Massive penalty
   score += consecutiveFailures * 1000
   score += priority * 100

3. Sort by score (ascending)

4. Return candidate with lowest score
```

**Implementation Notes**:
- Return `null` if no valid candidates
- Lower score = better candidate
- Heavily penalize unhealthy facilitators but don't exclude entirely (last resort)

### **8.4 RequestHandler Class**

**Responsibilities**:
- Proxy HTTP requests to facilitators
- Handle timeouts and errors
- Update health metrics after each request

**Key Methods**:
```typescript
constructor(db, config)
async proxyRequest(
  endpoint: FacilitatorEndpoint,
  path: 'verify' | 'settle' | 'supported',
  payload?: PaymentPayload
): Promise<any>
private recordSuccess(url, latency): void
private recordFailure(url): void
```

**Request Flow**:
1. Create AbortController for timeout
2. Build request options (method, headers, body)
3. Call `fetch(url, options)` with signal
4. If response.ok: Parse JSON, record success, return data
5. If error: Record failure, throw error

**Implementation Notes**:
- Use `node-fetch` for HTTP requests
- Always clear timeout after request completes
- Record latency on success for load balancer
- Increment failure count on any error

### **8.5 FacilitatorRouter Class**

**Responsibilities**:
- Main orchestrator that ties all components together
- Public API implementation
- Request routing with fallback logic

**Key Methods**:
```typescript
constructor(config?: Partial<RouterConfig>)
async verify(payload, network): Promise<any>
async settle(payload, network): Promise<any>
async supported(): Promise<any>
getHealth(): Record<string, HealthStatus>
getMetrics(): Record<string, any>
shutdown(): void
private async routeRequest(path, network, payload?): Promise<any>
```

**Routing Algorithm** (with fallback):
```
excludeUrls = []

for attempt in 0..maxRetries:
  1. endpoint = loadBalancer.selectBest(endpoints, network, excludeUrls)
  2. if endpoint is null: throw "No available facilitators"
  
  3. try:
       result = requestHandler.proxyRequest(endpoint, path, payload)
       return result  // Success!
  
  4. catch error:
       excludeUrls.push(endpoint.url)
       continue to next attempt

throw "All facilitators failed"
```

**Implementation Notes**:
- Extends EventEmitter for events
- Starts health checker automatically in constructor
- Graceful shutdown: Stop health checker, close database
- Register SIGINT/SIGTERM handlers for cleanup

***

## **9. Error Handling**

### **Error Scenarios**

| Scenario | Handling Strategy |
|----------|-------------------|
| All facilitators unhealthy | Try least-unhealthy option, fail with clear error message |
| Database unavailable | Log warning, continue with in-memory fallback (degraded mode) |
| Network timeout | Mark facilitator unhealthy, retry on next facilitator |
| Invalid payload format | Throw validation error immediately (don't retry) |
| Process exit (SIGINT/SIGTERM) | Gracefully stop health checker, close database |

### **Error Messages**

Must be descriptive and actionable:

```typescript
// Good error messages
throw new Error(`No available facilitators for network: ${network}. Tried: ${excludeUrls.join(', ')}`);

throw new Error(`All facilitators failed for network ${network}. Last error: ${lastError.message}`);

// Not acceptable
throw new Error("Request failed");
```

***

## **10. Testing Requirements**

### **Unit Tests** (Jest)

**HealthDatabase**:
- Test database initialization
- Test upsert operation
- Test query operations
- Test request increment

**LoadBalancer**:
- Test selection with all healthy facilitators
- Test selection with one unhealthy facilitator
- Test network filtering
- Test priority ordering

**RequestHandler**:
- Test successful request
- Test timeout handling
- Test failure recording

**FacilitatorRouter**:
- Test routing to best facilitator
- Test automatic fallback on failure
- Test exhaustion of all facilitators

### **Integration Tests**

- End-to-end verify request flow
- End-to-end settle request flow
- Health check updates after successful request
- Failover to backup facilitator on primary failure

***

## **11. Documentation Requirements**

### **README.md Must Include**:

1. **Installation** - `npm install @polygon/x402-router`
2. **Quick Start** - 5-line example showing drop-in replacement
3. **API Reference** - All public methods with parameters
4. **Configuration** - How to customize router behavior
5. **Monitoring** - How to access health and metrics
6. **How It Works** - Brief explanation of routing algorithm

### **Inline Code Documentation**:

- JSDoc comments on all public methods
- Explain non-obvious logic in comments
- Document assumptions and edge cases

***

## **12. Dependencies**

### **Production Dependencies**

| Package | Version | Purpose |
|---------|---------|---------|
| `better-sqlite3` | ^9.2.2 | Fast, synchronous SQLite database |
| `node-fetch` | ^3.3.2 | HTTP client for making requests |

### **Development Dependencies**

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.3.3 | TypeScript compiler |
| `@types/node` | ^20.10.6 | Node.js type definitions |
| `@types/better-sqlite3` | ^7.6.8 | SQLite type definitions |
| `jest` | ^29.7.0 | Testing framework |
| `@types/jest` | ^29.5.11 | Jest type definitions |

***

## **13. Package Configuration**

### **package.json**

```json
{
  "name": "@polygon/x402-router",
  "version": "1.0.0",
  "description": "Intelligent router for x402 facilitators on Polygon",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest"
  },
  "keywords": ["x402", "polygon", "facilitator", "router", "payments"],
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### **tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

***

## **14. Acceptance Criteria**

### **Definition of Done**

- [ ] All TypeScript files compile without errors
- [ ] All unit tests pass
- [ ] Integration tests validate end-to-end flows
- [ ] README.md documentation complete
- [ ] Package builds successfully (`npm run build`)
- [ ] Facilitator object can be imported: `import { facilitator } from "@polygon/x402-router"`
- [ ] Health monitoring runs in background without blocking
- [ ] Failed requests automatically retry on backup facilitators
- [ ] Health and metrics methods return accurate data
- [ ] Graceful shutdown on SIGINT/SIGTERM

### **Manual Testing Checklist**

- [ ] Install package in test application
- [ ] Replace hardcoded facilitator URL with router object
- [ ] Make 100 verify requests, all succeed or fail with clear error
- [ ] Simulate facilitator downtime (block URL), verify automatic failover
- [ ] Run for 1 hour, verify no memory leaks
- [ ] Check `getHealth()` returns current status
- [ ] Check `getMetrics()` shows accurate request counts

***

## **15. Launch Plan**

### **Phase 1: Alpha (Internal Testing)**
- Deploy to internal test environment
- Validate health monitoring accuracy
- Test failover behavior under simulated failures
- Duration: 1 week

### **Phase 2: Beta (Select Partners)**
- Share with 3-5 early adopter developers
- Gather feedback on API usability
- Monitor real-world performance metrics
- Duration: 2 weeks

### **Phase 3: General Availability**
- Publish to npm public registry
- Announce on Polygon developer channels
- Update x402 documentation to recommend router
- Duration: Ongoing

***

## **16. Implementation Notes for Cursor AI**

### **Code Generation Guidelines**

1. **Use TypeScript strict mode** - Enable all strict compiler options
2. **Prefer composition over inheritance** - Use dependency injection
3. **Make database operations synchronous** - better-sqlite3 supports this
4. **Use EventEmitter for loose coupling** - Health changes emit events
5. **Handle errors explicitly** - No silent failures, always throw or log
6. **Clean up resources** - Close database, clear intervals on shutdown

### **Critical Implementation Details**

**HealthChecker**:
- Must call `start()` to begin monitoring
- Must extend EventEmitter to emit 'health-changed' events
- Health check interval managed by setInterval
- Each check creates AbortController for timeout

**LoadBalancer**:
- Scoring algorithm is critical - lower score wins
- Must filter by network support before scoring
- excludeUrls list prevents retry loops

**RequestHandler**:
- Always use AbortController with timeout
- Record latency immediately after successful response
- Update database on both success and failure

**FacilitatorRouter**:
- Constructor initializes all components
- routeRequest handles retry loop logic
- shutdown() must cleanup all resources

### **Database Schema**

Table name: `facilitators_health`

Columns:
- `url TEXT PRIMARY KEY`
- `is_healthy INTEGER` (0 or 1, SQLite doesn't have boolean)
- `last_latency_ms INTEGER`
- `last_check_time INTEGER` (Unix timestamp)
- `consecutive_failures INTEGER`
- `total_requests INTEGER`
- `successful_requests INTEGER`

### **File Dependencies**

Dependency graph (import order matters):
```
types/index.ts (no dependencies)
config/facilitators.ts (imports types)
health/HealthDatabase.ts (imports types)
health/HealthChecker.ts (imports types, HealthDatabase)
router/LoadBalancer.ts (imports types, HealthDatabase)
router/RequestHandler.ts (imports types, HealthDatabase)
router/FacilitatorRouter.ts (imports ALL above)
index.ts (imports FacilitatorRouter, exports facilitator singleton)
```

***

## **17. Questions & Answers**

**Q: Why SQLite instead of Redis or external database?**  
A: Zero configuration, embedded, fast local reads (<1ms), persistent across restarts, perfect for client-side caching.

**Q: Why client-side SDK instead of centralized proxy service?**  
A: No infrastructure overhead, lower latency (no extra network hop), no single point of failure, simpler deployment.

**Q: How to handle facilitator additions/removals?**  
A: Currently hardcoded in config. Future enhancement: Dynamic registry with add/remove methods.

**Q: What if all facilitators are unhealthy?**  
A: Router will try the least-unhealthy option as last resort. If all fail, throw descriptive error.

**Q: Does router cache responses?**  
A: No, all requests are proxied in real-time. Caching is application's responsibility.

***

## **18. Future Enhancements (Out of Scope for v1.0)**

- Dynamic facilitator registry (add/remove at runtime)
- Request caching layer
- Circuit breaker pattern for faster failure detection
- Metrics export to Prometheus
- Admin dashboard UI for health visualization
- Support for custom routing strategies
- WebSocket support for real-time updates

***

## **Appendix: Example Usage**

```typescript
// Real-world usage example

import express from 'express';
import { paymentMiddleware } from '@polygon/x402-middleware';
import { facilitator } from '@polygon/x402-router';

const app = express();

// Router automatically handles failover and load balancing
app.use(paymentMiddleware(
  "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  {
    "GET /weather": {
      price: "$0.001",
      network: "polygon",
    },
    "GET /premium-data": {
      price: "$0.01",
      network: "polygon",
    }
  },
  facilitator  // Smart routing instead of hardcoded URL
));

app.get('/weather', (req, res) => {
  res.json({ temperature: 72, conditions: 'sunny' });
});

app.get('/premium-data', (req, res) => {
  res.json({ data: 'premium content' });
});

// Monitor facilitator health
setInterval(() => {
  const health = facilitator.getHealth();
  console.log('Facilitator health:', health);
}, 30000);

// Listen for health changes
facilitator.on('health-changed', ({ url, healthy }) => {
  console.log(`Alert: ${url} is now ${healthy ? 'healthy' : 'unhealthy'}`);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

***

**END OF PRD**

This document contains all information needed to build the x402 Facilitator Router SDK. All technical specifications, implementation details, and acceptance criteria are clearly defined for AI-assisted development.

[1](https://www.atlassian.com/agile/product-management/requirements)
[2](https://productschool.com/blog/product-strategy/product-template-requirements-document-prd)
[3](https://www.hustlebadger.com/what-do-product-teams-do/prd-template-examples/)
[4](https://www.atlassian.com/software/confluence/templates/product-requirements)
[5](https://www.aha.io/roadmapping/guide/requirements-management/what-is-a-good-product-requirements-document-template)
[6](https://www.figma.com/resource-library/product-requirements-document/)
[7](https://www.notion.com/templates/category/product-requirements-doc)
[8](https://www.projectmanager.com/templates/product-requirements-document-template)
[9](https://www.news.aakashg.com/p/product-requirements-documents-prds)