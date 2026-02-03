import { NextRequest, NextResponse } from 'next/server';
import { recordNFTMint } from '@/lib/huntpay/core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, stopId, chainId, contractAddress, tokenId, txHash, metadataUrl } = body;

    if (!teamId || !stopId || !chainId || !contractAddress || !tokenId || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await recordNFTMint(
      teamId,
      stopId,
      chainId,
      contractAddress,
      tokenId,
      txHash,
      metadataUrl
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Record NFT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record NFT' },
      { status: 500 }
    );
  }
}
