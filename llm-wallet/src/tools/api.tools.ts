
import { z } from 'zod';
import { StorageService, WalletService, X402Service } from '../services/index.js';
import type { PaymentRequirements } from 'x402/types';

// API Endpoint Configuration Schema
const ApiEndpointConfigSchema = z.object({
  name: z.string().describe('Tool name (e.g., "weather_api")'),
  description: z.string().describe('Tool description'),
  endpoint: z.string().url().describe('API endpoint URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
  headers: z.record(z.string()).optional().describe('Custom headers'),
  requiresPayment: z.boolean().default(false).describe('Whether this API requires x402 payment'),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }).optional().describe('JSON schema for input parameters'),
  outputSchema: z.object({
    type: z.string(),
    properties: z.record(z.any()).optional(),
  }).optional().describe('JSON schema for expected output'),
  paymentConfig: z.object({
    maxAmount: z.string().optional().describe('Max USDC for this API'),
    network: z.string().optional(),
  }).optional(),
});

export type ApiEndpointConfig = z.infer<typeof ApiEndpointConfigSchema>;

// Storage for registered API tools
const registeredApis = new Map<string, ApiEndpointConfig>();

/**
 * Register a paid API as an MCP tool
 */
export const api_register_tool = {
  name: 'api_register',
  description: 'Register any paid API endpoint as an MCP tool that agents can call',
  inputSchema: {
    name: z.string().describe('Unique tool name (e.g., "weather_api", "data_fetch")'),
    description: z.string().describe('What this API does (shown to agents)'),
    endpoint: z.string().describe('API endpoint URL (can be x402-protected)'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET').describe('HTTP method'),
    headers: z.record(z.string()).optional().describe('Custom headers (e.g., API keys)'),
    requiresPayment: z.boolean().optional().default(false).describe('Whether this API requires x402 payment'),
    inputSchema: z.any().optional().describe('JSON schema defining input parameters'),
    paymentConfig: z.object({
      maxAmount: z.string().optional().describe('Max USDC (e.g., "0.10")'),
      network: z.string().optional().describe('Network (e.g., "polygon-amoy")'),
    }).optional().describe('Payment configuration for x402 APIs'),
  },

  async execute(args: unknown) {
    const config = ApiEndpointConfigSchema.parse(args);

    // Validate tool name is unique
    if (registeredApis.has(config.name)) {
      throw new Error(`Tool "${config.name}" is already registered`);
    }

    // Store configuration
    registeredApis.set(config.name, config);

    // Persist to storage
    await StorageService.saveApiConfig(config.name, config);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          toolName: config.name,
          message: `API tool "${config.name}" registered successfully`,
          endpoint: config.endpoint,
          requiresPayment: config.requiresPayment,
        }, null, 2),
      }],
    };
  },
};

/**
 * List all registered API tools
 */
export const api_list_tools = {
  name: 'api_list',
  description: 'List all registered API tools',
  inputSchema: {},

  async execute() {
    const tools = Array.from(registeredApis.entries()).map(([name, config]) => ({
      name,
      description: config.description,
      endpoint: config.endpoint,
      method: config.method,
      requiresPayment: config.requiresPayment,
    }));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ tools }, null, 2),
      }],
    };
  },
};

/**
 * Call a registered API tool
 */
export const api_call_tool = {
  name: 'api_call',
  description: 'Execute a registered API tool with parameters',
  inputSchema: {
    toolName: z.string().describe('Name of the registered API tool to call'),
    params: z.record(z.any()).optional().describe('Parameters to pass to the API (query params or body)'),
  },

  async execute(args: { toolName: string; params?: Record<string, any> }) {
    const { toolName, params = {} } = args;

    // Get API configuration
    const config = registeredApis.get(toolName) || await StorageService.getApiConfig(toolName);
    if (!config) {
      throw new Error(`API tool "${toolName}" not found. Use api_register to create it.`);
    }

    // Build request
    let url = config.endpoint;
    const fetchOptions: RequestInit = {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
    };

    // Add params based on method
    if (config.method === 'GET' && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url = `${url}?${queryString}`;
    } else if (['POST', 'PUT'].includes(config.method)) {
      fetchOptions.body = JSON.stringify(params);
    }

    try {
      let response: Response;

      // Handle x402-protected APIs
      if (config.requiresPayment) {
        const walletService = new WalletService();
        const x402Service = new X402Service();
        const wallet = await walletService.getWallet();

        // Check spending limits if configured
        let maxValue = BigInt(10 * 10 ** 6); // Default 10 USDC
        if (config.paymentConfig?.maxAmount) {
          maxValue = BigInt(parseFloat(config.paymentConfig.maxAmount) * 1_000_000);
        }

        // Create x402-fetch wrapped client - handles 402 automatically
        const fetchWithPayment = await x402Service.createBuyerFetch(
          wallet.privateKey,
          maxValue
        );

        // Make request - x402-fetch handles 402 → pay → retry automatically
        response = await fetchWithPayment(url, fetchOptions);

        // Log payment if successful (check for X-PAYMENT-RESPONSE header)
        const paymentResponseHeader = response.headers.get('X-PAYMENT-RESPONSE');
        if (response.ok && paymentResponseHeader) {
          await StorageService.savePayment({
            id: `api-${toolName}-${Date.now()}`,
            timestamp: Date.now(),
            paymentHeader: '', // x402-fetch handled this internally
            verified: true,
            settled: true,
            amount: '0', // Would need to decode X-PAYMENT-RESPONSE for exact amount
            network: config.network || 'polygon-amoy',
            resource: url,
          });
        }
      } else {
        // Regular API call (no payment required)
        response = await fetch(url, fetchOptions);
      }

      // Increment call count in registry
      await StorageService.incrementApiCallCount(toolName);

      // Parse response
      const contentType = response.headers.get('content-type');
      let data: any;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: response.ok,
            status: response.status,
            data,
            toolName,
            endpoint: config.endpoint,
          }, null, 2),
        }],
      };

    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            toolName,
            endpoint: config.endpoint,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

/**
 * Unregister an API tool
 */
export const api_unregister_tool = {
  name: 'api_unregister',
  description: 'Remove a registered API tool',
  inputSchema: {
    toolName: z.string().describe('Name of the tool to remove'),
  },

  async execute(args: { toolName: string }) {
    const { toolName } = args;

    if (!registeredApis.has(toolName)) {
      throw new Error(`Tool "${toolName}" not found`);
    }

    registeredApis.delete(toolName);
    await StorageService.deleteApiConfig(toolName);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          message: `Tool "${toolName}" removed successfully`,
        }, null, 2),
      }],
    };
  },
};

/**
 * Load saved API configurations on startup
 */
export async function loadApiConfigs() {
  try {
    const configs = await StorageService.getAllApiConfigs();
    for (const [name, config] of Object.entries(configs)) {
      registeredApis.set(name, config as ApiEndpointConfig);
    }
    console.error(`Loaded ${registeredApis.size} API tool configurations`);
  } catch (error) {
    console.error('Failed to load API configs:', error);
  }
}

/**
 * Export tools array for MCP server registration
 */
export const apiTools = [
  { name: api_register_tool.name, description: api_register_tool.description, inputSchema: api_register_tool.inputSchema, handler: api_register_tool.execute },
  { name: api_list_tools.name, description: api_list_tools.description, inputSchema: api_list_tools.inputSchema, handler: api_list_tools.execute },
  { name: api_call_tool.name, description: api_call_tool.description, inputSchema: api_call_tool.inputSchema, handler: api_call_tool.execute },
  { name: api_unregister_tool.name, description: api_unregister_tool.description, inputSchema: api_unregister_tool.inputSchema, handler: api_unregister_tool.execute },
];

