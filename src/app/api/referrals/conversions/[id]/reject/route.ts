import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversionId = params.id;
    const body = await request.json();
    const { reason } = body;

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

    if (conversion.status === 'rejected') {
      return NextResponse.json(
        { error: 'Conversion already rejected' },
        { status: 400 }
      );
    }

    // Update conversion status using admin client
    const { error: updateError } = await adminClient
      .from('referral_conversions')
      .update({
        status: 'rejected',
        proof_json: {
          ...conversion.proof_json,
          rejection_reason: reason || 'No reason provided',
          rejected_by: user.email || user.id,
          rejected_at: new Date().toISOString(),
        },
      })
      .eq('id', conversionId);

    if (updateError) {
      console.error('Failed to update conversion:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject conversion' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Conversion rejected'
    });
  } catch (error) {
    console.error('Reject conversion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
