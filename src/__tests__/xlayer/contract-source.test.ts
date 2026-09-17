import fs from 'fs';
import path from 'path';

const CONTRACT = [
  path.join(process.cwd(), '../contracts/src/CommitmentRegistry.sol'),
  path.join(process.cwd(), 'contracts/src/CommitmentRegistry.sol'),
  path.join(process.cwd(), '../../contracts/src/CommitmentRegistry.sol'),
].find((file) => fs.existsSync(file));

if (!CONTRACT) {
  throw new Error('Could not find CommitmentRegistry.sol');
}

describe('CommitmentRegistry source', () => {
  const source = fs.readFileSync(CONTRACT, 'utf8');

  it('registers, gets, and updates commitment state without custody', () => {
    expect(source).toContain('function registerCommitment');
    expect(source).toContain('function getCommitment');
    expect(source).toContain('function updateCommitmentStatus');
    expect(source).toContain('event CommitmentRegistered');
    expect(source).toContain('event CommitmentUpdated');
    expect(source).toContain('event CommitmentFulfilled');
    expect(source).toContain('CommitmentAlreadyRegistered');
    expect(source).toContain('NotCreator');
    expect(source).not.toContain('transfer(');
    expect(source).not.toContain('ERC20');
    expect(source).not.toContain('ERC721');
    expect(source).not.toContain('proxy');
    expect(source).not.toContain('upgradeTo');
  });
});
