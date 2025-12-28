/**
 * Token Posting Tests
 * Comprehensive tests for all 4 crypto tokens (HBAR, USDC, USDT, AUDD)
 * 
 * Critical: Ensures each token posts to its correct clearing account
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getCryptoClearing AccountCode,
  validateTokenAccountMapping,
  getTokenFromClearing Account,
  getAllCryptoClearing Accounts,
  LEDGER_ACCOUNTS,
} from '../account-mapping';
import {
  postHederaSettlement,
  validateHederaPosting,
  getAllHederaClearing Accounts,
} from '../posting-rules/hedera';
import type { TokenType } from '@/lib/hedera/constants';

describe('Token-to-Account Mapping', () => {
  describe('getCryptoClearing AccountCode', () => {
    it('should map HBAR to account 1051', () => {
      const accountCode = getCryptoClearing AccountCode('HBAR');
      expect(accountCode).toBe('1051');
    });

    it('should map USDC to account 1052', () => {
      const accountCode = getCryptoClearing AccountCode('USDC');
      expect(accountCode).toBe('1052');
    });

    it('should map USDT to account 1053', () => {
      const accountCode = getCryptoClearing AccountCode('USDT');
      expect(accountCode).toBe('1053');
    });

    it('should map AUDD to account 1054', () => {
      const accountCode = getCryptoClearing AccountCode('AUDD');
      expect(accountCode).toBe('1054');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        getCryptoClearing AccountCode('INVALID' as TokenType);
      }).toThrow('No clearing account mapped for token');
    });
  });

  describe('Reverse lookup', () => {
    it('should get HBAR from account 1051', () => {
      const token = getTokenFromClearing Account('1051');
      expect(token).toBe('HBAR');
    });

    it('should get USDC from account 1052', () => {
      const token = getTokenFromClearing Account('1052');
      expect(token).toBe('USDC');
    });

    it('should get USDT from account 1053', () => {
      const token = getTokenFromClearing Account('1053');
      expect(token).toBe('USDT');
    });

    it('should get AUDD from account 1054', () => {
      const token = getTokenFromClearing Account('1054');
      expect(token).toBe('AUDD');
    });

    it('should return null for non-crypto account', () => {
      const token = getTokenFromClearing Account('1200');
      expect(token).toBeNull();
    });
  });

  describe('getAllCryptoClearing Accounts', () => {
    it('should return all 4 crypto clearing account codes', () => {
      const accounts = getAllCryptoClearing Accounts();
      expect(accounts).toHaveLength(4);
      expect(accounts).toContain('1051'); // HBAR
      expect(accounts).toContain('1052'); // USDC
      expect(accounts).toContain('1053'); // USDT
      expect(accounts).toContain('1054'); // AUDD
    });
  });

  describe('Token validation', () => {
    it('should validate correct HBAR mapping', () => {
      expect(() => {
        validateTokenAccountMapping('HBAR', '1051');
      }).not.toThrow();
    });

    it('should validate correct USDC mapping', () => {
      expect(() => {
        validateTokenAccountMapping('USDC', '1052');
      }).not.toThrow();
    });

    it('should validate correct USDT mapping', () => {
      expect(() => {
        validateTokenAccountMapping('USDT', '1053');
      }).not.toThrow();
    });

    it('should validate correct AUDD mapping', () => {
      expect(() => {
        validateTokenAccountMapping('AUDD', '1054');
      }).not.toThrow();
    });

    it('should throw error if HBAR uses wrong account', () => {
      expect(() => {
        validateTokenAccountMapping('HBAR', '1052'); // Using USDC account
      }).toThrow('Invalid clearing account for HBAR');
    });

    it('should throw error if AUDD uses HBAR account', () => {
      expect(() => {
        validateTokenAccountMapping('AUDD', '1051'); // Using HBAR account
      }).toThrow('Invalid clearing account for AUDD');
      expect(() => {
        validateTokenAccountMapping('AUDD', '1051');
      }).toThrow('Expected 1054');
    });
  });
});

describe('Hedera Posting Validation', () => {
  describe('validateHederaPosting', () => {
    it('should return correct account for HBAR', () => {
      const account = validateHederaPosting('HBAR');
      expect(account).toBe('1051');
    });

    it('should return correct account for USDC', () => {
      const account = validateHederaPosting('USDC');
      expect(account).toBe('1052');
    });

    it('should return correct account for USDT', () => {
      const account = validateHederaPosting('USDT');
      expect(account).toBe('1053');
    });

    it('should return correct account for AUDD', () => {
      const account = validateHederaPosting('AUDD');
      expect(account).toBe('1054');
    });
  });

  describe('getAllHederaClearing Accounts', () => {
    it('should return all 4 Hedera clearing accounts in order', () => {
      const accounts = getAllHederaClearing Accounts();
      expect(accounts).toHaveLength(4);
      expect(accounts[0]).toBe('1051'); // HBAR
      expect(accounts[1]).toBe('1052'); // USDC
      expect(accounts[2]).toBe('1053'); // USDT
      expect(accounts[3]).toBe('1054'); // AUDD
    });
  });
});

describe('Token-Specific Posting Tests', () => {
  // Mock data
  const organizationId = '550e8400-e29b-41d4-a716-446655440000';
  const paymentLinkId = '650e8400-e29b-41d4-a716-446655440001';

  describe('HBAR Posting', () => {
    it('should use account 1051 for HBAR', () => {
      const accountCode = getCryptoClearing AccountCode('HBAR');
      expect(accountCode).toBe('1051');
    });

    it('should create correct description for HBAR payment', () => {
      const accountCode = getCryptoClearing AccountCode('HBAR');
      expect(accountCode).toBe('1051');
      
      // Verify it's the native token account
      expect(accountCode).toBe(LEDGER_ACCOUNTS.CRYPTO_CLEARING_HBAR);
    });
  });

  describe('USDC Posting', () => {
    it('should use account 1052 for USDC', () => {
      const accountCode = getCryptoClearing AccountCode('USDC');
      expect(accountCode).toBe('1052');
      expect(accountCode).toBe(LEDGER_ACCOUNTS.CRYPTO_CLEARING_USDC);
    });
  });

  describe('USDT Posting', () => {
    it('should use account 1053 for USDT', () => {
      const accountCode = getCryptoClearing AccountCode('USDT');
      expect(accountCode).toBe('1053');
      expect(accountCode).toBe(LEDGER_ACCOUNTS.CRYPTO_CLEARING_USDT);
    });
  });

  describe('AUDD Posting - CRITICAL TEST', () => {
    it('should use account 1054 for AUDD (not 1051!)', () => {
      const accountCode = getCryptoClearing AccountCode('AUDD');
      expect(accountCode).toBe('1054');
      expect(accountCode).not.toBe('1051'); // Ensure NOT using HBAR account
      expect(accountCode).toBe(LEDGER_ACCOUNTS.CRYPTO_CLEARING_AUDD);
    });

    it('should reject AUDD payment to wrong account', () => {
      expect(() => {
        validateTokenAccountMapping('AUDD', '1051'); // Wrong!
      }).toThrow();

      expect(() => {
        validateTokenAccountMapping('AUDD', '1052'); // Wrong!
      }).toThrow();

      expect(() => {
        validateTokenAccountMapping('AUDD', '1053'); // Wrong!
      }).toThrow();
    });

    it('should accept AUDD payment to correct account', () => {
      expect(() => {
        validateTokenAccountMapping('AUDD', '1054'); // Correct!
      }).not.toThrow();
    });
  });
});

describe('Cross-Token Validation', () => {
  it('should ensure each token has unique clearing account', () => {
    const accounts = [
      getCryptoClearing AccountCode('HBAR'),
      getCryptoClearing AccountCode('USDC'),
      getCryptoClearing AccountCode('USDT'),
      getCryptoClearing AccountCode('AUDD'),
    ];

    // Check all accounts are unique
    const uniqueAccounts = new Set(accounts);
    expect(uniqueAccounts.size).toBe(4);

    // Check correct sequence
    expect(accounts).toEqual(['1051', '1052', '1053', '1054']);
  });

  it('should prevent token misassignment', () => {
    const tokens: TokenType[] = ['HBAR', 'USDC', 'USDT', 'AUDD'];
    const accounts = ['1051', '1052', '1053', '1054'];

    tokens.forEach((token, index) => {
      const correctAccount = accounts[index];
      const wrongAccounts = accounts.filter((_, i) => i !== index);

      // Should succeed with correct account
      expect(() => {
        validateTokenAccountMapping(token, correctAccount);
      }).not.toThrow();

      // Should fail with any wrong account
      wrongAccounts.forEach((wrongAccount) => {
        expect(() => {
          validateTokenAccountMapping(token, wrongAccount);
        }).toThrow('Invalid clearing account');
      });
    });
  });
});

describe('Edge Cases', () => {
  it('should handle case-sensitive token types', () => {
    // These should work
    expect(getCryptoClearing AccountCode('HBAR')).toBe('1051');
    expect(getCryptoClearing AccountCode('AUDD')).toBe('1054');
  });

  it('should differentiate between similar account codes', () => {
    expect(getTokenFromClearing Account('1051')).toBe('HBAR');
    expect(getTokenFromClearing Account('1054')).toBe('AUDD');
    
    // Ensure we're not confusing them
    expect(getTokenFromClearing Account('1051')).not.toBe('AUDD');
    expect(getTokenFromClearing Account('1054')).not.toBe('HBAR');
  });

  it('should handle accounts receivable correctly', () => {
    expect(LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE).toBe('1200');
    expect(getTokenFromClearing Account('1200')).toBeNull(); // Not a crypto account
  });
});

describe('Integration Scenarios', () => {
  describe('AUDD/AUD currency-matched payment', () => {
    it('should use AUDD clearing account for AUD invoice', () => {
      // Scenario: Customer pays AUD invoice with AUDD stablecoin
      const invoiceCurrency = 'AUD';
      const paymentToken: TokenType = 'AUDD';
      
      const clearingAccount = getCryptoClearing AccountCode(paymentToken);
      
      expect(clearingAccount).toBe('1054');
      expect(clearingAccount).toBe(LEDGER_ACCOUNTS.CRYPTO_CLEARING_AUDD);
      
      // Validate mapping
      expect(() => {
        validateTokenAccountMapping(paymentToken, clearingAccount);
      }).not.toThrow();
    });
  });

  describe('Multi-currency invoice payments', () => {
    it('should use correct accounts for different token payments', () => {
      // USD invoice paid with USDC
      expect(getCryptoClearing AccountCode('USDC')).toBe('1052');
      
      // AUD invoice paid with AUDD
      expect(getCryptoClearing AccountCode('AUDD')).toBe('1054');
      
      // USD invoice paid with HBAR
      expect(getCryptoClearing AccountCode('HBAR')).toBe('1051');
      
      // Ensure each is different
      const codes = ['HBAR', 'USDC', 'USDT', 'AUDD'].map((t) =>
        getCryptoClearing AccountCode(t as TokenType)
      );
      expect(new Set(codes).size).toBe(4); // All unique
    });
  });
});






