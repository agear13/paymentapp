import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { createPartnerLedgerEntryForReferralConversion } from '@/lib/referrals/partners-integration';
import { checkAdminAuth } from '@/lib/auth/admin';

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

    const adminClient = createAdminClient();

    const { data: conversion, error: fetchError } = await adminClient
      .from('referral_conversions')
      .select('*')
      .eq('id', conversionId)
      .single();

    if (fetchError || !conversion) {
      console.error('[REFERRAL_APPROVE] Conversion fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Conversion not found' },
        { status: 404 }
      );
    }

    console.log('[REFERRAL_APPROVE]', {
      conversionId,
      conversion_type: conversion.conversion_type,
      status_before: conversion.status,
    });

    if (conversion.status === 'approved') {
      return NextResponse.json(
        { error: 'Conversion already approved' },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from('referral_conversions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.email || user.id,
      })
      .eq('id', conversionId);

    if (updateError) {
      console.error('[REFERRAL_APPROVE] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve conversion' },
        { status: 500 }
      );
    }

    // CRITICAL: Only create ledger entries for payment_completed.
    // lead_submitted and booking_confirmed are tracking only; use Mark Paid to create ledger.
    if (conversion.conversion_type !== 'payment_completed') {
      console.log('[REFERRAL_APPROVE_SKIP_LEDGER]', {
        reason: 'not payment_completed',
        conversion_type: conversion.conversion_type,
      });
      return NextResponse.json({
        success: true,
        message: 'Conversion approved',
      });
    }

    try {
      const result = await createPartnerLedgerEntryForReferralConversion(conversionId);
      return NextResponse.json({
        success: true,
        message: 'Conversion approved and added to partner ledger',
        created: result.created,
        skipped: result.skipped,
      });
    } catch (ledgerError) {
      console.error('[REFERRAL_APPROVE] Ledger creation failed:', ledgerError);
      await adminClient
        .from('referral_conversions')
        .update({
          status: 'pending',
          approved_at: null,
          approved_by: null,
        })
        .eq('id', conversionId);

      return NextResponse.json(
        { error: 'Failed to create ledger entry. Conversion reverted to pending.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[REFERRAL_APPROVE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
