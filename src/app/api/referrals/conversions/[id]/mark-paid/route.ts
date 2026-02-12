/**
 * POST /api/referrals/conversions/[id]/mark-paid
 * Admin-only: Mark a conversion as payment_completed with manual allocations and create ledger entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPartnerLedgerEntryForReferralConversion } from '@/lib/referrals/partners-integration';
import { checkAdminAuth } from '@/lib/auth/admin';

interface AllocationInput {
  referral_participant_id: string;
  amount: number;
  description?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversionId = params.id;

    const { isAdmin, user, error: authError } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: authError || 'Forbidden' },
        { status: authError === 'Authentication required' ? 401 : 403 }
      );
    }

    const body = await request.json();
    const {
      gross_amount: grossAmount,
      currency = 'USD',
      allocations,
      notes,
    } = body;

    if (
      grossAmount == null ||
      typeof grossAmount !== 'number' ||
      grossAmount <= 0
    ) {
      return NextResponse.json(
        { error: 'gross_amount must be a positive number' },
        { status: 400 }
      );
    }

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { error: 'allocations must be a non-empty array' },
        { status: 400 }
      );
    }

    const validAllocations: AllocationInput[] = allocations.filter(
      (a: unknown) =>
        a &&
        typeof a === 'object' &&
        typeof (a as AllocationInput).referral_participant_id === 'string' &&
        typeof (a as AllocationInput).amount === 'number' &&
        (a as AllocationInput).amount > 0
    );

    if (validAllocations.length === 0) {
      return NextResponse.json(
        { error: 'Each allocation must have referral_participant_id (uuid) and amount (positive number)' },
        { status: 400 }
      );
    }

    console.log('[REFERRAL_MARK_PAID] Admin triggered:', {
      conversionId,
      adminEmail: user.email,
      grossAmount,
      allocationsCount: validAllocations.length,
    });

    const adminClient = createAdminClient();

    const { data: conversion, error: fetchError } = await adminClient
      .from('referral_conversions')
      .select('id, program_id, conversion_type, status')
      .eq('id', conversionId)
      .single();

    if (fetchError || !conversion) {
      console.error('[REFERRAL_MARK_PAID] Conversion not found:', fetchError);
      return NextResponse.json(
        { error: 'Conversion not found' },
        { status: 404 }
      );
    }

    const allowedTypes = ['lead_submitted', 'booking_confirmed'];
    if (!allowedTypes.includes(conversion.conversion_type)) {
      return NextResponse.json(
        {
          error: `Cannot mark paid: conversion is already ${conversion.conversion_type}`,
        },
        { status: 400 }
      );
    }

    if (conversion.status !== 'approved' && conversion.status !== 'pending') {
      return NextResponse.json(
        { error: 'Conversion must be approved or pending to mark paid' },
        { status: 400 }
      );
    }

    const proofJson = {
      allocations: validAllocations.map((a) => ({
        referral_participant_id: a.referral_participant_id,
        participantId: a.referral_participant_id,
        amount: a.amount,
        currency,
        description: a.description || `Manual allocation`,
      })),
      notes: notes ?? null,
    };

    const { error: updateError } = await adminClient
      .from('referral_conversions')
      .update({
        conversion_type: 'payment_completed',
        gross_amount: grossAmount,
        currency,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.email || user.id,
        proof_json: proofJson,
      })
      .eq('id', conversionId);

    if (updateError) {
      console.error('[REFERRAL_MARK_PAID] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update conversion' },
        { status: 500 }
      );
    }

    const result = await createPartnerLedgerEntryForReferralConversion(
      conversionId,
      { isReplay: false }
    );

    console.log('[REFERRAL_LEDGER_MULTI] created:', result.created, 'skipped:', result.skipped);

    return NextResponse.json({
      success: true,
      message: 'Conversion marked as paid and ledger entries created',
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('[REFERRAL_MARK_PAID] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
