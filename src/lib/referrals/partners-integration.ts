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
  console.log('[REFERRAL_LEDGER_START] Creating ledger entry for conversion:', conversionId);
  
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
      const errorMsg = `[REFERRAL_LEDGER_FAIL] Conversion not found: ${conversionId}`;
      console.error(errorMsg, convError);
      throw new Error(errorMsg);
    }

    console.log('[REFERRAL_LEDGER] Loaded conversion:', {
      id: conversion.id,
      type: conversion.conversion_type,
      status: conversion.status,
      participant: conversion.referral_participants.name,
      role: conversion.referral_participants.role,
      program: conversion.referral_programs.slug,
    });

    // Get the program rules to calculate earnings from referral_program_rules
    const { data: rule, error: ruleError } = await adminClient
      .from('referral_program_rules')
      .select('*')
      .eq('program_id', conversion.program_id)
      .eq('role', conversion.referral_participants.role)
      .eq('conversion_type', conversion.conversion_type)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (ruleError || !rule) {
      const errorMsg = `[REFERRAL_LEDGER_FAIL] No matching rule found for conversion ${conversionId}. Role: ${conversion.referral_participants.role}, Type: ${conversion.conversion_type}`;
      console.error(errorMsg, ruleError);
      throw new Error(errorMsg);
    }

    console.log('[REFERRAL_LEDGER] Found rule:', {
      payout_type: rule.payout_type,
      value: rule.value,
      currency: rule.currency,
    });

    // Calculate earnings based on rule
    let earningsAmount = 0;
    if (rule.payout_type === 'fixed') {
      earningsAmount = parseFloat(rule.value.toString());
    } else if (rule.payout_type === 'percent' && conversion.gross_amount) {
      earningsAmount = (parseFloat(conversion.gross_amount.toString()) * parseFloat(rule.value.toString())) / 100;
    }

    if (earningsAmount <= 0) {
      const errorMsg = `[REFERRAL_LEDGER_FAIL] Calculated earnings is ${earningsAmount}, must be positive`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log('[REFERRAL_LEDGER] Calculated earnings:', earningsAmount);

    const currency = rule.currency || conversion.currency || 'USD';

    // CRITICAL: Map referral_programs.slug to partner_programs.id
    // These are separate tables with separate IDs but matching slugs
    const referralProgramSlug = conversion.referral_programs.slug;
    
    console.log('[REFERRAL_LEDGER_MAP] Looking up partner_programs by slug:', referralProgramSlug);

    const { data: partnerProgram, error: partnerProgramError } = await adminClient
      .from('partner_programs')
      .select('id, slug, name')
      .eq('slug', referralProgramSlug)
      .single();

    if (partnerProgramError || !partnerProgram) {
      const errorMsg = `[REFERRAL_LEDGER_FAIL] No matching partner_programs entry found for slug="${referralProgramSlug}". ` +
        `Partner programs must be created via migration before referrals can create ledger entries. ` +
        `Error: ${partnerProgramError?.message || 'Not found'}`;
      console.error(errorMsg, partnerProgramError);
      throw new Error(errorMsg);
    }

    const partnerProgramId = partnerProgram.id;
    
    console.log('[REFERRAL_LEDGER_MAP] Mapped successfully:', {
      referral_program_slug: referralProgramSlug,
      partner_program_id: partnerProgramId,
      partner_program_slug: partnerProgram.slug,
      partner_program_name: partnerProgram.name,
    });

    // Note: partner_entities has CHECK constraint limiting entity_type to ('sponsor', 'hunt', 'stop')
    // For referral participants, we'll leave entity_id as NULL since it's nullable
    // The participant info is already captured in the description field
    const entityId: string | null = null;
    console.log('[REFERRAL_LEDGER] Using NULL entity_id (participant info in description)');

    // Build description
    const participantName = conversion.referral_participants.name;
    const conversionType = conversion.conversion_type;
    const programName = conversion.referral_programs.name;
    const description = `${programName} conversion: ${participantName} • ${conversionType}${conversion.gross_amount ? ` • $${conversion.gross_amount}` : ''}`;

    // IMPORTANT: Convert UUID to TEXT for source_ref column
    const sourceRefText = conversionId.toString();
    
    console.log('[REFERRAL_LEDGER_INSERT] Preparing ledger entry:', {
      source: 'referral',
      source_ref: sourceRefText,
      program_id: partnerProgramId,
      earnings_amount: earningsAmount,
      currency,
      status: 'pending',
      description,
    });

    // Insert ledger entry (idempotent via unique constraint on source, source_ref)
    const { error: insertError } = await adminClient
      .from('partner_ledger_entries')
      .insert({
        program_id: partnerProgramId, // CRITICAL: Use mapped partner_programs.id
        entity_id: entityId,
        source: 'referral',
        source_ref: sourceRefText,
        status: 'pending',
        gross_amount: conversion.gross_amount || null,
        earnings_amount: earningsAmount,
        currency,
        description,
      });

    if (insertError) {
      // Check if it's a duplicate (unique constraint violation)
      if (insertError.code === '23505') {
        console.log('[REFERRAL_LEDGER_SUCCESS] Ledger entry already exists (idempotent):', conversionId);
        return;
      }
      
      const errorMsg = `[REFERRAL_LEDGER_FAIL] Failed to insert ledger entry`;
      console.error(errorMsg, insertError);
      throw insertError;
    }

    console.log('[REFERRAL_LEDGER_SUCCESS] Partner ledger entry created for conversion:', conversionId);
  } catch (error) {
    console.error('[REFERRAL_LEDGER_FAIL] Error:', error);
    throw error;
  }
}

/**
 * Update the partner_entities table schema to support 'participant' entity type
 * Note: This should be added to the migration, but documenting here for reference
 */
