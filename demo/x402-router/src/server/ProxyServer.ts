/**
 * Local HTTP proxy server for x402-router
 * 
 * This allows the router to be used with x402-express middleware
 * which expects a facilitator URL string, not an object with methods.
 */

import * as http from 'http';
import { FacilitatorRouter } from '../router/FacilitatorRouter';

export class ProxyServer {
  private server: http.Server | null = null;
  private port: number;
  private router: FacilitatorRouter;
  private address: string = '';

  constructor(router: FacilitatorRouter, port: number = 0) {
    this.router = router;
    this.port = port; // 0 means auto-assign available port
  }

  /**
   * Start the proxy server
   * @returns Promise<string> The URL where the server is listening
   */
  async start(): Promise<string> {
    if (this.server) {
      return this.address;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        try {
          // Parse request body for POST requests
          let body = '';
          if (req.method === 'POST') {
            await new Promise<void>((resolve) => {
              req.on('data', (chunk) => {
                body += chunk.toString();
              });
              req.on('end', () => resolve());
            });
          }

          const url = req.url || '/';

          // Route to appropriate handler
          if (url === '/verify' && req.method === 'POST') {
            const data = JSON.parse(body);
            const result = await this.router.verify(
              data.paymentPayload,
              data.paymentRequirements
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else if (url === '/settle' && req.method === 'POST') {
            const data = JSON.parse(body);
            const result = await this.router.settle(
              data.paymentPayload,
              data.paymentRequirements
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else if (url === '/supported' && req.method === 'GET') {
            const result = await this.router.supported();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else if (url.startsWith('/discovery/resources') && req.method === 'GET') {
            // Forward to first healthy facilitator
            const health = this.router.getHealth();
            const healthyFacilitator = Object.entries(health).find(([_, status]) => status.isHealthy);
            if (healthyFacilitator) {
              const [url] = healthyFacilitator;
              const response = await fetch(`${url}/discovery/resources${req.url?.split('/discovery/resources')[1] || ''}`);
              const data = await response.json();
              res.writeHead(response.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            } else {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No healthy facilitators available' }));
            }
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
          }
        } catch (error) {
          console.error('Proxy server error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal server error'
          }));
        }
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr !== 'string') {
          this.port = addr.port;
          this.address = `http://127.0.0.1:${this.port}`;
          resolve(this.address);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          this.address = '';
          resolve();
        }
      });
    });
  }

  /**
   * Get the URL where the server is listening
   */
  getUrl(): string {
    return this.address;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}

