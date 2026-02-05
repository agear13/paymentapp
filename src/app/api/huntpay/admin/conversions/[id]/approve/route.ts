import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPartnerLedgerEntryForConversion } from '@/lib/huntpay/partners-integration';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin email allowlist check
    // const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    // if (!adminEmails.includes(user.email || '')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const conversionId = params.id;

    // Get conversion
    const { data: conversion, error: fetchError } = await supabase
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .single();

    if (fetchError || !conversion) {
      return NextResponse.json({ error: 'Conversion not found' }, { status: 404 });
    }

    if (conversion.status === 'approved') {
      return NextResponse.json({
        success: true,
        message: 'Already approved',
        alreadyApproved: true,
      });
    }

    // Update conversion status
    const { error: updateError } = await supabase
      .from('conversions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email,
      })
      .eq('id', conversionId);

    if (updateError) {
      throw new Error('Failed to approve conversion');
    }

    // Create partner ledger entry (THIS IS THE KEY INTEGRATION)
    try {
      await createPartnerLedgerEntryForConversion(conversionId);
    } catch (ledgerError) {
      console.error('Failed to create ledger entry:', ledgerError);
      // Rollback approval
      await supabase
        .from('conversions')
        .update({ status: 'pending' })
        .eq('id', conversionId);
      
      throw new Error('Failed to create partner ledger entry');
    }

    return NextResponse.json({
      success: true,
      message: 'Conversion approved and ledger entry created',
    });
  } catch (error: any) {
    console.error('Approve conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve conversion' },
      { status: 500 }
    );
  }
}
