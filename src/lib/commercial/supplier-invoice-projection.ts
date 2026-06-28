import type { DraftInvoice, GSTStatus } from '@/lib/commercial/supplier-onboarding';
import type { DraftInvoiceStatus, PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';

export type SupplierGstTaxTreatment = {
  gstStatus: GSTStatus;
  displayStatus: 'GST Registered' | 'Not Registered for GST' | 'Overseas Supplier' | 'Pending';
  gstIncluded: boolean;
  invoiceLineTaxType: 'GST' | 'EXEMPT' | 'PENDING';
  xeroTaxCode: 'INPUT' | 'NONE' | 'EXEMPTEXPENSES';
};

export function getSupplierGstTaxTreatment(gstStatus: GSTStatus): SupplierGstTaxTreatment {
  switch (gstStatus) {
    case 'yes':
      return {
        gstStatus,
        displayStatus: 'GST Registered',
        gstIncluded: true,
        invoiceLineTaxType: 'GST',
        xeroTaxCode: 'INPUT',
      };
    case 'no':
      return {
        gstStatus,
        displayStatus: 'Not Registered for GST',
        gstIncluded: false,
        invoiceLineTaxType: 'EXEMPT',
        xeroTaxCode: 'NONE',
      };
    case 'not_applicable':
      return {
        gstStatus,
        displayStatus: 'Overseas Supplier',
        gstIncluded: false,
        invoiceLineTaxType: 'EXEMPT',
        xeroTaxCode: 'EXEMPTEXPENSES',
      };
    case 'pending':
    default:
      return {
        gstStatus: 'pending',
        displayStatus: 'Pending',
        gstIncluded: false,
        invoiceLineTaxType: 'PENDING',
        xeroTaxCode: 'NONE',
      };
  }
}

export function buildPersistedDraftInvoiceProjection(args: {
  derived: DraftInvoice;
  existing?: PersistedDraftInvoice;
  id: string;
  createdAt: string;
  status: DraftInvoiceStatus;
  supplier: string;
  participantId: string;
  agreementReference?: string | null;
  projectName: string;
}): PersistedDraftInvoice {
  const treatment = getSupplierGstTaxTreatment(args.derived.gstStatus);

  return {
    id: args.existing?.id ?? args.id,
    createdAt: args.existing?.createdAt ?? args.createdAt,
    status: args.status,
    supplier: args.supplier,
    participantId: args.participantId,
    agreementReference: args.agreementReference ?? args.derived.agreementReference ?? null,
    projectName: args.projectName,
    description: args.derived.description,
    currency: args.derived.currency,
    subtotal: args.derived.subtotal,
    gstAmount: args.derived.gstAmount,
    total: args.derived.total,
    gstIncluded: treatment.gstIncluded,
    gstStatus: args.derived.gstStatus,
    dueDate: args.derived.dueDate ?? null,
    lineItems: args.derived.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      taxType: treatment.xeroTaxCode,
    })),
  };
}
