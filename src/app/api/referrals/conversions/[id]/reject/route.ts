import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const conversionId = params.id;
    const body = await request.json();
    const { reason } = body;

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

    if (conversion.status === 'rejected') {
      return NextResponse.json(
        { error: 'Conversion already rejected' },
        { status: 400 }
      );
    }

    // Update conversion status
    const { error: updateError } = await supabase
      .from('conversions')
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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
