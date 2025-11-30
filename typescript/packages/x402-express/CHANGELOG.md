# Changelog

All notable changes to x402-express-async will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-30

### Added
- Initial release of x402-express-async middleware
- Asynchronous payment settlement for ultra-low latency
- Comprehensive settlement logging with timing metrics
- Configurable logging via `X402_LOG_SETTLEMENT` environment variable
- Support for Polygon Amoy and Base networks
- Built-in paywall UI for browser requests
- Optional Coinbase Onramp integration
- Full TypeScript support with type definitions
- Dual module format (ESM + CJS)

### Changed
- Settlement happens asynchronously after serving the resource
- `X-PAYMENT-RESPONSE` header is not included in responses
- Faster response times compared to synchronous settlement

### Technical Details
- **Payment Flow**: Verification → Resource Delivery → Async Settlement
- **Settlement**: Fire-and-forget pattern using `setImmediate()`
- **Logging**: Detailed success and error logs with settlement duration
- **Error Handling**: Failed settlements are logged but don't affect client response

### Breaking Changes from x402-express
- `X-PAYMENT-RESPONSE` header is no longer included
- Clients cannot receive transaction hash in the HTTP response
- Settlement failures do not block resource delivery

### Known Limitations
- No transaction hash returned to client
- No built-in settlement retry mechanism
- No persistent settlement storage
- No settlement status polling endpoint

### Future Roadmap
- Settlement status polling endpoint
- WebSocket support for real-time settlement notifications
- Configurable retry mechanism
- Persistent settlement storage interface
- Settlement audit trail

## [Unreleased]

### Planned Features
- Settlement status API endpoint
- WebSocket/SSE support for settlement notifications
- Retry configuration
- Storage interface for settlement persistence
- Webhook support for settlement events

