/**
 * POST /api/referrals/payment-completed
 * Called when a payment succeeds. Creates payment_completed conversion and ledger entries.
 * Internal route - called by payment link system. Consider protecting with internal auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeReferralAllocations, type Allocation } from '@/lib/referrals/allocation-engine';
import type { PaymentRule } from '@/lib/referrals/allocation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      programSlug,
      advocateReferralCode,
      consultantParticipantId,
      paymentLinkId,
      grossAmount,
      currency = 'USD',
      externalRef,
    } = body;

    if (!programSlug || grossAmount == null || !externalRef) {
      return NextResponse.json(
        { error: 'programSlug, grossAmount, and externalRef are required' },
        { status: 400 }
      );
    }

    const gross = parseFloat(String(grossAmount));
    if (isNaN(gross) || gross <= 0) {
      return NextResponse.json(
        { error: 'grossAmount must be a positive number' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    console.log('[REFERRAL_PAYMENT_COMPLETED] Received:', {
      programSlug,
      advocateReferralCode: advocateReferralCode ?? '(none)',
      consultantParticipantId: consultantParticipantId ?? '(none)',
      grossAmount: gross,
      currency,
      externalRef,
    });

    // Resolve program
    const { data: program, error: programError } = await adminClient
      .from('referral_programs')
      .select('id')
      .eq('slug', programSlug)
      .single();

    if (programError || !program) {
      console.error('[REFERRAL_PAYMENT_COMPLETED] Program not found:', programSlug, programError);
      return NextResponse.json(
        { error: `Program not found: ${programSlug}` },
        { status: 404 }
      );
    }

    const programId = program.id;

    // Resolve participants
    let consultantId: string | null = consultantParticipantId
      ? String(consultantParticipantId)
      : null;
    let advocateId: string | null = null;

    if (advocateReferralCode) {
      const { data: advocate } = await adminClient
        .from('referral_participants')
        .select('id')
        .eq('referral_code', String(advocateReferralCode).toUpperCase())
        .eq('program_id', programId)
        .eq('role', 'CLIENT_ADVOCATE')
        .single();

      if (advocate) {
        advocateId = advocate.id;
        // Get consultant from agreement
        const { data: agreement } = await adminClient
          .from('referral_agreements')
          .select('consultant_participant_id')
          .eq('advocate_participant_id', advocateId)
          .eq('program_id', programId)
          .eq('status', 'active')
          .single();

        if (agreement) {
          consultantId = agreement.consultant_participant_id;
        }
      }
    }

    if (!consultantId) {
      return NextResponse.json(
        { error: 'Could not resolve consultant: provide advocateReferralCode or consultantParticipantId' },
        { status: 400 }
      );
    }

    // Verify consultant exists
    const { data: consultant } = await adminClient
      .from('referral_participants')
      .select('id, name, referral_code')
      .eq('id', consultantId)
      .single();

    if (!consultant) {
      return NextResponse.json(
        { error: 'Consultant participant not found' },
        { status: 404 }
      );
    }

    // Check upstream (BD partner referral)
    const { data: referral } = await adminClient
      .from('referral_referrals')
      .select('parent_participant_id')
      .eq('child_participant_id', consultantId)
      .single();

    const hasUpstreamReferral = !!referral;
    const bdPartnerParticipantId = referral?.parent_participant_id ?? null;

    // Check downstream agreement
    const hasDownstreamAgreement =
      !!advocateId &&
      (await adminClient
        .from('referral_agreements')
        .select('id')
        .eq('consultant_participant_id', consultantId)
        .eq('advocate_participant_id', advocateId)
        .eq('program_id', programId)
        .eq('status', 'active')
        .single())
        .data != null;

    // Fetch rules
    const { data: upstreamRuleRow } = await adminClient
      .from('referral_payment_rules')
      .select('scope, payout_type, value, currency')
      .eq('program_id', programId)
      .eq('scope', 'UPSTREAM')
      .eq('active', true)
      .single();

    const { data: downstreamRuleRow } = await adminClient
      .from('referral_payment_rules')
      .select('scope, payout_type, value, currency')
      .eq('program_id', programId)
      .eq('scope', 'DOWNSTREAM')
      .eq('active', true)
      .single();

    const upstreamRule: PaymentRule | null = upstreamRuleRow
      ? {
          scope: 'UPSTREAM',
          payout_type: upstreamRuleRow.payout_type as 'percent' | 'fixed',
          value: parseFloat(String(upstreamRuleRow.value)),
          currency: upstreamRuleRow.currency || 'USD',
        }
      : null;

    const downstreamRule: PaymentRule | null = downstreamRuleRow
      ? {
          scope: 'DOWNSTREAM',
          payout_type: downstreamRuleRow.payout_type as 'percent' | 'fixed',
          value: parseFloat(String(downstreamRuleRow.value)),
          currency: downstreamRuleRow.currency || 'USD',
        }
      : null;

    // Compute allocations
    const result = computeReferralAllocations({
      programId,
      consultantParticipantId: consultantId,
      advocateParticipantId: advocateId,
      bdPartnerParticipantId,
      grossAmount: gross,
      currency,
      upstreamRule,
      downstreamRule,
      hasUpstreamReferral,
      hasDownstreamAgreement,
    });

    console.log('[REFERRAL_PAYMENT_COMPLETED] Allocations:', result.allocations);

    // Create conversion
    const proofJson = {
      externalRef,
      paymentLinkId: paymentLinkId ?? null,
      allocations: result.allocations.map((a) => ({
        role: a.role,
        participantId: a.participantId,
        amount: a.amount,
        currency: a.currency,
        description: a.description,
      })),
    };

    const { data: conversion, error: convError } = await adminClient
      .from('referral_conversions')
      .insert({
        program_id: programId,
        participant_id: consultantId,
        conversion_type: 'payment_completed',
        gross_amount: gross,
        currency,
        status: 'approved',
        proof_json: proofJson,
        approved_at: new Date().toISOString(),
        approved_by: 'system_payment_completed',
      })
      .select('id')
      .single();

    if (convError || !conversion) {
      console.error('[REFERRAL_PAYMENT_COMPLETED] Conversion insert failed:', convError);
      return NextResponse.json(
        { error: 'Failed to create conversion' },
        { status: 500 }
      );
    }

    // Write ledger entries (multi-beneficiary)
    const writeResult = await writeMultiBeneficiaryLedgerEntries(
      adminClient,
      conversion.id,
      result.allocations,
      gross,
      currency,
      programSlug,
      consultant.referral_code
    );

    return NextResponse.json({
      success: true,
      conversionId: conversion.id,
      allocations: result.allocations,
      ledgerCreated: writeResult.created,
      ledgerSkipped: writeResult.skipped,
    });
  } catch (error) {
    console.error('[REFERRAL_PAYMENT_COMPLETED] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function writeMultiBeneficiaryLedgerEntries(
  adminClient: ReturnType<typeof createAdminClient>,
  conversionId: string,
  allocations: Allocation[],
  grossAmount: number,
  currency: string,
  programSlug: string,
  consultantReferralCode: string
): Promise<{ created: number; skipped: number }> {
  const sourceRefText = conversionId.toString();

  const { data: partnerProgram } = await adminClient
    .from('partner_programs')
    .select('id')
    .eq('slug', programSlug)
    .single();

  if (!partnerProgram) {
    throw new Error(`Partner program not found for slug: ${programSlug}`);
  }

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
      console.warn(
        `[REFERRAL_PAYMENT_COMPLETED] No partner entity map for participant ${alloc.participantId}, skipping ledger`
      );
      continue;
    }

    const description = `${alloc.role} • ${alloc.description} • ${consultantReferralCode}`;

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
        console.log('[REFERRAL_PAYMENT_COMPLETED] Ledger entry exists (idempotent):', alloc.role);
      } else {
        throw error;
      }
    } else {
      created++;
      console.log('[REFERRAL_PAYMENT_COMPLETED] Ledger entry created:', alloc.role, alloc.amount);
    }
  }

  return { created, skipped };
}
