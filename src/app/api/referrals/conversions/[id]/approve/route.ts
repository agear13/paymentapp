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

    // Check admin authorization using user client
    const { isAdmin, user, error: authError } = await checkAdminAuth();
    
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: authError || 'Forbidden' },
        { status: authError === 'Authentication required' ? 401 : 403 }
      );
    }

    // Use admin client for all DB operations (bypasses RLS)
    const adminClient = createAdminClient();

    // Get conversion from referral_conversions table
    const { data: conversion, error: fetchError } = await adminClient
      .from('referral_conversions')
      .select('*')
      .eq('id', conversionId)
      .single();

    if (fetchError || !conversion) {
      console.error('Conversion fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Conversion not found' },
        { status: 404 }
      );
    }

    if (conversion.status === 'approved') {
      return NextResponse.json(
        { error: 'Conversion already approved' },
        { status: 400 }
      );
    }

    // Update conversion status using admin client
    const { error: updateError } = await adminClient
      .from('referral_conversions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.email || user.id,
      })
      .eq('id', conversionId);

    if (updateError) {
      console.error('Failed to update conversion:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve conversion' },
        { status: 500 }
      );
    }

    // Create partner ledger entry (uses admin client internally)
    try {
      await createPartnerLedgerEntryForReferralConversion(conversionId);
    } catch (ledgerError) {
      console.error('Failed to create ledger entry:', ledgerError);
      // Rollback approval completely using admin client
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

    return NextResponse.json({ 
      success: true,
      message: 'Conversion approved and added to partner ledger'
    });
  } catch (error) {
    console.error('Approve conversion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
