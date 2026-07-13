/**
 * Maps persisted participant payload → Commercial OS engine inputs.
 *
 * Single adapter for settlement and accounting derivation modules.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { AccountingExportParticipantInput } from '@/lib/commercial/accounting-export';
import type { SettlementReadinessInput } from '@/lib/commercial/settlement-readiness';
import { deriveInvoiceState } from '@/lib/commercial/invoice-lifecycle';
import { hasApprovedAgreement, isParticipantCompensationExempt } from '@/lib/operations/primitives/participant-earnings-primitives';
import { supplierLifecycle } from '@/lib/commercial/participant-lifecycle-primitives';

export type ParticipantWorkflowInputContext = {
  projectId?: string;
  projectName?: string | null;
};

function obligationType(participant: DemoParticipant): SettlementReadinessInput['obligation']['type'] {
  const kind = participant.commissionKind ?? 'fixed_amount';
  if (kind === 'pct_deal_value' || kind === 'pct_of_participant') return 'revenue_share';
  if (isParticipantCompensationExempt(participant)) return 'unpaid_internal';
  return 'fixed_fee';
}

function fundingStatus(
  participant: DemoParticipant
): SettlementReadinessInput['funding']['status'] {
  if (participant.payoutSettlementStatus === 'Paid') return 'paid';
  if (participant.payoutSettlementStatus === 'Approved') return 'cleared';
  if (participant.payoutSettlementStatus === 'Eligible') return 'partially_funded';
  return 'unfunded';
}

export function supplierLifecycleForParticipant(participant: DemoParticipant) {
  return supplierLifecycle(participant);
}

function buildInvoiceDetails(participant: DemoParticipant) {
  const draft = participant.paymentSetup?.draftInvoice;
  const so = participant.supplierOnboarding;
  const submitted = so?.submission?.submittedAt ?? null;
  const verified =
    participant.payoutVerificationConfirmed === true ||
    so?.lifecycle === 'APPROVED' ||
    so?.operator?.approvedAt;

  return {
    invoiceNotRequired: obligationType(participant) === 'unpaid_internal',
    invoiceGeneratedAt: draft?.createdAt ?? participant.approvedAt ?? null,
    invoiceSubmittedAt: submitted,
    invoiceVerifiedAt: verified ? so?.operator?.approvedAt ?? submitted : null,
    invoiceExportedAt: participant.paymentSetup?.xeroExportedAt ?? null,
    paymentReady: participant.payoutSettlementStatus === 'Approved',
    invoiceNumber: participant.paymentSetup?.xeroInvoiceNumber ?? null,
    supplierName: draft?.supplier ?? participant.name,
    invoiceDate: draft?.createdAt ?? null,
    dueDate: draft?.dueDate ?? null,
    invoiceAmount: draft?.total ?? participant.commissionValue ?? null,
    currency: draft?.currency ?? 'AUD',
  };
}

function buildTaxDetails(participant: DemoParticipant) {
  const abn = participant.supplierOnboarding?.abn;
  return {
    abn: abn?.abn ?? null,
    gstRegistered:
      participant.supplierOnboarding?.gst?.gstStatus === 'yes' ? true : abn?.abnNotApplicable ? null : false,
    businessName: abn?.businessName ?? null,
    abnVerified: abn?.abnVerified === true,
  };
}

function buildBankDetails(participant: DemoParticipant) {
  const bank = participant.supplierOnboarding?.payment?.bankDetails;
  return {
    bsb: bank?.bsb ?? null,
    accountNumber: bank?.accountNumber ?? null,
    accountName: bank?.accountName ?? null,
    bankName: null,
    paymentReference: null,
  };
}

/** Settlement engine input — accounting decoupled (not a settlement gate). */
export function buildParticipantSettlementInput(
  participant: DemoParticipant,
  context: ParticipantWorkflowInputContext = {}
): SettlementReadinessInput {
  const invoice = buildInvoiceDetails(participant);
  return {
    participant: {
      id: participant.id,
      name: participant.name,
      role: participant.role,
      email: participant.email ?? null,
    },
    agreement: {
      approved: hasApprovedAgreement(participant),
      approvedAt: participant.approvedAt ?? null,
      agreementGenerated: Boolean(participant.agreementUrl?.trim() || participant.agreementSharedAt),
    },
    invoice,
    taxDetails: buildTaxDetails(participant),
    bankDetails: buildBankDetails(participant),
    funding: {
      status: fundingStatus(participant),
      amount: participant.commissionValue ?? undefined,
      obligationAmount: participant.commissionValue ?? undefined,
      currency: invoice.currency ?? 'AUD',
    },
    accounting: {
      xeroStatus: 'not_required',
    },
    obligation: {
      amount: participant.commissionValue ?? 0,
      currency: invoice.currency ?? 'AUD',
      type: obligationType(participant),
    },
    currency: context.projectId ? undefined : invoice.currency ?? 'AUD',
  };
}

/** Accounting engine input — reads integration fields only. */
export function buildParticipantAccountingInput(
  participant: DemoParticipant,
  context: ParticipantWorkflowInputContext = {}
): AccountingExportParticipantInput {
  const invoice = buildInvoiceDetails(participant);
  const invoiceState = deriveInvoiceState(invoice);
  const ps = participant.paymentSetup;
  const xeroSync = ps?.xeroSyncStatus?.toLowerCase();

  let xeroStatus: AccountingExportParticipantInput['accounting']['xeroStatus'] = 'pending';
  if (obligationType(participant) === 'unpaid_internal') {
    xeroStatus = 'not_required';
  } else if (xeroSync === 'failed') {
    xeroStatus = 'failed';
  } else if (ps?.xeroExportedAt && xeroSync === 'synced') {
    xeroStatus = 'exported';
  } else if (ps?.xeroExportedAt) {
    xeroStatus = 'exported';
  } else if (ps?.xeroLastAttemptAt && ps?.xeroSyncStatus === 'pending') {
    xeroStatus = 'pending';
  }

  const bank = buildBankDetails(participant);
  const tax = buildTaxDetails(participant);

  return {
    participant: {
      id: participant.id,
      name: participant.name,
      role: participant.role,
    },
    agreement: {
      approved: hasApprovedAgreement(participant),
      agreementGenerated: Boolean(participant.agreementUrl?.trim()),
      agreementReference: null,
      projectName: context.projectName ?? null,
    },
    invoice: {
      state: invoiceState,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      invoiceAmount: invoice.invoiceAmount,
      supplierName: invoice.supplierName,
      description: participant.paymentSetup?.draftInvoice?.description ?? null,
    },
    taxDetails: {
      abn: tax.abn,
      gstRegistered: tax.gstRegistered,
      gstStatus: participant.supplierOnboarding?.gst?.gstStatus ?? 'pending',
      businessName: tax.businessName,
      abnValid: tax.abnVerified,
      abnNotApplicable: participant.supplierOnboarding?.abn?.abnNotApplicable === true,
    },
    bankDetails: {
      bsb: bank.bsb,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      complete: Boolean(bank.bsb && bank.accountNumber && bank.accountName),
    },
    funding: {
      status: fundingStatus(participant),
    },
    obligation: {
      amount: participant.commissionValue ?? 0,
      currency: invoice.currency ?? 'AUD',
      type: obligationType(participant),
    },
    accounting: {
      xeroStatus,
      exportApprovedAt: null,
      exportedAt: ps?.xeroExportedAt ?? null,
      providerReference: ps?.xeroInvoiceId ?? null,
      provider: 'xero',
      lastError: ps?.xeroFailureReason ?? null,
    },
  };
}
