-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  encrypted_private_key TEXT NOT NULL,
  label TEXT NOT NULL,
  network TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Spending limits table
CREATE TABLE IF NOT EXISTS spending_limits (
  wallet_address TEXT PRIMARY KEY,
  max_transaction_amount TEXT,
  daily_limit TEXT,
  daily_spent TEXT NOT NULL DEFAULT '0',
  last_reset_timestamp INTEGER NOT NULL,
  require_approval INTEGER NOT NULL DEFAULT 0,
  approval_threshold TEXT NOT NULL DEFAULT '0',
  FOREIGN KEY (wallet_address) REFERENCES wallets(address) ON DELETE CASCADE
);

-- Payment history table
CREATE TABLE IF NOT EXISTS payment_history (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  payment_header TEXT NOT NULL,
  verified INTEGER NOT NULL,
  settled INTEGER NOT NULL,
  transaction_hash TEXT,
  amount TEXT NOT NULL,
  network TEXT NOT NULL,
  resource TEXT,
  FOREIGN KEY (wallet_address) REFERENCES wallets(address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_timestamp ON payment_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_payment_wallet ON payment_history(wallet_address);

-- API registry table (public discovery)
CREATE TABLE IF NOT EXISTS api_registry (
  name TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  description TEXT,
  method TEXT DEFAULT 'GET',
  price TEXT NOT NULL,
  network TEXT DEFAULT 'polygon-amoy',
  scheme TEXT DEFAULT 'exact',
  pay_to TEXT NOT NULL,
  headers TEXT,
  input_schema TEXT,
  registered_at INTEGER NOT NULL,
  last_called_at INTEGER,
  call_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_registry_network ON api_registry(network);
CREATE INDEX IF NOT EXISTS idx_registry_name ON api_registry(name);

