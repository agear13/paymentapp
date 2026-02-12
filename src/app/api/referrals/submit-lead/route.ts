import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { referralCode, name, email, phone, message, attributionId } = body;

    if (!referralCode || !name || !email) {
      return NextResponse.json(
        { error: 'Referral code, name, and email are required' },
        { status: 400 }
      );
    }

    // Find participant (using referral_participants)
    const { data: participant, error: participantError } = await supabase
      .from('referral_participants')
      .select('id, program_id, role')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    // Create lead (using referral_leads)
    const { data: lead, error: leadError } = await supabase
      .from('referral_leads')
      .insert({
        program_id: participant.program_id,
        participant_id: participant.id,
        attribution_id: attributionId || null,
        name,
        email,
        phone: phone || null,
        message: message || null,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Lead creation failed:', leadError);
      return NextResponse.json(
        { error: 'Failed to submit lead' },
        { status: 500 }
      );
    }

    // Auto-create conversion for lead_submitted (auto-approved) (using referral_conversions)
    const { data: conversion, error: conversionError } = await supabase
      .from('referral_conversions')
      .insert({
        program_id: participant.program_id,
        participant_id: participant.id,
        attribution_id: attributionId || null,
        conversion_type: 'lead_submitted',
        gross_amount: null,
        currency: 'USD',
        status: 'approved', // Auto-approve lead submissions
        proof_json: { 
          type: 'lead_form', 
          lead_id: lead.id,
          name,
          email 
        },
        approved_at: new Date().toISOString(),
        approved_by: 'system_auto',
      })
      .select()
      .single();

    if (conversionError) {
      console.error('[REFERRAL_SUBMIT_LEAD] Conversion creation failed:', conversionError);
      // Lead is still created, just log the error
    }
    // NOTE: lead_submitted conversions do NOT create ledger entries (tracking only).
    // Use "Mark Paid" for payment_completed + ledger.

    return NextResponse.json({ 
      success: true, 
      leadId: lead.id,
      conversionId: conversion?.id 
    });
  } catch (error) {
    console.error('Submit lead error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
