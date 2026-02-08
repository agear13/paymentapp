/**
 * Referral Programs → Partners Module Integration
 * Creates partner ledger entries when conversions are approved
 * Uses admin client to bypass RLS for deterministic ledger writes
 */

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Creates a partner ledger entry when a referral conversion is approved
 * This makes the earnings visible in the Partners UI
 */
export async function createPartnerLedgerEntryForReferralConversion(
  conversionId: string
): Promise<void> {
  // Use admin client for all ledger operations (bypasses RLS)
  const adminClient = createAdminClient();

  try {
    // Load conversion with all related data from referral_ tables
    const { data: conversion, error: convError } = await adminClient
      .from('referral_conversions')
      .select(`
        *,
        referral_programs!referral_conversions_program_id_fkey (id, name, slug),
        referral_participants!referral_conversions_participant_id_fkey (id, name, role, referral_code)
      `)
      .eq('id', conversionId)
      .single();

    if (convError || !conversion) {
      console.error('Conversion not found:', convError);
      return;
    }

    // Get the program rules to calculate earnings from referral_program_rules
    const { data: rule } = await adminClient
      .from('referral_program_rules')
      .select('*')
      .eq('program_id', conversion.program_id)
      .eq('role', conversion.referral_participants.role)
      .eq('conversion_type', conversion.conversion_type)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (!rule) {
      console.log('No matching rule found for conversion:', conversionId);
      return;
    }

    // Calculate earnings based on rule
    let earningsAmount = 0;
    if (rule.payout_type === 'fixed') {
      earningsAmount = parseFloat(rule.value.toString());
    } else if (rule.payout_type === 'percent' && conversion.gross_amount) {
      earningsAmount = (parseFloat(conversion.gross_amount.toString()) * parseFloat(rule.value.toString())) / 100;
    }

    if (earningsAmount <= 0) {
      console.log('Calculated earnings is 0 or negative, skipping ledger entry');
      return;
    }

    const currency = rule.currency || conversion.currency || 'USD';

    // Get or create partner program in ledger
    const programSlug = conversion.referral_programs.slug;
    const { data: existingProgram } = await adminClient
      .from('partner_programs')
      .select('id')
      .eq('slug', programSlug)
      .single();

    let programId: string;

    if (existingProgram) {
      programId = existingProgram.id;
    } else {
      // Create new partner program
      const { data: newProgram, error: programError } = await adminClient
        .from('partner_programs')
        .insert({
          slug: programSlug,
          name: conversion.referral_programs.name,
        })
        .select('id')
        .single();

      if (programError || !newProgram) {
        console.error('Failed to create partner program:', programError);
        return;
      }
      programId = newProgram.id;
    }

    // Get or create partner entity (participant)
    const { data: existingEntity } = await adminClient
      .from('partner_entities')
      .select('id')
      .eq('program_id', programId)
      .eq('entity_type', 'participant')
      .eq('entity_ref_id', conversion.participant_id)
      .single();

    let entityId: string | null = null;

    if (existingEntity) {
      entityId = existingEntity.id;
    } else {
      // Create new entity
      const { data: newEntity } = await adminClient
        .from('partner_entities')
        .insert({
          program_id: programId,
          entity_type: 'participant',
          entity_ref_id: conversion.participant_id,
          name: conversion.referral_participants.name,
        })
        .select('id')
        .single();

      entityId = newEntity?.id || null;
    }

    // Build description
    const participantName = conversion.referral_participants.name;
    const conversionType = conversion.conversion_type;
    const programName = conversion.referral_programs.name;
    const description = `${programName} conversion: ${participantName} • ${conversionType}${conversion.gross_amount ? ` • $${conversion.gross_amount}` : ''}`;

    // Insert ledger entry (idempotent via unique constraint)
    const { error: insertError } = await adminClient
      .from('partner_ledger_entries')
      .insert({
        program_id: programId,
        entity_id: entityId,
        source: 'referral',
        source_ref: conversionId,
        status: 'pending',
        gross_amount: conversion.gross_amount || null,
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
 * Update the partner_entities table schema to support 'participant' entity type
 * Note: This should be added to the migration, but documenting here for reference
 */
