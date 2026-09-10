import { signCregisPayload, verifyCregisSignature } from '@/lib/payouts/rails/cregis-signature';

const DOCUMENTED_API_KEY = 'f502a9ac9ca54327986f29c03b271491';

const documentedParams = {
  pid: 1382528827416576,
  currency: '195@195',
  address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
  amount: '1.1',
  remark: 'payout',
  third_party_id: 'c9231e604da54469a735af3f449c880f',
  callback_url: 'http://192.168.2.29:9099/callback',
  nonce: 'hwlkk6',
  timestamp: 1688004243314,
};

describe('Cregis signature algorithm', () => {
  it('matches the documented request-example sign', () => {
    expect(signCregisPayload(documentedParams, DOCUMENTED_API_KEY)).toBe(
      'd6eef2de79e39f434a38efb910213ba6'
    );
  });

  it('drops sign and empty values before hashing', () => {
    const withEmpties = {
      ...documentedParams,
      sign: 'should-be-ignored',
      memo: '',
      unused: null,
    };
    expect(signCregisPayload(withEmpties, DOCUMENTED_API_KEY)).toBe(
      signCregisPayload(documentedParams, DOCUMENTED_API_KEY)
    );
  });

  it('verifies a matching sign and rejects a tampered one', () => {
    const sign = signCregisPayload(documentedParams, DOCUMENTED_API_KEY);
    expect(verifyCregisSignature({ ...documentedParams, sign }, DOCUMENTED_API_KEY)).toBe(true);
    expect(
      verifyCregisSignature({ ...documentedParams, sign, amount: '9.9' }, DOCUMENTED_API_KEY)
    ).toBe(false);
    expect(verifyCregisSignature({ ...documentedParams, sign: '00' }, DOCUMENTED_API_KEY)).toBe(
      false
    );
  });
});
