# Environment-Aware Wallet System

## Overview

The llm-wallet MCP server now supports **environment-aware wallet persistence**. This means each LLM environment (Claude, Cursor, ChatGPT, etc.) can remember which wallet it was using, even across sessions.

### The Problem It Solves

Previously, if you used llm-wallet in Claude on Day 1 and came back on Day 3, Claude would not remember which wallet it used, causing:
- Decryption failures: "Unsupported state or unable to authenticate data"
- Loss of wallet context between sessions
- Inability to switch between different LLM environments seamlessly

### The Solution

The system now automatically:
1. **Detects your environment** (Claude, Cursor, ChatGPT, VSCode, etc.)
2. **Remembers the active wallet** for that environment across sessions
3. **Allows wallet sharing** between environments
4. **Tracks environment-specific wallet access**

---

## How It Works

### Environment Detection

The system detects your environment in this order:

1. **Explicit MCP_ENVIRONMENT variable** - If you set `MCP_ENVIRONMENT=claude`, it uses that
2. **Environment-specific variables:**
   - Claude: `CLAUDE_USER` or `ANTHROPIC_HOME`
   - Cursor: `CURSOR_ENV` or `CURSOR_WORKSPACE_ROOT`
   - ChatGPT: `CHATGPT_MODE`
   - VSCode: `TERM_PROGRAM=vscode`
3. **Persistent ID** - Generates and stores a unique ID (e.g., `env-a1b2c3d4`) if not detected above

### Data Storage

When you use a wallet, the system stores:

**~/.llm-wallet/environment-profiles.json:**
```json
{
  "claude": {
    "activeWalletAddress": "0x1234567890abcdef...",
    "environmentId": "claude",
    "lastAccess": 1700000000000
  },
  "cursor": {
    "activeWalletAddress": "0xabcdefabcdefabcd...",
    "environmentId": "cursor",
    "lastAccess": 1700000001000
  }
}
```

**~/.llm-wallet/wallets.json:**
```json
[
  {
    "address": "0x1234567890abcdef...",
    "label": "claude-main",
    "encryptedPrivateKey": "...",
    "createdAt": 1700000000000,
    "accessibleBy": ["claude"],
    "owner": "claude"
  }
]
```

---

## New Tools

### 1. `wallet_list` - List all wallets and environment info

Lists available wallets and shows which environment you're in.

**Response:**
```json
{
  "environment": {
    "id": "claude",
    "activeWallet": {
      "address": "0x1234...",
      "label": "claude-main",
      "createdAt": "2024-11-20T10:00:00.000Z"
    }
  },
  "accessibleWallets": [
    {
      "address": "0x1234...",
      "label": "claude-main",
      "network": "polygon-amoy",
      "createdAt": "2024-11-20T10:00:00.000Z",
      "accessibleBy": ["claude"],
      "isActive": true
    }
  ]
}
```

### 2. `wallet_set_active` - Switch active wallet for this environment

Tells your current environment to use a specific wallet going forward.

**Parameters:**
- `walletAddress` (required): Address to set as active (0x...)
- `alias` (optional): Memorable name for this wallet

**Usage:**
```
"Switch to wallet 0x1234 for this environment"
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet 0x1234... set as active for environment \"claude\"",
  "activeWallet": {
    "address": "0x1234...",
    "alias": "my-trading-wallet",
    "environment": "claude"
  }
}
```

### 3. `wallet_share` - Share a wallet with another environment

Makes a wallet accessible to a different environment.

**Parameters:**
- `walletAddress` (required): Wallet to share
- `targetEnvironment` (required): Environment to share with (e.g., "cursor", "chatgpt")

**Usage:**
```
"Share wallet 0x1234 with cursor environment"
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet 0x1234... is now accessible to environment \"cursor\"",
  "sharedWallet": {
    "address": "0x1234...",
    "sharedWith": "cursor"
  }
}
```

---

## Usage Scenarios

### Scenario 1: Using llm-wallet consistently in the same environment

**Day 1 (Claude):**
```
You: Create a new wallet for me
Claude creates wallet 0x1111...
System stores: { "claude": { activeWalletAddress: "0x1111..." } }
```

**Day 3 (Claude again):**
```
You: Check my balance
Claude automatically uses wallet 0x1111... (remembered!)
✅ Works - no decryption errors
```

### Scenario 2: Switching environments

**Day 1 (Claude):**
```
You: Create wallet for claude
Claude creates and uses wallet 0x1111...
```

**Day 2 (Cursor):**
```
You: Create wallet for cursor
Cursor creates and uses wallet 0x2222...
```

**Day 2 Later (Cursor, switching to Claude's wallet):**
```
You: Use claude's wallet in cursor
You: wallet_share(0x1111, "cursor")
System adds "cursor" to wallet 0x1111's accessibleBy list
You: wallet_set_active(0x1111)
Cursor now uses 0x1111... ✅
```

### Scenario 3: Sharing a wallet between environments

```
Claude: Create wallet 0x1111
Claude: wallet_list
  → Shows wallet 0x1111 is only for "claude"

Claude: wallet_share(0x1111, "cursor")
System updates wallet: accessibleBy: ["claude", "cursor"]

Cursor: wallet_list
  → Now can see wallet 0x1111 in its list

Cursor: wallet_set_active(0x1111)
Cursor: wallet_balance
  → ✅ Both environments can use same wallet
```

---

## Data Structure Details

### Environment Profile
```typescript
interface EnvironmentProfile {
  activeWalletAddress: string;  // Currently active wallet for this env
  lastAccess: number;            // Timestamp of last access
  environmentId: string;         // env-id, "claude", "cursor", etc.
}
```

### Enhanced StoredWallet
```typescript
interface StoredWallet {
  address: string;
  encryptedPrivateKey: string;
  label: string;
  createdAt: number;
  network?: string;
  accessibleBy?: string[];  // NEW: list of envs that can access this
  owner?: string;           // NEW: which env created this wallet
}
```

---

## Implementation Details

### Services

#### `EnvironmentService`
- `getEnvironmentId()` - Detects or retrieves current environment
- `getEnvironmentProfile(envId)` - Gets saved profile for environment
- `setActiveWalletForEnvironment(envId, address)` - Saves active wallet for env
- `getActiveWalletAddressForEnvironment(envId, allWallets)` - Retrieves active wallet

#### `StorageService` (Enhanced)
- `setActiveWalletForEnvironment(address)` - Set active wallet for current env
- `shareWalletWithEnvironment(address, envId)` - Add env to wallet's access list
- `getWalletsForEnvironment()` - Get wallets accessible to current env
- `getEnvironmentInfo()` - Get complete env info (id, active wallet, accessible wallets)

### Key Changes to Existing Methods

#### `getActiveWallet()`
**Before:**
```typescript
// Always returned the most recently created wallet
return wallets[wallets.length - 1];
```

**After:**
```typescript
// Returns active wallet for current environment, with fallback to first wallet
const envId = await EnvironmentService.getEnvironmentId();
const activeAddress = await EnvironmentService.getActiveWalletAddressForEnvironment(
  envId,
  allAddresses
);
if (activeAddress) return wallet;
return wallets[0];  // Fallback
```

---

## Configuration

### Environment Variables

No new environment variables required! The system auto-detects your environment.

However, you can explicitly set:
```bash
# Force a specific environment ID
export MCP_ENVIRONMENT=my-custom-env

# Now the system will treat this as your environment
```

### File Locations

All data stored in `~/.llm-wallet/` or `STORAGE_DIR`:
- `wallets.json` - All wallets (now with `accessibleBy` and `owner`)
- `environment-profiles.json` - NEW: Environment → Active wallet mapping
- `.environment-id` - NEW: Persistent environment ID (if auto-generated)

---

## Migration

### Existing Wallets

If you already have wallets from before this update:
1. They'll continue to work exactly as before
2. `accessibleBy` and `owner` fields default to undefined (accessible to all)
3. When you first set a wallet as active, it gets the `accessibleBy` list
4. On first run in a new environment, an `environment-profiles.json` file is created

### Backward Compatibility

✅ Fully backward compatible:
- Old `StoredWallet` format still works
- Wallets without `accessibleBy` are accessible to any environment
- Old wallet files are automatically migrated on first save

---

## Security Considerations

1. **Encryption**: Private keys remain encrypted with `WALLET_ENCRYPTION_KEY` - unchanged
2. **Environment tracking**: Environment IDs are **not** sensitive (just names like "claude", "cursor")
3. **File permissions**: Environment profiles stored in same directory as other wallet data
4. **Access control**: Purely logical - enforced by the tools, not filesystem permissions

---

## Troubleshooting

### "Wallet not found" when setting active wallet
- Ensure wallet address exists: `wallet_list` to see all wallets
- Check address format (should be 0x...)
- Address matching is case-insensitive

### Different environment seeing different wallets
- Wallets must have the environment in their `accessibleBy` list
- Use `wallet_share()` to make a wallet accessible to another environment
- Check `wallet_list` to see which wallets are accessible

### Lost connection between sessions
- Check `~/.llm-wallet/environment-profiles.json` exists
- Verify `STORAGE_DIR` environment variable if custom (if not set, defaults to ~/.llm-wallet)
- Try re-running `wallet_list` - should show environment ID and active wallet

---

## Future Enhancements

Potential improvements:
- [ ] Environment-specific spending limits
- [ ] Wallet access audit logs
- [ ] Environment sync/backup
- [ ] Wallet transfer between environments
- [ ] Environment groups (e.g., "production" vs "testing")

