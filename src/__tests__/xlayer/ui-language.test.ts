import fs from 'fs';
import path from 'path';

const CARD = [
  path.join(process.cwd(), 'components/xlayer/onchain-commitment-card.tsx'),
  path.join(process.cwd(), 'src/components/xlayer/onchain-commitment-card.tsx'),
].find((file) => fs.existsSync(file));

if (!CARD) {
  throw new Error('Could not find onchain-commitment-card.tsx');
}

describe('xlayer commitment card language', () => {
  const source = fs.readFileSync(CARD, 'utf8');

  it('uses commercial commitment language', () => {
    expect(source).toContain('Create commercial commitment');
    expect(source).toContain('Create on-chain commitment');
    expect(source).toContain('Waiting for wallet approval');
    expect(source).toContain('Submitting to X Layer');
    expect(source).toContain('Verifying commitment');
    expect(source).toContain('Commitment verified on X Layer');
    expect(source).toContain('XLAYER_COMMITMENT_DISCLAIMER');
    expect(fs.readFileSync(path.join(path.dirname(CARD), '../../lib/xlayer/chain.ts'), 'utf8')).toContain(
      'It is not a payment and does not indicate supplier acceptance.'
    );
  });

  it('does not claim payment sent or supplier acceptance', () => {
    expect(source).not.toMatch(/payment sent/i);
    expect(source).not.toMatch(/supplier accepted/i);
    expect(source).not.toContain('Mint NFT');
    expect(source).not.toContain('Earn yield');
  });

  it('does not show verified until server verification succeeds', () => {
    expect(source).toContain("commitment?.verificationStatus === 'verified'");
    expect(source).toContain('View on explorer');
    expect(source).toContain('commitment.explorerUrl');
  });
});
