/**
 * HuntPay → Partners Module Integration
 * Creates partner ledger entries when conversions are approved
 * Uses admin client to bypass RLS for deterministic ledger writes
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createUserClient } from '@/lib/supabase/server';

/**
 * Creates a partner ledger entry when a HuntPay conversion is approved
 * This makes the earnings visible in the Partners UI
 */
export async function createPartnerLedgerEntryForConversion(
  conversionId: string
): Promise<void> {
  // Use admin client for all ledger operations (bypasses RLS)
  const adminClient = createAdminClient();

  try {
    // Load conversion with all related data
    const { data: conversion, error: convError } = await adminClient
      .from('conversions')
      .select(`
        *,
        sponsors (id, name, payout_per_conversion, payout_currency),
        challenges (id, title, type, conversion_type),
        stops (id, name, venue_name),
        teams (id, name)
      `)
      .eq('id', conversionId)
      .single();

    if (convError || !conversion) {
      console.error('Conversion not found:', convError);
      return;
    }

    // Get or create HuntPay program
    const { data: program } = await adminClient
      .from('partner_programs')
      .select('id')
      .eq('slug', 'huntpay')
      .single();

    if (!program) {
      console.error('HuntPay program not found - run migration first');
      return;
    }

    const programId = program.id;

    // Get or create sponsor entity
    let entityId: string | null = null;
    
    if (conversion.sponsor_id && conversion.sponsors) {
      const { data: existingEntity } = await adminClient
        .from('partner_entities')
        .select('id')
        .eq('program_id', programId)
        .eq('entity_type', 'sponsor')
        .eq('entity_ref_id', conversion.sponsor_id)
        .single();

      if (existingEntity) {
        entityId = existingEntity.id;
      } else {
        // Create new entity
        const { data: newEntity } = await adminClient
          .from('partner_entities')
          .insert({
            program_id: programId,
            entity_type: 'sponsor',
            entity_ref_id: conversion.sponsor_id,
            name: conversion.sponsors.name,
          })
          .select('id')
          .single();

        entityId = newEntity?.id || null;
      }
    }

    // Calculate earnings amount
    const earningsAmount = conversion.sponsors?.payout_per_conversion || 0;
    const currency = conversion.sponsors?.payout_currency || 'USD';

    // Build description
    const teamName = conversion.teams?.name || 'Unknown Team';
    const sponsorName = conversion.sponsors?.name || 'Unknown Sponsor';
    const conversionType = conversion.conversion_type || 'other';
    const description = `HuntPay conversion approved: ${teamName} • ${sponsorName} • ${conversionType}`;

    // Insert ledger entry (idempotent via unique constraint)
    const { error: insertError } = await adminClient
      .from('partner_ledger_entries')
      .insert({
        program_id: programId,
        entity_id: entityId,
        source: 'huntpay',
        source_ref: conversionId,
        status: 'pending',
        gross_amount: null,
        earnings_amount: earningsAmount,
        currency,
        description,
      });

    if (insertError) {
      // Check if it's a duplicate (unique constraint violation)
      if (insertError.code === '23505') {
        console.log('Ledger entry already exists for conversion:', conversionId);
        return;
      }
      throw insertError;
    }

    console.log('Partner ledger entry created for conversion:', conversionId);
  } catch (error) {
    console.error('Failed to create partner ledger entry:', error);
    throw error;
  }
}

/**
 * Get partner ledger summary for a program
 */
export async function getPartnerLedgerSummary(programSlug: string = 'huntpay') {
  // Use user client for read operations (respects RLS)
  const supabase = await createUserClient();

  const { data: program } = await supabase
    .from('partner_programs')
    .select('id')
    .eq('slug', programSlug)
    .single();

  if (!program) {
    return {
      totalEarnings: 0,
      pendingEarnings: 0,
      paidOut: 0,
      entries: [],
    };
  }

  const { data: entries } = await supabase
    .from('partner_ledger_entries')
    .select('*')
    .eq('program_id', program.id)
    .order('created_at', { ascending: false });

  const totalEarnings = entries?.reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0) || 0;
  const pendingEarnings = entries?.filter(e => e.status === 'pending').reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0) || 0;
  const paidOut = entries?.filter(e => e.status === 'paid').reduce((sum, e) => sum + parseFloat(e.earnings_amount.toString()), 0) || 0;

  return {
    totalEarnings,
    pendingEarnings,
    paidOut,
    entries: entries || [],
  };
}
