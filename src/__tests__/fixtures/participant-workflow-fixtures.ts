import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

export function approvedParticipantWithVerifiedPayout(deal: RecentDeal) {
  const p = buildProjectParticipant({
    name: 'Sarah',
    email: 'sarah@example.com',
    role: 'Contractor',
    project: deal,
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 1200,
    enableCustomerAttribution: false,
  });
  return {
    ...p,
    approvalStatus: 'Approved' as const,
    approvedAt: '2026-06-01T00:00:00.000Z',
    agreementUrl: `/participant/${p.participantPortalToken}`,
    agreementSharedAt: '2026-06-01T00:00:00.000Z',
    paymentSetup: {
      paymentRequestGeneratedAt: '2026-06-02T00:00:00.000Z',
      draftInvoice: {
        id: 'inv-1',
        createdAt: '2026-06-02T00:00:00.000Z',
        status: 'APPROVED' as const,
        supplier: 'Sarah Chen',
        participantId: p.id,
        agreementReference: null,
        projectName: deal.dealName,
        description: 'Contractor services',
        currency: 'AUD',
        subtotal: 1200,
        gstAmount: null,
        total: 1200,
        gstIncluded: false,
        gstStatus: 'no' as const,
        dueDate: null,
        lineItems: [],
      },
    },
    supplierOnboarding: {
      lifecycle: 'APPROVED' as const,
      payment: {
        preference: 'bank_account',
        bankDetails: {
          accountName: 'Sarah Chen',
          bsb: '062000',
          accountNumber: '12345678',
        },
        alternativePaymentMethod: null,
      },
      abn: {
        abn: '51824753556',
        abnNotApplicable: false,
        abnVerified: true,
        businessName: 'Sarah Promotions',
      },
      gst: { gstStatus: 'no' as const },
      submission: { submittedAt: '2026-06-03T00:00:00.000Z', declarationAccepted: true },
      operator: { approvedAt: '2026-06-04T00:00:00.000Z', xeroExportedAt: null, notes: null },
    },
    payoutVerificationConfirmed: true,
    payoutSettlementStatus: 'Approved' as const,
  };
}
