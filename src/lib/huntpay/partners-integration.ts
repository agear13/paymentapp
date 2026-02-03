/**
 * HuntPay → Partners Module Integration
 * 
 * When conversions are approved in the scavenger hunt system,
 * this creates REAL ledger entries in the existing Partners module.
 */

import { createClient } from '@/lib/supabase/server';

export interface ApprovedConversion {
  id: string;
  team_id: string;
  sponsor_id: string;
  sponsor_name: string;
  conversion_type: string;
  payout_amount: number;
  payout_currency: string;
  created_at: string;
}

/**
 * Creates a ledger entry in the Partners module when a conversion is approved
 * This integrates the scavenger hunt system with the existing Partners UI
 */
export async function createPartnerLedgerEntry(conversion: ApprovedConversion) {
  const supabase = await createClient();

  // Map HuntPay sponsor to Partners partner
  // In a real system, you'd have a mapping table or use the same ID
  const partnerId = await getOrCreatePartner(conversion.sponsor_id, conversion.sponsor_name);

  if (!partnerId) {
    throw new Error(`Could not find or create partner for sponsor: ${conversion.sponsor_id}`);
  }

  // Create ledger entry in the existing partners ledger structure
  // This will appear in: Partners → Ledger, Partners → Dashboard, Programs → Aggregates
  const ledgerEntry = {
    id: `huntpay-${conversion.id}`,
    partner_id: partnerId,
    date: conversion.created_at,
    source: `HuntPay: ${conversion.team_id.substring(0, 8)}`,
    source_type: 'Program' as const,
    transaction_type: mapConversionToTransactionType(conversion.conversion_type),
    gross_amount: conversion.payout_amount,
    allocation_rate: 100, // Sponsors get 100% of their defined payout amount
    earnings_amount: conversion.payout_amount,
    status: 'Pending' as const,
    metadata: {
      huntpay_conversion_id: conversion.id,
      team_id: conversion.team_id,
      conversion_type: conversion.conversion_type,
    },
  };

  // Insert into the partner_ledger_entries table
  // NOTE: You may need to create this table if it doesn't exist
  // or integrate with your existing ledger storage mechanism
  const { data, error } = await supabase
    .from('partner_ledger_entries')
    .insert(ledgerEntry)
    .select()
    .single();

  if (error) {
    console.error('Failed to create partner ledger entry:', error);
    throw error;
  }

  // Update partner aggregate stats
  await updatePartnerStats(partnerId, conversion.payout_amount);

  return data;
}

/**
 * Get or create a partner record for a sponsor
 */
async function getOrCreatePartner(sponsorId: string, sponsorName: string): Promise<string | null> {
  const supabase = await createClient();

  // First, try to find existing partner linked to this sponsor
  const { data: existing } = await supabase
    .from('partners')
    .select('id')
    .eq('external_id', sponsorId)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new partner record
  const { data: newPartner, error } = await supabase
    .from('partners')
    .insert({
      external_id: sponsorId,
      name: sponsorName,
      role: 'Partner',
      status: 'Active',
      revenue_share_rate: 100, // Sponsors get their full payout amount
      payout_method: 'Bank Transfer',
      total_earnings: 0,
      pending_earnings: 0,
      paid_out: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create partner:', error);
    return null;
  }

  return newPartner.id;
}

/**
 * Update partner aggregate statistics
 */
async function updatePartnerStats(partnerId: string, earningsAmount: number) {
  const supabase = await createClient();

  // Increment total_earnings and pending_earnings
  const { error } = await supabase.rpc('increment_partner_earnings', {
    p_partner_id: partnerId,
    p_earnings_amount: earningsAmount,
  });

  if (error) {
    console.error('Failed to update partner stats:', error);
    // Non-fatal: ledger entry is created, stats can be recalculated
  }
}

/**
 * Map HuntPay conversion types to Partners transaction types
 */
function mapConversionToTransactionType(conversionType: string): 'Payment Link' | 'Rewards' | 'Invoice' | 'Other' {
  const mapping: Record<string, 'Payment Link' | 'Rewards' | 'Invoice' | 'Other'> = {
    wallet_signup: 'Rewards',
    exchange_buy: 'Payment Link',
    staking: 'Rewards',
    swap: 'Payment Link',
    other: 'Other',
  };

  return mapping[conversionType] || 'Other';
}

/**
 * Batch create ledger entries for multiple approved conversions
 * Used by admin when approving conversions in bulk
 */
export async function batchCreatePartnerLedgerEntries(conversions: ApprovedConversion[]) {
  const results = [];
  const errors = [];

  for (const conversion of conversions) {
    try {
      const result = await createPartnerLedgerEntry(conversion);
      results.push(result);
    } catch (error) {
      errors.push({ conversion_id: conversion.id, error });
    }
  }

  return {
    success: results,
    errors,
    total: conversions.length,
    succeeded: results.length,
    failed: errors.length,
  };
}

/**
 * Mark ledger entries as paid when payout is processed
 * This is called from the Partners → Payouts flow
 */
export async function markLedgerEntriesAsPaid(ledgerEntryIds: string[], payoutId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('partner_ledger_entries')
    .update({
      status: 'Paid',
      payout_id: payoutId,
      updated_at: new Date().toISOString(),
    })
    .in('id', ledgerEntryIds)
    .select();

  if (error) {
    console.error('Failed to mark ledger entries as paid:', error);
    throw error;
  }

  // Update partner stats: move from pending to paid_out
  const affectedPartners = [...new Set(data.map(entry => entry.partner_id))];
  for (const partnerId of affectedPartners) {
    const totalAmount = data
      .filter(entry => entry.partner_id === partnerId)
      .reduce((sum, entry) => sum + entry.earnings_amount, 0);

    await supabase.rpc('move_partner_earnings_to_paid', {
      p_partner_id: partnerId,
      p_amount: totalAmount,
    });
  }

  return data;
}
