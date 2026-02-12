/**
 * Referral Programs → Partners Module Integration
 * Creates partner ledger entries when conversions are approved
 * Supports: legacy single-beneficiary (lead_submitted) and multi-tier (payment_completed)
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type LedgerCreationResult = { created: number; skipped: number };

/**
 * Creates partner ledger entries for a referral conversion.
 * For payment_completed with proof_json.allocations: writes one per allocation (multi-beneficiary).
 * For legacy (lead_submitted etc): uses referral_program_rules, single entry.
 */
export async function createPartnerLedgerEntryForReferralConversion(
  conversionId: string,
  options?: { isReplay?: boolean }
): Promise<LedgerCreationResult> {
  const logStart = options?.isReplay ? '[REFERRAL_LEDGER_REPLAY_START]' : '[REFERRAL_LEDGER_START]';
  console.log(logStart, 'Creating ledger entry for conversion:', conversionId);

  const adminClient = createAdminClient();

  try {
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
      participant: conversion.referral_participants?.name,
      program: conversion.referral_programs?.slug,
    });

    const proofJson = (conversion.proof_json as Record<string, unknown>) || {};
    const rawAllocations = proofJson.allocations as Array<{
      role?: string;
      participantId?: string;
      referral_participant_id?: string;
      amount: number;
      currency?: string;
      description?: string;
    }> | undefined;

    const allocations = rawAllocations?.map((a) => ({
      role: a.role ?? 'beneficiary',
      participantId: a.participantId ?? a.referral_participant_id ?? '',
      amount: a.amount,
      currency: a.currency ?? 'USD',
      description: a.description ?? 'Manual allocation',
    })).filter((a) => a.participantId && a.amount > 0);

    if (conversion.conversion_type === 'payment_completed' && Array.isArray(allocations) && allocations.length > 0) {
      return await writeMultiBeneficiaryLedger(
        adminClient,
        conversionId,
        conversion,
        allocations
      );
    }

    return await writeLegacySingleLedger(adminClient, conversionId, conversion);
  } catch (error) {
    console.error('[REFERRAL_LEDGER_FAIL] Error:', error);
    throw error;
  }
}

async function writeMultiBeneficiaryLedger(
  adminClient: ReturnType<typeof createAdminClient>,
  conversionId: string,
  conversion: Record<string, unknown>,
  allocations: Array<{ role: string; participantId: string; amount: number; currency: string; description: string }>
): Promise<LedgerCreationResult> {
  const programSlug = (conversion.referral_programs as { slug: string })?.slug;
  const consultantCode = (conversion.referral_participants as { referral_code: string })?.referral_code || '';

  const { data: partnerProgram } = await adminClient
    .from('partner_programs')
    .select('id')
    .eq('slug', programSlug)
    .single();

  if (!partnerProgram) {
    throw new Error(`[REFERRAL_LEDGER_FAIL] Partner program not found: ${programSlug}`);
  }

  console.log('[REFERRAL_LEDGER_MAP] partner_program_id:', partnerProgram.id, 'slug:', programSlug);

  const sourceRefText = conversionId.toString();
  const grossAmount = conversion.gross_amount != null ? parseFloat(String(conversion.gross_amount)) : null;
  const currency = (conversion.currency as string) || 'USD';
  let created = 0;
  let skipped = 0;

  for (const alloc of allocations) {
    if (alloc.amount <= 0) continue;

    const { data: mapRow } = await adminClient
      .from('referral_partner_entity_map')
      .select('partner_entity_id')
      .eq('referral_participant_id', alloc.participantId)
      .single();

    if (!mapRow) {
      console.warn(`[REFERRAL_LEDGER] No partner entity map for ${alloc.participantId}, skipping`);
      continue;
    }

    const description = `${alloc.role} • ${alloc.description} • ${consultantCode}`;

    console.log('[REFERRAL_LEDGER_INSERT]', { source_ref: sourceRefText, role: alloc.role, earnings: alloc.amount });

    const { error } = await adminClient.from('partner_ledger_entries').insert({
      program_id: partnerProgram.id,
      entity_id: mapRow.partner_entity_id,
      source: 'referral',
      source_ref: sourceRefText,
      status: 'pending',
      gross_amount: grossAmount,
      earnings_amount: alloc.amount,
      currency: alloc.currency || currency,
      description,
    });

    if (error) {
      if (error.code === '23505') {
        skipped++;
        console.log('[REFERRAL_LEDGER_SUCCESS] Already exists (idempotent):', alloc.role);
      } else {
        throw error;
      }
    } else {
      created++;
    }
  }

  console.log('[REFERRAL_LEDGER_SUCCESS] Multi-beneficiary:', { created, skipped });
  return { created, skipped };
}

async function writeLegacySingleLedger(
  adminClient: ReturnType<typeof createAdminClient>,
  conversionId: string,
  conversion: Record<string, unknown>
): Promise<LedgerCreationResult> {
  const participant = conversion.referral_participants as { role: string; name: string } | null;
  const program = conversion.referral_programs as { slug: string; name: string } | null;
  if (!participant || !program) {
    throw new Error('[REFERRAL_LEDGER_FAIL] Missing participant or program data');
  }

  const { data: rule } = await adminClient
    .from('referral_program_rules')
    .select('*')
    .eq('program_id', conversion.program_id)
    .eq('role', participant.role)
    .eq('conversion_type', conversion.conversion_type)
    .order('priority', { ascending: false })
    .limit(1)
    .single();

  if (!rule) {
    throw new Error(`[REFERRAL_LEDGER_FAIL] No rule for role=${participant.role} type=${conversion.conversion_type}`);
  }

  let earningsAmount = 0;
  if (rule.payout_type === 'fixed') {
    earningsAmount = parseFloat(String(rule.value));
  } else if (rule.payout_type === 'percent' && conversion.gross_amount) {
    earningsAmount = (parseFloat(String(conversion.gross_amount)) * parseFloat(String(rule.value))) / 100;
  }

  if (earningsAmount <= 0) {
    throw new Error(`[REFERRAL_LEDGER_FAIL] Earnings <= 0`);
  }

  const { data: partnerProgram } = await adminClient
    .from('partner_programs')
    .select('id')
    .eq('slug', program.slug)
    .single();

  if (!partnerProgram) {
    throw new Error(`[REFERRAL_LEDGER_FAIL] Partner program not found: ${program.slug}`);
  }

  const { data: mapRow } = await adminClient
    .from('referral_partner_entity_map')
    .select('partner_entity_id')
    .eq('referral_participant_id', conversion.participant_id)
    .single();

  const entityId = mapRow?.partner_entity_id ?? null;
  const description = `${program.name} conversion: ${participant.name} • ${conversion.conversion_type}`;
  const sourceRefText = conversionId.toString();

  console.log('[REFERRAL_LEDGER_INSERT] Legacy:', { source_ref: sourceRefText, earnings: earningsAmount });

  const { error } = await adminClient.from('partner_ledger_entries').insert({
    program_id: partnerProgram.id,
    entity_id: entityId,
    source: 'referral',
    source_ref: sourceRefText,
    status: 'pending',
    gross_amount: conversion.gross_amount ?? null,
    earnings_amount: earningsAmount,
    currency: (rule.currency as string) || 'USD',
    description,
  });

  if (error) {
    if (error.code === '23505') {
      console.log('[REFERRAL_LEDGER_SUCCESS] Already exists (idempotent)');
      return { created: 0, skipped: 1 };
    }
    throw error;
  }

  console.log('[REFERRAL_LEDGER_SUCCESS] Legacy entry created');
  return { created: 1, skipped: 0 };
}
