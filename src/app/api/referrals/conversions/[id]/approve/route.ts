import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createPartnerLedgerEntryForReferralConversion } from '@/lib/referrals/partners-integration';
import { checkAdminAuth } from '@/lib/auth/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const conversionId = params.id;

    // Check admin authorization
    const { isAdmin, user, error: authError } = await checkAdminAuth();
    
    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: authError || 'Forbidden' },
        { status: authError === 'Authentication required' ? 401 : 403 }
      );
    }

    // Get conversion
    const { data: conversion, error: fetchError } = await supabase
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .single();

    if (fetchError || !conversion) {
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

    // Update conversion status
    const { error: updateError } = await supabase
      .from('conversions')
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

    // Create partner ledger entry
    try {
      await createPartnerLedgerEntryForReferralConversion(conversionId);
    } catch (ledgerError) {
      console.error('Failed to create ledger entry:', ledgerError);
      // Rollback approval completely
      await supabase
        .from('conversions')
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
