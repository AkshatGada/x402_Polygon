export interface StoredWallet {
  address: string;
  encryptedPrivateKey: string;
  label: string;
  createdAt: number;
  network?: string;
}

export interface WalletConfig {
  address: string;
  label: string;
  network: string;
}

export interface EncryptedData {
  iv: string;
  encrypted: string;
  authTag: string;
}

