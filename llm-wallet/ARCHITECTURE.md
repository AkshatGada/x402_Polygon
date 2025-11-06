# Environment-Aware Wallet System - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Environments                          │
├─────────────────────────────────────────────────────────────┤
│  Claude           │  Cursor          │  ChatGPT             │
│                   │                  │                      │
│  env-id: "claude" │ env-id: "cursor" │ env-id: "chatgpt"    │
└─────────────────────────────────────────────────────────────┘
           ↓                 ↓                 ↓
┌─────────────────────────────────────────────────────────────┐
│              EnvironmentService                             │
│  • Detect environment (auto or explicit)                    │
│  • Manage environment profiles                              │
│  • Track active wallet per environment                      │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│              StorageService                                 │
│  • Get active wallet (environment-aware)                    │
│  • Share wallets between environments                       │
│  • Filter wallets by environment access                     │
│  • Get environment info                                     │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│              Wallet Tools (MCP Interface)                   │
│  • wallet_list          - Show environment & accessible     │
│  • wallet_set_active    - Switch active wallet             │
│  • wallet_share         - Grant env access                 │
│  + 4 existing tools (create, import, balance, history)     │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│              Persistent Storage                             │
│  ~/.llm-wallet/                                             │
│  ├── wallets.json (wallets + accessibleBy, owner)          │
│  ├── environment-profiles.json (env → active wallet)       │
│  ├── .environment-id (persistent env ID)                   │
│  ├── limits.json                                            │
│  ├── history.json                                           │
│  └── api-configs.json                                       │
└─────────────────────────────────────────────────────────────┘
```

## Environment Detection Flow

```
┌─ MCP Server Starts ─┐
        ↓
┌─────────────────────────────────────────────────────────────┐
│  EnvironmentService.getEnvironmentId()                      │
│                                                             │
│  1. Check MCP_ENVIRONMENT env var                          │
│     └─→ Found? Return "explicit-env-id"                    │
│                                                             │
│  2. Check environment-specific variables                    │
│     CLAUDE_USER → "claude"                                 │
│     CURSOR_ENV → "cursor"                                  │
│     CHATGPT_MODE → "chatgpt"                               │
│     TERM_PROGRAM=vscode → "vscode"                         │
│     └─→ Found? Return "detected-env-id"                    │
│                                                             │
│  3. Try reading ~/.llm-wallet/.environment-id              │
│     └─→ Found? Return "persisted-env-id"                   │
│                                                             │
│  4. Generate new persistent ID                             │
│     └─→ Create ~/.llm-wallet/.environment-id               │
│         Return "env-<random-8-chars>"                      │
└─────────────────────────────────────────────────────────────┘
        ↓
  Environment ID: "claude"
```

## Wallet Selection Flow

```
Any Tool Calls wallet_balance(), x402_pay(), etc.
        ↓
┌─ StorageService.getActiveWallet() ─┐
        ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Get Current Environment                           │
│  └─→ EnvironmentService.getEnvironmentId()                 │
│      Returns: "claude"                                      │
│                                                             │
│  Step 2: Get Environment Profile                           │
│  └─→ EnvironmentService.getEnvironmentProfile("claude")    │
│      Returns: { activeWalletAddress: "0x1234...", ... }    │
│                                                             │
│  Step 3: Verify Wallet Exists                              │
│  └─→ If activeWalletAddress in allWallets                  │
│      ✓ Use it                                              │
│      ✗ Fall back to first wallet                           │
│                                                             │
│  Step 4: Return Wallet                                     │
│  └─→ StorageService.getWallet(activeAddress)              │
└─────────────────────────────────────────────────────────────┘
        ↓
   wallet object ready for decryption & signing
```

## Data Structure

### environment-profiles.json
```json
{
  "claude": {
    "activeWalletAddress": "0x742d35cc6635c0532925a3b8d2a0a7e3e4b1b4e4",
    "environmentId": "claude",
    "lastAccess": 1700000000000
  },
  "cursor": {
    "activeWalletAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "environmentId": "cursor",
    "lastAccess": 1700000001000
  }
}
```

### wallets.json (Enhanced)
```json
[
  {
    "address": "0x742d35cc6635c0532925a3b8d2a0a7e3e4b1b4e4",
    "label": "claude-main",
    "encryptedPrivateKey": "{\"iv\":\"...\",\"encrypted\":\"...\",\"authTag\":\"...\"}",
    "createdAt": 1700000000000,
    "network": "polygon-amoy",
    "accessibleBy": ["claude"],
    "owner": "claude"
  },
  {
    "address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "label": "shared-wallet",
    "encryptedPrivateKey": "{\"iv\":\"...\",\"encrypted\":\"...\",\"authTag\":\"...\"}",
    "createdAt": 1700000001000,
    "network": "polygon-amoy",
    "accessibleBy": ["claude", "cursor"],
    "owner": "claude"
  }
]
```

## Wallet Access Control Matrix

```
┌─────────────────────────────────────────────────────────┐
│ Wallet      │ Owner  │ accessibleBy │ Accessible To     │
├─────────────────────────────────────────────────────────┤
│ 0x1234...   │ claude │ ["claude"]   │ Claude only       │
│ 0x5678...   │ cursor │ ["cursor"]   │ Cursor only       │
│ 0xabcd...   │ claude │ ["claude",   │ Claude + Cursor   │
│             │        │  "cursor"]   │                   │
│ 0xef01...   │ claude │ (undefined)  │ All environments  │
│             │        │              │ (backward compat) │
└─────────────────────────────────────────────────────────┘
```

## State Transitions

### Creating a Wallet
```
User Command: wallet_create("my-wallet")
        ↓
WalletService.createWallet()
        ↓
StorageService.saveWallet()
        ├─→ Append to wallets.json
        ├─→ Set accessibleBy: [current_env]
        ├─→ Set owner: current_env
        ↓
EnvironmentService.setActiveWalletForEnvironment()
        ├─→ Update environment-profiles.json
        ├─→ Set activeWalletAddress
        ├─→ Set lastAccess timestamp
        ↓
✅ Wallet created and set as active for this environment
```

### Switching Wallets
```
User Command: wallet_set_active("0x5678...")
        ↓
StorageService.setActiveWalletForEnvironment("0x5678...")
        ↓
EnvironmentService.setActiveWalletForEnvironment(env_id, "0x5678...")
        ├─→ Read current environment-profiles.json
        ├─→ Update environment's activeWalletAddress
        ├─→ Update lastAccess timestamp
        ├─→ Write back to environment-profiles.json
        ↓
✅ Active wallet switched for this environment
```

### Sharing a Wallet
```
User Command: wallet_share("0x1234...", "cursor")
        ↓
StorageService.shareWalletWithEnvironment("0x1234...", "cursor")
        ├─→ Read wallets.json
        ├─→ Find wallet 0x1234...
        ├─→ Add "cursor" to accessibleBy array
        │  (if not already there)
        ├─→ Write updated wallets.json
        ↓
✅ Wallet 0x1234... now accessible to cursor environment

Next Time Cursor Calls wallet_list():
        ├─→ Filter wallets by accessibleBy
        ├─→ Show wallet 0x1234... in accessible list
        ↓
Cursor can now wallet_set_active("0x1234...")
```

## Tool Usage Flow

### wallet_list
```
User: "list all wallets"
        ↓
StorageService.getEnvironmentInfo()
        ├─→ Get current environment: "claude"
        ├─→ Get environment profile: { activeWalletAddress: "0x1234..." }
        ├─→ Get accessible wallets: [0x1234..., 0xabcd...]
        ├─→ Return environment info + wallet list
        ↓
User sees:
{
  "environment": {
    "id": "claude",
    "activeWallet": { "address": "0x1234...", ... }
  },
  "accessibleWallets": [
    { "address": "0x1234...", "isActive": true },
    { "address": "0xabcd...", "isActive": false }
  ]
}
```

### wallet_set_active
```
User: "use wallet 0xabcd..."
        ↓
StorageService.setActiveWalletForEnvironment("0xabcd...")
        ├─→ Verify wallet exists
        ├─→ Call EnvironmentService.setActiveWalletForEnvironment()
        ├─→ Update environment-profiles.json
        ↓
User sees:
{
  "success": true,
  "message": "Wallet 0xabcd... set as active for environment 'claude'",
  "activeWallet": { "address": "0xabcd...", ... }
}
```

### wallet_share
```
User: "share wallet 0x1234 with cursor"
        ↓
StorageService.shareWalletWithEnvironment("0x1234...", "cursor")
        ├─→ Verify wallet exists
        ├─→ Add "cursor" to wallet.accessibleBy
        ├─→ Write wallets.json
        ↓
User sees:
{
  "success": true,
  "message": "Wallet 0x1234... now accessible to cursor",
  "sharedWallet": { "address": "0x1234...", "sharedWith": "cursor" }
}
```

## Error Handling

```
┌─────────────────────────────────────────────────────────┐
│              Error Scenarios                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. Wallet Not Found                                    │
│    └─→ wallet_set_active("0xbadaddr...")              │
│    └─→ Verify fails                                   │
│    └─→ Return error: "Wallet not found"               │
│                                                         │
│ 2. No Active Wallet                                   │
│    └─→ wallet_list() when no wallet created           │
│    └─→ activeWallet: null                             │
│    └─→ accessibleWallets: []                          │
│                                                         │
│ 3. Wallet Not Accessible                              │
│    └─→ wallet_set_active() with wallet from other env │
│    └─→ Verify fails                                   │
│    └─→ Return error: "Wallet not accessible"          │
│                                                         │
│ 4. Missing Files                                      │
│    └─→ environment-profiles.json deleted              │
│    └─→ Auto-recreate on first save                    │
│    └─→ Fallback to first wallet                       │
│                                                         │
│ 5. Corrupted environment-profiles.json                │
│    └─→ JSON.parse() fails                             │
│    └─→ Return empty profiles {}                       │
│    └─→ Fallback to first wallet                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Performance Characteristics

### Time Complexity
- `getActiveWallet()`: O(n) where n = number of wallets (array filter)
- `getEnvironmentProfile()`: O(1) (object lookup by key)
- `setActiveWalletForEnvironment()`: O(1) (object update)
- `shareWalletWithEnvironment()`: O(n) (array operations)

### Space Complexity
- `environment-profiles.json`: O(m) where m = number of environments
- `wallets.json`: O(n) where n = number of wallets
- Memory: Negligible (all stored on disk, minimal caching)

### I/O Complexity
Each operation involves:
- 1-2 file reads (`fs.readFile()`)
- 1 file write (`fs.writeFile()`) for mutations
- All operations are async/non-blocking

## Security Considerations

```
┌─────────────────────────────────────────────────────────┐
│              Security Model                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ Private Keys                                         │
│    └─→ Still encrypted with WALLET_ENCRYPTION_KEY      │
│    └─→ No changes to encryption logic                  │
│    └─→ Environment IDs NOT used for encryption         │
│                                                         │
│ ✅ Environment Detection                               │
│    └─→ Environment names not sensitive                 │
│    └─→ "claude", "cursor" are just identifiers         │
│    └─→ No credentials stored                           │
│                                                         │
│ ✅ Wallet Access Control                               │
│    └─→ Enforced by application logic                   │
│    └─→ Only accessibleBy environments can use wallet    │
│    └─→ No filesystem-level protection needed           │
│                                                         │
│ ⚠️  File Permissions                                    │
│    └─→ All files in ~/.llm-wallet/ have standard perms │
│    └─→ Consider CHMOD if running on multi-user system  │
│    └─→ MCP server runs as single user (typical)        │
│                                                         │
│ ✅ No New Attack Surfaces                               │
│    └─→ Environment detection heuristics don't expose   │
│        sensitive data                                   │
│    └─→ Profile files contain only non-sensitive data   │
│    └─→ Same threat model as before                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Backward Compatibility

```
Old Wallet (created before this feature):
{
  "address": "0x1234...",
  "label": "my-wallet",
  "encryptedPrivateKey": "...",
  "createdAt": 1700000000000,
  "network": "polygon-amoy"
  // NO accessibleBy or owner fields
}

Behavior:
1. First access: Accessible to all environments
2. After wallet_share(): accessibleBy field added
3. After wallet_create(): owner field added on save
4. Full backward compatibility maintained ✅
```

---

This architecture ensures:
- ✅ Session persistence across restarts
- ✅ Multi-environment isolation
- ✅ Wallet sharing capabilities
- ✅ Backward compatibility
- ✅ Zero new security vulnerabilities
- ✅ Simple, predictable behavior

