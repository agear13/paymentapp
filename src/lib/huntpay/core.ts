/**
 * HuntPay Core Functions
 * Team management, check-ins, conversions, and attribution tracking
 */

import { createClient } from '@/lib/supabase/server';
import { createPartnerLedgerEntry } from './partners-integration';
import crypto from 'crypto';

export interface CreateTeamInput {
  huntId: string;
  teamName: string;
  captainEmail: string;
  teamSize: number;
}

export interface CheckinInput {
  teamId: string;
  stopId: string;
  checkinCode: string;
}

export interface AttributionInput {
  teamId: string;
  stopId: string;
  challengeId: string;
  sponsorId: string;
  referralUrl: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface ConversionInput {
  teamId: string;
  stopId: string;
  challengeId: string;
  sponsorId: string;
  conversionType: string;
  txHash?: string;
  screenshotUrl?: string;
  note?: string;
}

/**
 * Create a new team and generate join token
 */
export async function createTeam(input: CreateTeamInput) {
  const supabase = await createClient();

  // Generate unique join token
  const joinToken = `JOIN-${input.teamName.toUpperCase().replace(/\s+/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

  const { data, error } = await supabase
    .from('teams')
    .insert({
      hunt_id: input.huntId,
      name: input.teamName,
      captain_email: input.captainEmail,
      join_token: joinToken,
      team_size: input.teamSize,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create team:', error);
    throw new Error('Failed to create team');
  }

  return { team: data, joinToken };
}

/**
 * Connect wallet to team
 */
export async function connectTeamWallet(teamId: string, address: string, chainId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('team_wallets')
    .upsert({
      team_id: teamId,
      address: address.toLowerCase(),
      chain_id: chainId,
      connected_at: new Date().toISOString(),
    }, {
      onConflict: 'team_id,address,chain_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to connect wallet:', error);
    throw new Error('Failed to connect wallet');
  }

  return data;
}

/**
 * Check in at a stop with code verification
 */
export async function checkinAtStop(input: CheckinInput) {
  const supabase = await createClient();

  // Verify checkin code
  const { data: stop } = await supabase
    .from('stops')
    .select('checkin_code')
    .eq('id', input.stopId)
    .single();

  if (!stop || stop.checkin_code !== input.checkinCode) {
    throw new Error('Invalid check-in code');
  }

  // Check for duplicate check-in
  const { data: existing } = await supabase
    .from('stop_checkins')
    .select('id')
    .eq('team_id', input.teamId)
    .eq('stop_id', input.stopId)
    .single();

  if (existing) {
    // Already checked in, return success (idempotent)
    return { success: true, alreadyCheckedIn: true };
  }

  // Create check-in
  const { data, error } = await supabase
    .from('stop_checkins')
    .insert({
      team_id: input.teamId,
      stop_id: input.stopId,
      checkin_code: input.checkinCode,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to check in:', error);
    throw new Error('Failed to check in');
  }

  return { success: true, checkin: data };
}

/**
 * Track attribution event (clicked sponsor link)
 */
export async function trackAttribution(input: AttributionInput) {
  const supabase = await createClient();

  // Hash IP for privacy
  const ipHash = input.ipAddress 
    ? crypto.createHash('sha256').update(input.ipAddress).digest('hex')
    : null;

  const { data, error } = await supabase
    .from('attributions')
    .insert({
      team_id: input.teamId,
      stop_id: input.stopId,
      challenge_id: input.challengeId,
      sponsor_id: input.sponsorId,
      referral_url: input.referralUrl,
      user_agent: input.userAgent,
      ip_hash: ipHash,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to track attribution:', error);
    // Non-fatal: attribution tracking failure shouldn't block user
    return { success: false };
  }

  return { success: true, attribution: data };
}

/**
 * Submit conversion proof (idempotent)
 */
export async function submitConversion(input: ConversionInput) {
  const supabase = await createClient();

  // Check for duplicate conversion
  const { data: existing } = await supabase
    .from('conversions')
    .select('id, status')
    .eq('team_id', input.teamId)
    .eq('challenge_id', input.challengeId)
    .single();

  if (existing) {
    // Already submitted, return existing
    return { success: true, conversion: existing, isDuplicate: true };
  }

  // Create conversion
  const { data, error } = await supabase
    .from('conversions')
    .insert({
      team_id: input.teamId,
      stop_id: input.stopId,
      challenge_id: input.challengeId,
      sponsor_id: input.sponsorId,
      conversion_type: input.conversionType,
      tx_hash: input.txHash,
      screenshot_url: input.screenshotUrl,
      note: input.note,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to submit conversion:', error);
    throw new Error('Failed to submit conversion');
  }

  return { success: true, conversion: data };
}

/**
 * Mark stop as completed (all challenges done)
 */
export async function completeStop(teamId: string, stopId: string) {
  const supabase = await createClient();

  // Check if already completed
  const { data: existing } = await supabase
    .from('stop_completions')
    .select('id')
    .eq('team_id', teamId)
    .eq('stop_id', stopId)
    .single();

  if (existing) {
    return { success: true, alreadyCompleted: true };
  }

  // Verify all challenges have proof submitted
  const { data: challenges } = await supabase
    .from('challenges')
    .select('id')
    .eq('stop_id', stopId);

  const { data: conversions } = await supabase
    .from('conversions')
    .select('challenge_id')
    .eq('team_id', teamId)
    .eq('stop_id', stopId);

  const submittedChallengeIds = new Set(conversions?.map(c => c.challenge_id) || []);
  const allChallengesSubmitted = challenges?.every(c => submittedChallengeIds.has(c.id));

  if (!allChallengesSubmitted) {
    throw new Error('Not all challenges completed');
  }

  // Mark as completed
  const { data, error } = await supabase
    .from('stop_completions')
    .insert({
      team_id: teamId,
      stop_id: stopId,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to complete stop:', error);
    throw new Error('Failed to complete stop');
  }

  return { success: true, completion: data };
}

/**
 * Record NFT mint
 */
export async function recordNFTMint(
  teamId: string,
  stopId: string,
  chainId: number,
  contractAddress: string,
  tokenId: string,
  txHash: string,
  metadataUrl?: string
) {
  const supabase = await createClient();

  // Check for duplicate
  const { data: existing } = await supabase
    .from('nfts')
    .select('id')
    .eq('team_id', teamId)
    .eq('stop_id', stopId)
    .single();

  if (existing) {
    return { success: true, isDuplicate: true };
  }

  const { data, error } = await supabase
    .from('nfts')
    .insert({
      team_id: teamId,
      stop_id: stopId,
      chain_id: chainId,
      contract_address: contractAddress.toLowerCase(),
      token_id: tokenId,
      tx_hash: txHash,
      metadata_url: metadataUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to record NFT:', error);
    throw new Error('Failed to record NFT');
  }

  return { success: true, nft: data };
}

/**
 * Approve conversion (ADMIN ONLY)
 * This is the critical function that creates partner ledger entries
 */
export async function approveConversion(conversionId: string, reviewedBy: string) {
  const supabase = await createClient();

  // Get conversion details
  const { data: conversion, error: fetchError } = await supabase
    .from('conversions')
    .select(`
      *,
      sponsors (
        name,
        payout_currency,
        payout_per_conversion
      )
    `)
    .eq('id', conversionId)
    .single();

  if (fetchError || !conversion) {
    throw new Error('Conversion not found');
  }

  if (conversion.status === 'approved') {
    return { success: true, alreadyApproved: true };
  }

  // Update conversion status
  const { error: updateError } = await supabase
    .from('conversions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', conversionId);

  if (updateError) {
    throw new Error('Failed to approve conversion');
  }

  // Create partner ledger entry (THIS IS THE KEY INTEGRATION)
  try {
    const ledgerEntry = await createPartnerLedgerEntry({
      id: conversionId,
      team_id: conversion.team_id,
      sponsor_id: conversion.sponsor_id,
      sponsor_name: conversion.sponsors.name,
      conversion_type: conversion.conversion_type,
      payout_amount: conversion.sponsors.payout_per_conversion,
      payout_currency: conversion.sponsors.payout_currency,
      created_at: conversion.created_at,
    });

    return {
      success: true,
      conversion,
      ledgerEntry,
      message: 'Conversion approved and added to partner ledger',
    };
  } catch (error) {
    console.error('Failed to create ledger entry:', error);
    // Rollback approval
    await supabase
      .from('conversions')
      .update({ status: 'pending' })
      .eq('id', conversionId);
    
    throw new Error('Failed to create partner ledger entry');
  }
}

/**
 * Reject conversion (ADMIN ONLY)
 */
export async function rejectConversion(conversionId: string, reviewedBy: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('conversions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', conversionId);

  if (error) {
    throw new Error('Failed to reject conversion');
  }

  return { success: true };
}
