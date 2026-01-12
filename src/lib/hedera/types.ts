/**
 * Hedera Wallet and Token Types
 */

import type { TokenType } from './constants';

// Re-export TokenType for external use
export type { TokenType };

// Wallet Connection State
export interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  balances: TokenBalances;
  network: string;
  isLoading: boolean;
  error: string | null;
}

// Token Balances
export interface TokenBalances {
  HBAR: string;
  USDC: string;
  USDT: string;
  AUDD: string;
}

// Token Association Status
export interface TokenAssociation {
  tokenId: string;
  symbol: TokenType;
  isAssociated: boolean;
  balance: string;
}

// Payment Amount Calculation Result
export interface TokenPaymentAmount {
  tokenType: TokenType;
  requiredAmount: string; // Formatted with proper decimals
  requiredAmountRaw: number; // Raw number
  fiatAmount: string;
  fiatCurrency: string;
  rate: string;
  estimatedFee: string;
  totalAmount: string; // Required + Fee
  isRecommended: boolean;
  recommendationReason?: string;
}

// Transaction Monitoring Result
export interface TransactionResult {
  success: boolean;
  transactionId: string;
  tokenType: TokenType;
  amount: string;
  timestamp: string;
  sender: string;
  merchantAccount?: string;
  memo?: string;
  isValid: boolean;
  validationError?: string;
}

// Payment Validation Result
export interface PaymentValidation {
  isValid: boolean;
  requiredAmount: number;
  receivedAmount: number;
  difference: number;
  differencePercent: number;
  tolerance: number;
  isUnderpayment: boolean;
  isOverpayment: boolean;
  tokenType: TokenType;
  message?: string;
}

// Transaction Query Options
export interface TransactionQueryOptions {
  accountId: string;
  tokenType: TokenType;
  tokenId?: string;
  startTime?: Date;
  limit?: number;
}

// Mirror Node Transaction Response
export interface MirrorTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  charged_tx_fee: number;
  memo_base64: string;
  result: string;
  name: string;
  transfers: Array<{
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
  token_transfers?: Array<{
    token_id: string;
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
}

// Mirror Node Account Balance Response
export interface MirrorAccountBalance {
  account: string;
  balance: {
    balance: number;
    timestamp: string;
  };
  tokens: Array<{
    token_id: string;
    balance: number;
  }>;
}

// HashConnect Pairing Data
export interface HashConnectPairingData {
  topic: string;
  accountIds: string[];
  network: string;
  metadata?: {
    name: string;
    description: string;
    icon: string;
    url: string;
  };
}

// Token Recommendation Factors
export interface TokenRecommendation {
  tokenType: TokenType;
  score: number;
  factors: {
    hasBalance: boolean;
    isStable: boolean;
    lowestFee: boolean;
    bestRate: boolean;
  };
  reason: string;
}

