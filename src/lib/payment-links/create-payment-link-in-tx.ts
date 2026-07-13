import { randomUUID } from 'crypto';
import type { PaymentMethod, Prisma, payment_links } from '@prisma/client';
import type { z } from 'zod';
import { CreatePaymentLinkSchema } from '@/lib/validations/schemas';
import {
  formatAutoInvoiceReference,
  getNextInvoiceReferenceSequence,
  normalizeInvoiceReference,
} from '@/lib/payment-links/invoice-reference';
import { buildLayerFieldsForCreate } from '@/lib/payments/payment-layers';
import { inheritCommercialTimingForInvoice } from '@/lib/commercial-timing/inherit-commercial-timing';
import { commercialTimingFromDeal } from '@/lib/commercial-timing/commercial-timing-payload';
import { commercialTimingToPaymentLinkJson } from '@/lib/commercial-timing/payment-link-timing';
import { dealRowToRecentDeal } from '@/lib/deal-network-demo/pilot-snapshot.server';

export type WiseInsertContext = {
  metadata: Record<string, unknown>;
};

export type CreatePaymentLinkInTxInput = {
  organizationId: string;
  shortCode: string;
  /** Supabase user id for audit, or null for system (recurring scheduler). */
  actorUserId: string | null;
  validatedData: z.infer<typeof CreatePaymentLinkSchema>;
  invoiceOnly: boolean;
  resolvedPaymentMethod: PaymentMethod | null;
  effectiveInvoiceCurrency: string;
  /** Merchant accounting / reporting currency (defaults to commercial when omitted). */
  accountingCurrency?: string;
  requestedInvoiceReference: string | null;
  wiseContext: WiseInsertContext | null;
  pilotDealIdToStore: string | null;
};

/**
 * Creates `payment_links` row plus CREATED event, optional Wise event, and audit log.
 * Caller must wrap in a transaction (Serializable recommended for auto invoice refs).
 */
export async function insertPaymentLinkInTransaction(
  tx: Prisma.TransactionClient,
  input: CreatePaymentLinkInTxInput
): Promise<payment_links> {
  const {
    organizationId: dbOrgId,
    shortCode,
    actorUserId,
    validatedData,
    invoiceOnly,
    resolvedPaymentMethod,
    effectiveInvoiceCurrency,
    requestedInvoiceReference,
    wiseContext,
    pilotDealIdToStore,
  } = input;

  const commercialCurrency = effectiveInvoiceCurrency.toUpperCase();
  const accountingCurrency = (input.accountingCurrency ?? commercialCurrency).toUpperCase();
  const layerFields = buildLayerFieldsForCreate({
    commercialCurrency,
    commercialAmount: validatedData.amount,
    accountingCurrency,
    accountingAmount: validatedData.amount,
  });

  if (typeof dbOrgId !== 'string' || !dbOrgId.trim()) {
    throw new Error('Missing server org context');
  }
  if (validatedData.organizationId !== dbOrgId) {
    throw new Error('Organization mismatch between CreatePaymentLink payload and insert context');
  }

  const now = new Date();
  let invoiceReferenceToStore = requestedInvoiceReference;
  if (!invoiceReferenceToStore) {
    const nextSequence = await getNextInvoiceReferenceSequence(tx, dbOrgId);
    invoiceReferenceToStore = formatAutoInvoiceReference(nextSequence);
  }

  const duplicateInvoiceReference = await tx.payment_links.findFirst({
    where: {
      organization_id: dbOrgId,
      invoice_reference: invoiceReferenceToStore,
    },
    select: { id: true },
  });
  if (duplicateInvoiceReference) {
    throw new Error(`DUPLICATE_INVOICE_REFERENCE:${invoiceReferenceToStore}`);
  }

  const linkId = randomUUID();

  const hederaCheckoutMode =
    !invoiceOnly && resolvedPaymentMethod === 'HEDERA'
      ? validatedData.hederaCheckoutMode ?? 'INTERACTIVE'
      : null;

  const isCrypto = !invoiceOnly && resolvedPaymentMethod === 'CRYPTO';
  const isManualBank = !invoiceOnly && resolvedPaymentMethod === 'MANUAL_BANK';

  let commercialTimingJson = commercialTimingToPaymentLinkJson(
    validatedData.commercialTiming ?? null
  );
  if (!commercialTimingJson && pilotDealIdToStore) {
    const dealRow = await tx.deal_network_pilot_deals.findUnique({
      where: { id: pilotDealIdToStore },
    });
    if (dealRow) {
      const inherited = inheritCommercialTimingForInvoice(
        commercialTimingFromDeal(dealRowToRecentDeal(dealRow))
      );
      commercialTimingJson = commercialTimingToPaymentLinkJson(inherited);
    }
  }

  const linkCreateData: Record<string, unknown> = {
    id: linkId,
    organization_id: dbOrgId,
    short_code: shortCode,
    status: 'OPEN',
    payment_method: resolvedPaymentMethod,
    amount: validatedData.amount,
    currency: layerFields.currency,
    invoice_currency: layerFields.invoice_currency,
    commercial_currency: layerFields.commercial_currency,
    commercial_amount: layerFields.commercial_amount,
    accounting_currency: layerFields.accounting_currency,
    accounting_amount: layerFields.accounting_amount,
    base_currency: layerFields.base_currency,
    base_amount: layerFields.base_amount,
    description: validatedData.description,
    invoice_reference: invoiceReferenceToStore,
    invoice_date: validatedData.invoiceDate
      ? new Date(validatedData.invoiceDate as string)
      : now,
    customer_email: validatedData.customerEmail || null,
    customer_name: validatedData.customerName || null,
    customer_phone: validatedData.customerPhone || null,
    due_date: validatedData.dueDate ? new Date(validatedData.dueDate as string) : null,
    expires_at: validatedData.expiresAt ? new Date(validatedData.expiresAt as string) : null,
    invoice_only_mode: invoiceOnly,
    hedera_checkout_mode: hederaCheckoutMode,
    crypto_network: isCrypto ? (validatedData.cryptoNetwork?.trim() ?? null) : null,
    crypto_address: isCrypto ? (validatedData.cryptoAddress?.trim() ?? null) : null,
    crypto_currency: isCrypto ? (validatedData.cryptoCurrency?.trim() ?? null) : null,
    crypto_memo: isCrypto ? (validatedData.cryptoMemo?.trim() || null) : null,
    crypto_instructions: isCrypto ? (validatedData.cryptoInstructions?.trim() || null) : null,
    manual_bank_recipient_name: isManualBank
      ? validatedData.manualBankRecipientName?.trim() ?? null
      : null,
    manual_bank_currency: isManualBank ? validatedData.manualBankCurrency?.trim() ?? null : null,
    manual_bank_destination_type: isManualBank
      ? validatedData.manualBankDestinationType?.trim() ?? null
      : null,
    manual_bank_bank_name: isManualBank ? validatedData.manualBankBankName?.trim() || null : null,
    manual_bank_account_number: isManualBank
      ? validatedData.manualBankAccountNumber?.trim() || null
      : null,
    manual_bank_iban: isManualBank ? validatedData.manualBankIban?.trim() || null : null,
    manual_bank_swift_bic: isManualBank ? validatedData.manualBankSwiftBic?.trim() || null : null,
    manual_bank_routing_sort_code: isManualBank
      ? validatedData.manualBankRoutingSortCode?.trim() || null
      : null,
    manual_bank_wise_reference: isManualBank
      ? validatedData.manualBankWiseReference?.trim() || null
      : null,
    manual_bank_revolut_handle: isManualBank
      ? validatedData.manualBankRevolutHandle?.trim() || null
      : null,
    manual_bank_instructions: isManualBank
      ? validatedData.manualBankInstructions?.trim() || null
      : null,
    attachment_storage_key: validatedData.attachment?.storageKey ?? null,
    attachment_bucket: validatedData.attachment?.bucket ?? null,
    attachment_filename: validatedData.attachment?.filename ?? null,
    attachment_mime_type: validatedData.attachment?.mimeType ?? null,
    attachment_size_bytes: validatedData.attachment?.sizeBytes ?? null,
    created_at: now,
    updated_at: now,
    wise_status: wiseContext ? 'INSTRUCTIONS_READY' : null,
    pilot_deal_id: pilotDealIdToStore,
    commercial_timing: commercialTimingJson ?? null,
  };

  const link = await tx.payment_links.create({
    data: linkCreateData as Prisma.payment_linksUncheckedCreateInput,
  });

  await tx.payment_events.create({
    data: {
      id: randomUUID(),
      payment_link_id: link.id,
      event_type: 'CREATED',
      pilot_deal_id: pilotDealIdToStore,
      metadata: {
        createdBy: actorUserId ?? 'recurring-scheduler',
      },
      created_at: now,
    },
  });

  if (wiseContext) {
    await tx.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: link.id,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'WISE',
        pilot_deal_id: pilotDealIdToStore,
        metadata: wiseContext.metadata as object,
        created_at: now,
      },
    });
  }

  await tx.audit_logs.create({
    data: {
      id: randomUUID(),
      organization_id: dbOrgId,
      user_id: actorUserId,
      entity_type: 'PaymentLink',
      entity_id: link.id,
      action: 'CREATE',
      new_values: actorUserId
        ? {
            shortCode,
            amount: validatedData.amount.toString(),
            currency: validatedData.currency,
          }
        : {
            shortCode,
            amount: validatedData.amount.toString(),
            currency: validatedData.currency,
            source: 'recurring_template',
          },
      created_at: now,
    },
  });

  return link;
}
