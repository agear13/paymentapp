import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';

export const config = createConfig({
  chains: [sepolia],
  connectors: [metaMask()],
  transports: {
    [sepolia.id]: http(),
  },
});

// NFT Contract Configuration (deployed to Sepolia testnet)
export const NFT_CONTRACT = {
  address: '0x1234567890123456789012345678901234567890' as `0x${string}`, // Replace with actual deployed contract
  abi: [
    {
      name: 'mint',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'tokenURI', type: 'string' },
      ],
      outputs: [{ name: 'tokenId', type: 'uint256' }],
    },
  ] as const,
} as const;
