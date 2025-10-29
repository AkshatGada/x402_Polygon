import { z } from 'zod';
import { StorageService } from '../services/index.js';

export const registryTools = [
  {
    name: 'registry_list',
    description: 'List all publicly registered x402 APIs on Polygon network',
    inputSchema: {
      network: z.enum(['polygon', 'polygon-amoy']).optional().describe('Filter by network (polygon or polygon-amoy)'),
      limit: z.number().optional().default(50).describe('Maximum number of APIs to return')
    },
    async handler(args: { network?: 'polygon' | 'polygon-amoy'; limit?: number }) {
      const apis = await StorageService.listPublicApis(args.network, args.limit || 50);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            apis: apis.map(api => ({
              name: api.name,
              description: api.description,
              endpoint: api.endpoint,
              price: api.price,
              network: api.network,
              method: api.method,
              pay_to: api.pay_to,
              call_count: api.call_count,
            })),
            count: apis.length,
            message: `Found ${apis.length} x402 APIs`
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'registry_search',
    description: 'Search for x402 APIs by name or description keywords',
    inputSchema: {
      query: z.string().describe('Search term (matches name or description)')
    },
    async handler(args: { query: string }) {
      const apis = await StorageService.searchPublicApis(args.query);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            apis: apis.map(api => ({
              name: api.name,
              description: api.description,
              endpoint: api.endpoint,
              price: api.price,
              network: api.network,
              method: api.method,
              pay_to: api.pay_to,
              call_count: api.call_count,
            })),
            count: apis.length,
            query: args.query,
            message: `Found ${apis.length} APIs matching "${args.query}"`
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'registry_get',
    description: 'Get detailed information about a specific x402 API',
    inputSchema: {
      name: z.string().describe('API name to retrieve')
    },
    async handler(args: { name: string }) {
      const api = await StorageService.getPublicApi(args.name);

      if (!api) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `API "${args.name}" not found in registry`
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            api: {
              name: api.name,
              description: api.description,
              endpoint: api.endpoint,
              method: api.method,
              price: api.price,
              network: api.network,
              scheme: api.scheme,
              pay_to: api.pay_to,
              headers: api.headers ? JSON.parse(api.headers) : null,
              input_schema: api.input_schema ? JSON.parse(api.input_schema) : null,
              registered_at: new Date(api.registered_at).toISOString(),
              last_called_at: api.last_called_at ? new Date(api.last_called_at).toISOString() : null,
              call_count: api.call_count,
            }
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'registry_stats',
    description: 'Get global statistics about the x402 API registry',
    inputSchema: {},
    async handler() {
      const allApis = await StorageService.listPublicApis(undefined, 10000); // Get all
      const polygonApis = allApis.filter(api => api.network === 'polygon');
      const amoyApis = allApis.filter(api => api.network === 'polygon-amoy');

      const topApis = allApis
        .sort((a, b) => b.call_count - a.call_count)
        .slice(0, 10)
        .map(api => ({
          name: api.name,
          call_count: api.call_count,
          price: api.price,
        }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total_apis: allApis.length,
            by_network: {
              polygon: polygonApis.length,
              'polygon-amoy': amoyApis.length,
            },
            top_apis: topApis,
            total_calls: allApis.reduce((sum, api) => sum + api.call_count, 0),
          }, null, 2)
        }]
      };
    }
  }
];

