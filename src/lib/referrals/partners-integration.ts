/**
 * Referral Programs → Partners Module Integration
 * Creates partner ledger entries for payment_completed conversions only.
 * Supports: computed allocations (program + participant tree) or proof_json.allocations (manual).
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type LedgerCreationResult = { created: number; skipped: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Creates partner ledger entries for a referral conversion.
 * ONLY payment_completed creates ledger entries.
 * Uses proof_json.allocations if present; otherwise computes from program owner_percent + participant tree.
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
        referral_programs!referral_conversions_program_id_fkey (id, name, slug, owner_percent, owner_participant_id),
        referral_participants!referral_conversions_participant_id_fkey (id, name, role, referral_code, parent_participant_id, custom_commission_percent)
      `)
      .eq('id', conversionId)
      .single();

    if (convError || !conversion) {
      const errorMsg = `[REFERRAL_LEDGER_FAIL] Conversion not found: ${conversionId}`;
      console.error(errorMsg, convError);
      throw new Error(errorMsg);
    }

    if (conversion.conversion_type !== 'payment_completed') {
      console.log('[REFERRAL_LEDGER] Skipping non-payment_completed:', conversion.conversion_type);
      return { created: 0, skipped: 0 };
    }

    const proofJson = (conversion.proof_json as Record<string, unknown>) || {};
    const rawAllocations = proofJson.allocations as Array<{
      role?: string;
      participantId?: string;
      referral_participant_id?: string;
      amount: number;
      currency?: string;
      description?: string;
    }> | undefined;

    let allocations: Array<{ role: string; participantId: string; amount: number; currency: string; description: string }>;

    if (Array.isArray(rawAllocations) && rawAllocations.length > 0) {
      allocations = rawAllocations
        .map((a) => ({
          role: a.role ?? 'beneficiary',
          participantId: a.participantId ?? a.referral_participant_id ?? '',
          amount: a.amount,
          currency: (a.currency as string) ?? 'USD',
          description: a.description ?? 'Manual allocation',
        }))
        .filter((a) => a.participantId && a.amount > 0);
    } else {
      allocations = await computeAllocationsFromHierarchy(adminClient, conversion);
    }

    if (allocations.length === 0) {
      console.log('[REFERRAL_LEDGER] No allocations to write');
      return { created: 0, skipped: 0 };
    }

    return await writeMultiBeneficiaryLedger(
      adminClient,
      conversionId,
      conversion,
      allocations
    );
  } catch (error) {
    console.error('[REFERRAL_LEDGER_FAIL] Error:', error);
    throw error;
  }
}

async function computeAllocationsFromHierarchy(
  adminClient: ReturnType<typeof createAdminClient>,
  conversion: Record<string, unknown>
): Promise<Array<{ role: string; participantId: string; amount: number; currency: string; description: string }>> {
  const program = conversion.referral_programs as {
    slug: string;
    owner_percent: number | null;
    owner_participant_id: string | null;
  };
  const origin = conversion.referral_participants as {
    id: string;
    role: string;
    referral_code: string;
    parent_participant_id: string | null;
    custom_commission_percent: number | null;
  };

  const gross = parseFloat(String(conversion.gross_amount ?? 0));
  const currency = (conversion.currency as string) || 'USD';

  if (!program?.owner_participant_id) {
    throw new Error('[ALLOC_COMPUTE] referral_programs.owner_participant_id must be set');
  }

  const ownerParticipantId = program.owner_participant_id as string;
  const ownerPercent = parseFloat(String(program.owner_percent ?? 0));

  let consultantId: string;
  let advocateId: string | null = null;
  let advocatePercent = 0;

  if (origin.role === 'CLIENT_ADVOCATE') {
    advocateId = origin.id;
    advocatePercent = parseFloat(String(origin.custom_commission_percent ?? 0));
    if (!origin.parent_participant_id) {
      throw new Error('[ALLOC_COMPUTE] Advocate must have parent_participant_id (consultant)');
    }
    consultantId = origin.parent_participant_id;
  } else {
    consultantId = origin.id;
  }

  const ownerAmount = round2(gross * (ownerPercent / 100));
  const advocateAmount = advocateId ? round2(gross * (advocatePercent / 100)) : 0;
  const consultantAmount = round2(gross - ownerAmount - advocateAmount);

  if (consultantAmount < 0) {
    throw new Error(
      `[ALLOC_COMPUTE] Consultant remainder negative: gross=${gross}, owner=${ownerAmount}, advocate=${advocateAmount}`
    );
  }

  const allocations: Array<{ role: string; participantId: string; amount: number; currency: string; description: string }> = [];

  if (ownerAmount > 0) {
    allocations.push({
      role: 'BD_PARTNER',
      participantId: ownerParticipantId,
      amount: ownerAmount,
      currency,
      description: 'BD Partner commission',
    });
  }

  if (advocateId && advocateAmount > 0) {
    allocations.push({
      role: 'CLIENT_ADVOCATE',
      participantId: advocateId,
      amount: advocateAmount,
      currency,
      description: 'Client advocate commission',
    });
  }

  if (consultantAmount > 0) {
    allocations.push({
      role: 'CONSULTANT',
      participantId: consultantId,
      amount: consultantAmount,
      currency,
      description: 'Consultant revenue',
    });
  }

  console.log('[ALLOC_COMPUTE]', {
    gross,
    ownerAmount,
    advocateAmount,
    consultantAmount,
    allocations: allocations.length,
  });

  return allocations;
}

async function ensurePartnerEntityForParticipant(
  adminClient: ReturnType<typeof createAdminClient>,
  partnerProgramId: string,
  referralParticipantId: string,
  participantName: string
): Promise<string | null> {
  const { data: mapRow } = await adminClient
    .from('referral_partner_entity_map')
    .select('partner_entity_id')
    .eq('referral_participant_id', referralParticipantId)
    .single();

  if (mapRow) return mapRow.partner_entity_id;

  console.log('[ALLOC_ENTITY_MAP] Creating partner_entity for participant:', referralParticipantId);

  const { data: inserted, error: insertErr } = await adminClient
    .from('partner_entities')
    .insert({
      program_id: partnerProgramId,
      entity_type: 'participant',
      entity_ref_id: referralParticipantId,
      name: participantName || 'Referral participant',
    })
    .select('id')
    .single();

  if (inserted) {
    await adminClient
      .from('referral_partner_entity_map')
      .upsert(
        { referral_participant_id: referralParticipantId, partner_entity_id: inserted.id },
        { onConflict: 'referral_participant_id' }
      );
    return inserted.id;
  }

  if (insertErr?.code === '23505') {
    const { data: existing } = await adminClient
      .from('partner_entities')
      .select('id')
      .eq('program_id', partnerProgramId)
      .eq('entity_type', 'participant')
      .eq('entity_ref_id', referralParticipantId)
      .single();
    if (existing) {
      await adminClient
        .from('referral_partner_entity_map')
        .upsert(
          { referral_participant_id: referralParticipantId, partner_entity_id: existing.id },
          { onConflict: 'referral_participant_id' }
        );
      return existing.id;
    }
  }

  return null;
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

  console.log('[ALLOC_MAP] partner_program_id:', partnerProgram.id, 'slug:', programSlug);

  const sourceRefText = conversionId.toString();
  const grossAmount = conversion.gross_amount != null ? parseFloat(String(conversion.gross_amount)) : null;
  const currency = (conversion.currency as string) || 'USD';
  let created = 0;
  let skipped = 0;

  for (const alloc of allocations) {
    if (alloc.amount <= 0) continue;

    const entityId = await ensurePartnerEntityForParticipant(
      adminClient,
      partnerProgram.id,
      alloc.participantId,
      alloc.role
    );

    if (!entityId) {
      console.warn(`[ALLOC_WRITE] No partner entity for ${alloc.participantId}, skipping`);
      continue;
    }

    const description = `${alloc.role} • ${alloc.description} • ${consultantCode}`;

    console.log('[ALLOC_WRITE]', { source_ref: sourceRefText, role: alloc.role, earnings: alloc.amount });

    const { error } = await adminClient.from('partner_ledger_entries').insert({
      program_id: partnerProgram.id,
      entity_id: entityId,
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
        console.log('[ALLOC_WRITE] Already exists (idempotent):', alloc.role);
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

