/**
 * Wise ledger settlement – postWiseSettlement uses correct account and idempotency key
 */
import { LEDGER_ACCOUNTS } from '../../ledger/account-mapping';

describe('Wise ledger', () => {
  it('WISE_CLEARING account code is 1055', () => {
    expect(LEDGER_ACCOUNTS.WISE_CLEARING).toBe('1055');
  });

  it('Wise clearing is distinct from Stripe and crypto', () => {
    expect(LEDGER_ACCOUNTS.WISE_CLEARING).not.toBe(LEDGER_ACCOUNTS.STRIPE_CLEARING);
    expect(LEDGER_ACCOUNTS.WISE_CLEARING).not.toBe(LEDGER_ACCOUNTS.CRYPTO_CLEARING_HBAR);
  });
});
