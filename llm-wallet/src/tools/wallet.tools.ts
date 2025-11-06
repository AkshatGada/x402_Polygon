import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { WalletService, StorageService } from '../services/index.js';
import { config, NETWORKS } from '../config/index.js';
import { z } from 'zod';

const walletService = new WalletService();

export const walletTools = [
  {
    name: 'wallet_set_network',
    description: 'Set the blockchain network (polygon or polygon-amoy)',
    inputSchema: {
      network: z.enum(['polygon', 'polygon-amoy']).describe('Network to use: polygon (mainnet) or polygon-amoy (testnet)')
    },
    async handler(args: { network: 'polygon' | 'polygon-amoy' }) {
      const networkConfig = NETWORKS[args.network];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            network: args.network,
            chainId: networkConfig.chainId,
            rpcUrl: networkConfig.rpcUrl,
            usdcAddress: networkConfig.usdcAddress,
            facilitatorUrl: networkConfig.facilitatorUrl,
            message: `Network set to ${args.network}. Restart the MCP server to apply changes.`
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'wallet_create',
    description: 'Create a new Ethereum HD wallet with encrypted storage',
    inputSchema: {
      label: z.string().describe('Human-readable wallet label')
    },
    async handler(args: { label: string }) {
      const { address, mnemonic } = await walletService.createWallet(args.label);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address,
            mnemonic,
            label: args.label,
            network: config.NETWORK,
            warning: 'Save your mnemonic phrase securely. It cannot be recovered if lost.'
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'wallet_import',
    description: 'Import an existing wallet from private key',
    inputSchema: {
      privateKey: z.string().describe('Private key (with or without 0x prefix)'),
      label: z.string().describe('Human-readable wallet label')
    },
    async handler(args: any) {
      if (!args || !args.privateKey || !args.label) {
        return {
          content: [{
            type: 'text',
            text: 'Error: privateKey and label are required'
          }],
          isError: true
        };
      }

      const address = await walletService.importWallet(args.privateKey, args.label);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address,
            label: args.label,
            network: config.NETWORK,
            message: 'Wallet imported successfully'
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'wallet_balance',
    description: 'Get USDC and native token balance for current wallet',
    inputSchema: {
      network: z.enum(['polygon', 'polygon-amoy']).optional().describe('Network to check balance on (defaults to configured network)')
    },
    async handler(args: { network?: string }) {
      const network = (args.network || config.NETWORK) as keyof typeof NETWORKS;
      const networkConfig = NETWORKS[network];

      const wallet = await StorageService.getActiveWallet();
      const client = createPublicClient({
        transport: http(networkConfig.rpcUrl)
      });

      const [nativeBalance, usdcBalance] = await Promise.all([
        client.getBalance({ address: wallet.address as `0x${string}` }),
        client.readContract({
          address: networkConfig.usdcAddress as `0x${string}`,
          abi: [{
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          }],
          functionName: 'balanceOf',
          args: [wallet.address as `0x${string}`]
        })
      ]);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: wallet.address,
            network,
            balances: {
              native: formatEther(nativeBalance),
              usdc: formatUnits(usdcBalance as bigint, 6)
            }
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'wallet_history',
    description: 'Get payment and settlement history',
    inputSchema: {
      limit: z.number().optional().default(10),
      offset: z.number().optional().default(0)
    },
    async handler(args: { limit?: number; offset?: number }) {
      const history = await StorageService.getHistory(args.limit || 10, args.offset || 0);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            payments: history,
            count: history.length
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'wallet_set_active',
    description: 'Set the active wallet for this LLM environment',
    inputSchema: {
      walletAddress: z.string().describe('Wallet address (0x...) to set as active'),
      alias: z.string().optional().describe('Optional: Memorable name for this wallet in this environment')
    },
    async handler(args: { walletAddress: string; alias?: string }) {
      try {
        // Verify wallet exists
        await StorageService.getWallet(args.walletAddress);

        // Set as active for this environment
        await StorageService.setActiveWalletForEnvironment(args.walletAddress);

        const envInfo = await StorageService.getEnvironmentInfo();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Wallet ${args.walletAddress} set as active for environment "${envInfo.environmentId}"`,
              activeWallet: {
                address: args.walletAddress,
                alias: args.alias,
                environment: envInfo.environmentId
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to set active wallet'
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  },

  {
    name: 'wallet_list',
    description: 'List all wallets and environment information',
    inputSchema: {},
    async handler() {
      try {
        const envInfo = await StorageService.getEnvironmentInfo();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              environment: {
                id: envInfo.environmentId,
                activeWallet: envInfo.activeWallet
                  ? {
                      address: envInfo.activeWallet.address,
                      label: envInfo.activeWallet.label,
                      createdAt: new Date(envInfo.activeWallet.createdAt).toISOString()
                    }
                  : null
              },
              accessibleWallets: envInfo.accessibleWallets.map(w => ({
                address: w.address,
                label: w.label,
                network: w.network,
                createdAt: new Date(w.createdAt).toISOString(),
                accessibleBy: w.accessibleBy || ['all'],
                isActive: w.address === envInfo.activeWallet?.address
              }))
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to list wallets'
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  },

  {
    name: 'wallet_share',
    description: 'Share a wallet with another LLM environment (e.g., share Claude wallet with Cursor)',
    inputSchema: {
      walletAddress: z.string().describe('Wallet address to share'),
      targetEnvironment: z.string().describe('Target environment ID (e.g., "claude", "cursor", "chatgpt")')
    },
    async handler(args: { walletAddress: string; targetEnvironment: string }) {
      try {
        // Verify wallet exists
        await StorageService.getWallet(args.walletAddress);

        // Share wallet
        await StorageService.shareWalletWithEnvironment(args.walletAddress, args.targetEnvironment);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Wallet ${args.walletAddress} is now accessible to environment "${args.targetEnvironment}"`,
              sharedWallet: {
                address: args.walletAddress,
                sharedWith: args.targetEnvironment
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to share wallet'
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  },

  {
    name: 'wallet_delete',
    description: 'Delete a specific wallet permanently',
    inputSchema: {
      walletAddress: z.string().describe('Wallet address (0x...) to delete')
    },
    async handler(args: { walletAddress: string }) {
      try {
        // Verify wallet exists
        const wallet = await StorageService.getWallet(args.walletAddress);

        // Get current active wallet
        const activeWallet = await StorageService.getActiveWallet();

        // Prevent deletion of the currently active wallet
        if (activeWallet.address.toLowerCase() === args.walletAddress.toLowerCase()) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Cannot delete the currently active wallet. Set another wallet as active first using wallet_set_active.'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Delete the wallet
        await StorageService.deleteWallet(args.walletAddress);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Wallet ${args.walletAddress} has been permanently deleted`,
              deletedWallet: {
                address: args.walletAddress,
                label: wallet.label
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to delete wallet'
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  }
];

