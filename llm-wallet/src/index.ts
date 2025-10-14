#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StorageService } from './services/index.js';
import { allTools } from './tools/index.js';
import { loadApiConfigs } from './tools/api.tools.js';
import pino from 'pino';
import { config } from './config/index.js';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Initialize storage
await StorageService.init();
logger.info('Storage initialized');

// Load saved API configurations
await loadApiConfigs();
logger.info('API configurations loaded');

// Create MCP server
const server = new McpServer({
  name: 'llm-wallet',
  version: '1.0.0',
});

// Register all tools
for (const tool of allTools as any[]) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    async (args: any) => {
      logger.info({ tool: tool.name, args }, 'Tool called');

      try {
        const result = await tool.handler(args);
        logger.info({ tool: tool.name }, 'Tool executed successfully');

        // MCP expects a response with content array
        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error({ tool: tool.name, error }, 'Tool execution failed');
        throw error;
      }
    }
  ) as any; // Type assertion needed due to generic MCP SDK types
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info({
    network: config.NETWORK,
    facilitator: config.FACILITATOR_URL,
    storageDir: config.STORAGE_DIR,
  }, 'LLM Wallet MCP Server running on stdio');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});

