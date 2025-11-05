import express, { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { logger } from './logger'
import { handleVerify } from './verify-handler'
import { handleSettle } from './settle-handler'
import { signatureStorage } from './storage'

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const app = express()
const PORT = process.env.PORT || 3333
const HOST = process.env.HOST || 'localhost'

// Middleware
app.use(express.json())

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  })
  next()
})

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const stats = signatureStorage.getStats()
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: {
      clientServerPairs: stats.totalPairs,
      totalRequests: stats.totalRequests
    }
  })
})

// Payment verification endpoint
app.post('/verify', async (req: Request, res: Response) => {
  await handleVerify(req, res)
})

// Payment settlement endpoint
app.post('/settle', async (req: Request, res: Response) => {
  await handleSettle(req, res)
})

// Storage reset endpoint (for testing)
app.get('/reset', (req: Request, res: Response) => {
  logger.warn('Storage reset requested')
  signatureStorage.clear()
  res.status(200).json({
    status: 'storage cleared',
    timestamp: new Date().toISOString()
  })
})

// Storage state endpoint (for debugging)
app.get('/state', (req: Request, res: Response) => {
  const states = signatureStorage.getAllStates()
  res.status(200).json({
    states,
    stats: signatureStorage.getStats()
  })
})

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn('404 Not Found', {
    method: req.method,
    path: req.path
  })
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path
  })
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  })
})

// Start server
app.listen(PORT, () => {
  logger.info(`Test Facilitator listening`, {
    host: HOST,
    port: PORT,
    url: `http://${HOST}:${PORT}`
  })

  // Log environment
  logger.info('Configuration loaded', {
    polygonAmoyRpc: process.env.POLYGON_AMOY_RPC_URL?.substring(0, 30) + '...',
    paymentContract: process.env.PAYMENT_CONTRACT_ADDRESS?.substring(0, 10) + '...',
    walletAddress: process.env.WALLET_ADDRESS?.substring(0, 10) + '...',
    enableSettlement: process.env.ENABLE_SETTLEMENT === 'true'
  })

  console.log(`
╔════════════════════════════════════════════════╗
║    X402-SCALED Test Facilitator Running       ║
╠════════════════════════════════════════════════╣
║                                                ║
║  URL: http://${HOST}:${PORT}                      ║
║  Network: Polygon Amoy (testnet)              ║
║                                                ║
║  Endpoints:                                    ║
║    POST /verify   - Verify payment signature  ║
║    POST /settle   - Settle payment batch      ║
║    GET  /health   - Health check              ║
║    GET  /reset    - Clear storage (testing)   ║
║    GET  /state    - View storage state        ║
║                                                ║
║  Logs: ./logs/combined.log                    ║
║                                                ║
╚════════════════════════════════════════════════╝
  `)
})

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully')
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down')
  process.exit(0)
})
