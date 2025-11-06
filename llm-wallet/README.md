# LLM Wallet MCP Server

Universal MCP (Model Context Protocol) server providing wallet capabilities and x402 micropayment functionality to any AI agent. This server enables AI agents to create wallets, manage spending limits, and automatically handle micropayments for paid APIs.

## What This MCP Server Does

This server provides **21 MCP tools** that allow AI agents to:
- **Create and manage encrypted wallets** (HD wallets with private key encryption)
- **Persistent wallet context** across sessions and environments (Claude, Cursor, ChatGPT, etc.)
- **Check balance** across networks (Polygon, Polygon Amoy)
- **Make automatic micropayments** to x402-protected APIs
- **Enforce spending limits** (per-transaction and daily caps)
- **Track payment history** and transaction logs
- **Register any paid API** as an MCP tool for easy reuse
- **Support multiple networks** (testnet and mainnet)


### Step 1: Add to Your MCP Configuration

#### For Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "LLM Wallet": {
      "command": "npx",
      "args": ["llm-wallet-mcp"],
      "env": {
        "NETWORK": "polygon-amoy"
      }
    }
  }
}
```

#### For Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "LLM Wallet": {
      "command": "npx",
      "args": ["llm-wallet-mcp"],
      "env": {
        "NETWORK": "polygon-amoy"
      }
    }
  }
}
```

### Step 1.5: Encryption Key Persistence (Automatic ✅)

The MCP server **automatically handles encryption key management**:

#### How It Works
- **First startup**: If no `WALLET_ENCRYPTION_KEY` is provided, the server generates a random 256-bit key
- **Key is persisted**: The key is automatically saved to `~/.llm-wallet/.encryption-key` with restricted permissions
- **Automatic recovery**: On subsequent startups, the same key is loaded, allowing wallet decryption
- **No manual setup needed**: Wallets work across sessions automatically

#### Optional: Use Your Own Encryption Key

If you want to use a custom encryption key (for better security control):

```json
{
  "mcpServers": {
    "LLM Wallet": {
      "command": "npx",
      "args": ["llm-wallet-mcp@latest"],
      "env": {
        "NETWORK": "polygon-amoy",
        "WALLET_ENCRYPTION_KEY": "your-32-character-minimum-secret-key-here1234567890ab"
      }
    }
  }
}
```

**Requirements:**
- Must be at least 32 characters long
- Must never change (changing it makes existing wallets inaccessible)
- Keep it secret (don't commit to version control)

⚠️ **Important**: Once you set a custom key, keep it safe. If lost or changed, all encrypted wallets become permanently inaccessible.

### Step 2: Verify Installation
In your MCP client, you should now see **21 tools** available:
- 7 wallet management tools (including environment-aware wallet switching)
- 2 spending limit tools  
- 2 x402 buyer tools
- 5 x402 seller tools
- 4 dynamic API tools
- 1 network configuration tool

> **⚠️ Development Notice**: This package is still in development. Please prefer to use on testnet (polygon-amoy) or if using on mainnet, use only small amounts. Do not use in production environments.

## 🎯 Environment-Aware Wallets

One of the key features of this MCP server is **persistent wallet context across sessions and environments**.

### The Problem It Solves
Previously, if you used the wallet in Claude on Day 1 and came back on Day 3, the wallet context would be lost. Each environment (Claude, Cursor, ChatGPT) had no memory of which wallet it was using, causing decryption failures.

### The Solution
The server now automatically:
- ✅ Detects which environment you're in (Claude, Cursor, ChatGPT, VSCode, etc.)
- ✅ Remembers the active wallet for that environment across sessions
- ✅ Allows sharing wallets between environments
- ✅ Provides tools to switch between wallets seamlessly

### Quick Start: Environment Wallets

**Check which environment you're in and which wallet is active:**
```bash
# In any LLM environment
@LLM Wallet list all wallets
```

**Response shows:**
- Your environment ID (e.g., "claude", "cursor")
- Active wallet for this environment
- All wallets accessible to you

**Switch to a different wallet (in same environment):**
```bash
@LLM Wallet set active wallet to 0x1234567890abcdef...
```

**Share a wallet with another environment:**
```bash
@LLM Wallet share wallet 0x1234... with cursor
```

For detailed documentation, see [ENVIRONMENT_WALLETS.md](./ENVIRONMENT_WALLETS.md).

### Examples

**Day 1 (Claude):**
- Create wallet 0x1111...
- System remembers: Claude uses 0x1111...

**Day 3 (Claude again - 2 days later):**
- Wallet context restored automatically
- Claude still uses 0x1111... ✅

**Day 2 (Switch to Cursor):**
- Create wallet 0x2222... in Cursor
- Cursor remembers: I use 0x2222...
- Claude still uses 0x1111...

**Sharing wallets between environments:**
- In Claude: `wallet_share(0x1111, "cursor")`
- In Cursor: Can now use Claude's 0x1111 wallet too

## Complete Buyer-Side Flow Example

Here's a complete example of how to use the LLM Wallet MCP server from start to finish:

### Step 1: Create or Import a Wallet

**Option A: Create New Wallet**
```bash
# In Cursor chat:
create a new wallet with label "my-agent-wallet"
```

**Option B: Import Existing Wallet**
```bash
# In Cursor chat:
import wallet with private key 0x1234... and label "my-wallet"
```

**Expected Response:**
```json
{
  "success": true,
  "address": "0x742d35Cc6635C0532925a3b8D2A0a7e3E4b1b4e4",
  "label": "my-agent-wallet",
  "network": "polygon-amoy"
}
```

### Step 2: Check Wallet Balance

```bash
# In Cursor chat:
check the balance for my-agent-wallet
```

### Step 3: Set Spending Limits (Optional but Recommended)

```bash
# In Cursor chat:
@LLM Wallet set spending limits: max $0.10 per transaction and $5.00 daily limit
```

**Expected Response:**
```json
{
  "success": true,
  "limits": {
    "perTransaction": "0.10",
    "dailyLimit": "5.00",
    "dailySpent": "0.00"
  }
}
```

### Step 4: Register a Paid API as MCP Tool

```bash
# In Cursor chat:
Register the weather API at http://localhost:4021/weather as a paid MCP tool called "weather_api"
```

**Expected Response:**
```json
{
  "success": true,
  "toolName": "weather_api",
  "endpoint": "http://localhost:4021/weather",
  "requiresPayment": true,
  "maxAmount": "0.001"
}
```

### Step 5: Make a Paid API Call (Full x402 Flow)

```bash
# In Cursor chat:
Call the weather_api tool with location "London"
```

**What Happens Behind the Scenes:**
1. ✅ MCP server calls `http://localhost:4021/weather?location=London`
2. ✅ Server responds with `402 Payment Required` and payment requirements
3. ✅ MCP server automatically creates signed payment authorization
4. ✅ MCP server retries request with `X-Payment` header
5. ✅ Seller verifies payment with facilitator
6. ✅ Seller returns weather data
7. ✅ Payment is logged in wallet history

**Expected Response:**
```json
{
  "location": "London",
  "temperature": 15,
  "condition": "Cloudy",
  "humidity": 78,
  "payment": {
    "amount": "0.001",
    "status": "completed",
    "transactionId": "0xabc123..."
  }
}
```

### Step 6: Check Payment History

```bash
# In Cursor chat:
@LLM Wallet show payment history for my-agent-wallet
```

**Expected Response:**
```json
{
  "payments": [
    {
      "timestamp": "2025-01-14T15:30:45Z",
      "recipient": "0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00",
      "amount": "0.001",
      "status": "completed",
      "resource": "http://localhost:4021/weather",
      "transactionId": "0xabc123..."
    }
  ],
  "dailySpent": "0.001",
  "remainingDailyLimit": "4.999"
}
```

### Step 7: Check Updated Spending Limits

```bash
# In Cursor chat:
@LLM Wallet check current spending limits and daily usage
```

**Expected Response:**
```json
{
  "limits": {
    "perTransaction": "0.10",
    "dailyLimit": "5.00",
    "dailySpent": "0.001",
    "remainingDaily": "4.999"
  },
  "usage": {
    "today": "0.001",
    "thisWeek": "0.001",
    "totalTransactions": 1
  }
}
```

## Complete Tool Reference

### Wallet Management (7 tools)
- **`wallet_create`** - Create new HD wallet with encrypted storage
- **`wallet_import`** - Import existing wallet from private key
- **`wallet_balance`** - Check USDC and native token balance
- **`wallet_history`** - View payment and transaction history
- **`wallet_list`** - List all wallets accessible to current environment
- **`wallet_set_active`** - Switch active wallet for this environment
- **`wallet_share`** - Share a wallet with another LLM environment

### Spending Limits (2 tools)
- **`wallet_set_limit`** - Set per-transaction and daily spending caps
- **`wallet_get_limits`** - Get current limits and daily usage statistics

### x402 Buyer Tools (2 tools)
- **`x402_check_payment`** - Pre-check if wallet can afford payment (before making it)
- **`x402_pay`** - Make payment to x402-protected resource using x402-fetch

### x402 Seller Tools (5 tools)
- **`seller_verify_payment`** - Verify incoming payment from buyer
- **`seller_settle_payment`** - Settle verified payment on-chain
- **`seller_decode_payment`** - Decode payment header without calling facilitator
- **`seller_create_requirements`** - Generate payment requirements for protected resource
- **`seller_generate_402_response`** - Generate 402 Payment Required response

### Dynamic API Tools (4 tools)
- **`api_register`** - Register any paid API endpoint as an MCP tool
- **`api_list`** - List all registered API tools
- **`api_call`** - Execute a registered API tool with parameters
- **`api_unregister`** - Remove a registered API tool


## Supported Networks

### Testnets (Recommended for Development)
- **Polygon Amoy** - Chain ID: 80002

### Mainnets (Production Use)
- **Polygon** - Chain ID: 137

## Use Cases & Examples

### 1. AI Agent with Budget Control
```bash
# Set strict limits for AI agent
@LLM Wallet set spending limits: max $0.05 per transaction and $1.00 daily

# Agent can now safely call paid APIs without overspending
@LLM Wallet call weather_api with location "New York"
```

### 2. Development Team Shared Wallet
```bash
# Create team wallet
@LLM Wallet create wallet with label "team-dev-wallet"

# Set team spending limits
@LLM Wallet set spending limits: max $0.10 per transaction and $10.00 daily

# Register multiple APIs for team use
@LLM Wallet register OpenAI API as "openai_tool"
@LLM Wallet register Anthropic API as "anthropic_tool"
```

### 3. Production Agent with Monitoring
```bash
# Check daily usage
@LLM Wallet check current spending limits and daily usage

# View payment history for audit
@LLM Wallet show payment history for production-wallet

# Monitor spending patterns
@LLM Wallet check balance for production-wallet
```

### 4. Multi-Network Deployment
```bash
# Deploy on testnet first
NETWORK=polygon-amoy @LLM Wallet create wallet with label "test-wallet"

# Then deploy on mainnet
NETWORK=polygon @LLM Wallet create wallet with label "prod-wallet"
```

## Troubleshooting

### Common Issues

**"No tools available" in MCP client**
- Restart your MCP client completely (Cursor: Cmd+Q, then reopen)
- Verify `~/.cursor/mcp.json` is valid JSON
- Check the path to `dist/index.js` is correct and absolute
- ✅ Ensure the MCP server builds successfully: `npm run build`

**"Wallet not found" error**
- ✅ Create a wallet first: `@LLM Wallet create wallet with label "my-wallet"`
- ✅ Or import existing: `@LLM Wallet import wallet with private key 0x...`

**"Payment exceeds limit" error**
- ✅ Check current limits: `@LLM Wallet check current spending limits`
- ✅ Increase limits: `@LLM Wallet set spending limits: max $1.00 per transaction`

**"Insufficient balance" error**
- ✅ Check balance: `@LLM Wallet check balance for my-wallet`
- ✅ Get test USDC from faucet (for testnets)
- ✅ Ensure you're on the correct network

**"Verification failed" error**
- ✅ Verify facilitator URL is correct in environment variables
- ✅ Check network connectivity to facilitator
- ✅ Ensure wallet has sufficient USDC balance

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug node dist/index.js
```

### Health Check

Test if MCP server is responding:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node dist/index.js
```

## 🔒 Security Best Practices

### Wallet Security
- ✅ **Use strong encryption keys** (32+ characters, generated randomly)
- ✅ **Store encryption keys securely** (environment variables, not in code)
- ✅ **Use testnet for development** (Polygon Amoy, Base Sepolia)
- ✅ **Set appropriate spending limits** (per-transaction and daily caps)
- ✅ **Monitor payment history** regularly

### Production Deployment
- ✅ **Use HTTPS** for all communications
- ✅ **Implement rate limiting** to prevent abuse
- ✅ **Regular backups** of wallet data
- ✅ **Monitor logs** for suspicious activity
- ✅ **Use mainnet only** when ready for production

### Environment Security
```bash
# Generate secure encryption key
openssl rand -hex 32

# Use environment variables (never hardcode)
export WALLET_ENCRYPTION_KEY="your-secure-key"
export NETWORK="polygon-amoy"  # Use testnet for development
```

### Key Components

**Wallet Service**: Creates and manages HD wallets with AES-256-GCM encryption
**Storage Service**: Persists wallets, limits, and payment history
**X402 Service**: Handles x402 protocol interactions (buyer-side only)
**Tool Handlers**: MCP tool implementations with input validation

## 📚 Additional Resources

### Documentation
- **x402 Protocol**: [GitHub Repository](https://github.com/coinbase/x402)
- **Model Context Protocol**: [Official Documentation](https://modelcontextprotocol.io/)
- **Viem**: [Ethereum TypeScript Library](https://viem.sh/)

### Related Projects
- **x402**: TypeScript/JavaScript SDK for x402 protocol
- **x402-fetch**: Automatic 402 response handling
- **x402-express**: Express.js middleware for x402


## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---



