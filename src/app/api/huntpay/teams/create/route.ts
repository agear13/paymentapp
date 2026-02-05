import { NextRequest, NextResponse } from 'next/server';
import { createTeam, connectTeamWallet } from '@/lib/huntpay/core';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { huntSlug, teamName, captainEmail, teamSize, walletAddress, chainId } = body;

    if (!huntSlug || !teamName || !captainEmail || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get hunt by slug
    const { data: hunt, error: huntError } = await supabase
      .from('hunts')
      .select('id')
      .eq('slug', huntSlug)
      .single();

    if (huntError || !hunt) {
      return NextResponse.json(
        { error: 'Hunt not found' },
        { status: 404 }
      );
    }

    // Create team
    const { team, joinToken } = await createTeam({
      huntId: hunt.id,
      teamName,
      captainEmail,
      teamSize: teamSize || 1,
    });

    // Connect wallet
    await connectTeamWallet(team.id, walletAddress, chainId || 11155111);

    return NextResponse.json({
      success: true,
      team,
      joinToken,
    });
  } catch (error: any) {
    console.error('Create team error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create team' },
      { status: 500 }
    );
  }
}
