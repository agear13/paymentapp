import { getAddress, isAddress } from 'viem';
import { XLAYER_TESTNET_CHAIN_ID } from '@/lib/xlayer/chain';

export const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export function parseSubmitInput(input: {
  transactionHash: string;
  walletAddress: string;
  chainId: number;
}): { transactionHash: string; walletAddress: string; chainId: number } {
  if (input.chainId !== XLAYER_TESTNET_CHAIN_ID) {
    throw Object.assign(new Error('Unsupported chain'), { code: 'WRONG_CHAIN', status: 400 });
  }
  if (!TX_HASH_RE.test(input.transactionHash)) {
    throw Object.assign(new Error('Invalid transaction hash'), { code: 'INVALID_HASH', status: 400 });
  }
  if (!isAddress(input.walletAddress)) {
    throw Object.assign(new Error('Invalid wallet address'), { code: 'INVALID_WALLET', status: 400 });
  }
  return {
    transactionHash: input.transactionHash.toLowerCase(),
    walletAddress: getAddress(input.walletAddress),
    chainId: input.chainId,
  };
}
