/**
 * Auto-create referral conversion when payment is confirmed.
 * Called from payment-confirmation.ts (Stripe) and hedera/transaction-checker (Hedera).
 * Attribution: Supabase payment_link_referral_attributions only.
 * Idempotent: external_ref = 'payment_event:' + paymentEventId (Render Postgres payment_events.id).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createPartnerLedgerEntryForReferralConversion } from '@/lib/referrals/partners-integration';
import { log } from '@/lib/logger';

export interface CreateReferralConversionParams {
  paymentLinkId: string;
  /** Idempotency key: Render Postgres payment_events.id (uuid) */
  paymentEventId: string;
  grossAmount: number;
  currency: string;
  provider: 'stripe' | 'hedera' | 'wise' | 'manual';
  stripePaymentIntentId?: string;
  hederaTransactionId?: string;
  wiseTransferId?: string;
}

export interface CreateReferralConversionResult {
  created: boolean;
  skipped?: boolean;
  conversionId?: string;
  reason?: string;
  ledgerCreated?: number;
  ledgerSkipped?: number;
}

/**
 * Create referral_conversions row in Supabase when payment is confirmed.
 * Attribution from Supabase payment_link_referral_attributions only.
 */
export async function createReferralConversionFromPaymentConfirmed(
  params: CreateReferralConversionParams
): Promise<CreateReferralConversionResult> {
  const { paymentLinkId, paymentEventId, grossAmount, currency, provider } = params;

  log.info(
    { paymentEventId, paymentLinkId, amount: grossAmount, currency },
    '[REFERRAL_AUTO_CONVERSION] start'
  );

  const adminClient = createAdminClient();

  try {
    // 1. Lookup attribution ONLY via Supabase
    const { data: attrRows, error: attrError } = await adminClient
      .from('payment_link_referral_attributions')
      .select('program_id, participant_id, advocate_referral_code')
      .eq('payment_link_id', paymentLinkId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (attrError) {
      log.error(
        { paymentEventId, paymentLinkId, error: attrError },
        '[REFERRAL_AUTO_CONVERSION] fail'
      );
      throw attrError;
    }

    const attrRow = attrRows?.[0];
    if (!attrRow?.program_id || !attrRow?.participant_id) {
      log.info(
        { paymentEventId, paymentLinkId },
        '[REFERRAL_AUTO_CONVERSION] attribution_missing'
      );
      return { created: false, reason: 'no referral attribution' };
    }

    log.info(
      { paymentEventId, paymentLinkId, programId: attrRow.program_id, participantId: attrRow.participant_id },
      '[REFERRAL_AUTO_CONVERSION] attribution_found'
    );

    const externalRef = `payment_event:${paymentEventId}`;

    const proofJson = {
      payment_event_id: paymentEventId,
      payment_link_id: paymentLinkId,
      stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
      hedera_transaction_id: params.hederaTransactionId ?? null,
      advocate_referral_code: attrRow.advocate_referral_code ?? null,
    };

    // 2. Check idempotency (unique index on external_ref)
    const { data: existing } = await adminClient
      .from('referral_conversions')
      .select('id')
      .eq('external_ref', externalRef)
      .single();

    if (existing) {
      log.info(
        { externalRef, existingConversionId: existing.id },
        '[REFERRAL_AUTO_CONVERSION] conversion_skipped_idempotent'
      );
      return { created: false, skipped: true, conversionId: existing.id, reason: 'idempotent' };
    }

    // 3. Insert conversion
    const { data: conversion, error: insertError } = await adminClient
      .from('referral_conversions')
      .insert({
        program_id: attrRow.program_id,
        participant_id: attrRow.participant_id,
        conversion_type: 'payment_completed',
        gross_amount: grossAmount,
        currency,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'system_auto',
        external_ref: externalRef,
        proof_json: proofJson,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        log.info(
          { externalRef },
          '[REFERRAL_AUTO_CONVERSION] conversion_skipped_idempotent'
        );
        return { created: false, skipped: true, reason: 'idempotent' };
      }
      throw insertError;
    }

    if (!conversion) {
      throw new Error('Conversion insert returned no data');
    }

    log.info(
      { conversionId: conversion.id, externalRef },
      '[REFERRAL_AUTO_CONVERSION] conversion_created'
    );

    // 4. Create partner ledger entries
    try {
      const ledgerResult = await createPartnerLedgerEntryForReferralConversion(conversion.id);
      log.info(
        { conversionId: conversion.id, created: ledgerResult.created, skipped: ledgerResult.skipped },
        '[REFERRAL_AUTO_CONVERSION] ledger_created'
      );
      return {
        created: true,
        conversionId: conversion.id,
        ledgerCreated: ledgerResult.created,
        ledgerSkipped: ledgerResult.skipped,
      };
    } catch (ledgerErr) {
      log.error(
        { conversionId: conversion.id, err: ledgerErr },
        '[REFERRAL_AUTO_CONVERSION] ledger failed (conversion created)'
      );
      return {
        created: true,
        conversionId: conversion.id,
        ledgerCreated: 0,
        ledgerSkipped: 0,
        reason: 'ledger creation failed',
      };
    }
  } catch (err) {
    log.error(
      { error: err, paymentEventId, paymentLinkId },
      '[REFERRAL_AUTO_CONVERSION] fail'
    );
    throw err;
  }
}
