#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StorageService } from './services/index.js';
import { allTools } from './tools/index.js';
import { loadApiConfigs } from './tools/api.tools.js';
import { config } from './config/index.js';

// Initialize storage
await StorageService.init();
console.error('Storage initialized');

// Load saved API configurations
await loadApiConfigs();
console.error('API configurations loaded');

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
      console.error(`Tool called: ${tool.name}`, args);

      try {
        const result = await tool.handler(args);
        console.error(`Tool executed successfully: ${tool.name}`);

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
        console.error(`Tool execution failed: ${tool.name}`, error);
        throw error;
      }
    }
  ) as any; // Type assertion needed due to generic MCP SDK types
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('LLM Wallet MCP Server running on stdio', {
    network: config.NETWORK,
    facilitator: config.FACILITATOR_URL,
    storageDir: config.STORAGE_DIR,
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

