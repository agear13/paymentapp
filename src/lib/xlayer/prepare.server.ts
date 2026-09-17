import 'server-only';

import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { prisma } from '@/lib/server/prisma';
import { getEarlyPaymentIncentiveDecision } from '@/lib/commercial-incentive/store.server';
import { AGREEMENT_INTELLIGENCE_SLUG } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import {
  isXlayerCommitmentsEnabled,
} from '@/lib/xlayer/chain';
import {
  amountMinorUnitsFromExtraction,
  buyerLabelFromExtraction,
  currencyFromExtraction,
  dueDateUnixFromExtraction,
  incentiveSnapshotFromDecision,
  offchainStageFromAgreement,
  originalDueLabelFromExtraction,
  purposeFromExtraction,
  supplierLabelFromExtraction,
} from '@/lib/xlayer/derive-commitment';
import { computeTermsHash } from '@/lib/xlayer/terms-hash';
import {
  emptyCommitmentView,
  getCommitmentForAgreement,
  upsertPreparedCommitment,
  writeCommitmentAudit,
} from '@/lib/xlayer/store.server';
import type { XlayerCommitmentPreview, XlayerCommitmentView } from '@/lib/xlayer/types';

function extractionOf(value: unknown): ExtractionResult | null {
  if (!value || typeof value !== 'object') return null;
  return value as ExtractionResult;
}

export async function loadOrganizationAgreement(input: {
  organizationId: string;
  agreementId: string;
}) {
  return prisma.organization_workflow_agreements.findFirst({
    where: {
      id: input.agreementId,
      organization_id: input.organizationId,
      organization_workflows: { template_slug: AGREEMENT_INTELLIGENCE_SLUG },
    },
  });
}

export async function getXlayerCommitmentView(input: {
  organizationId: string;
  agreementId?: string;
}): Promise<XlayerCommitmentView> {
  const view = emptyCommitmentView();
  if (!input.agreementId) return view;
  view.commitment = await getCommitmentForAgreement({
    organizationId: input.organizationId,
    agreementId: input.agreementId,
  });

  const agreement = await loadOrganizationAgreement({
    organizationId: input.organizationId,
    agreementId: input.agreementId,
  });
  const extraction = extractionOf(agreement?.extraction_result);
  if (extraction && agreement) {
    try {
      const decision = await getEarlyPaymentIncentiveDecision(input.organizationId, agreement.id);
      const incentive = incentiveSnapshotFromDecision(decision);
      const sourceCurrency = currencyFromExtraction(extraction);
      const dueDateUnix = dueDateUnixFromExtraction(extraction);
      view.preview = {
        buyerLabel: buyerLabelFromExtraction(extraction),
        supplierLabel: supplierLabelFromExtraction(extraction),
        amountMinorUnits: amountMinorUnitsFromExtraction(extraction),
        sourceCurrency,
        settlementCurrency: sourceCurrency,
        dueDate: new Date(dueDateUnix * 1000).toISOString(),
        purpose: purposeFromExtraction(extraction),
        originalDueLabel: originalDueLabelFromExtraction(extraction),
        incentive,
      } satisfies XlayerCommitmentPreview;
    } catch {
      view.preview = null;
    }
  }
  return view;
}

export async function prepareXlayerCommitment(input: {
  organizationId: string;
  userId: string;
  agreementId: string;
}): Promise<XlayerCommitmentView> {
  if (!isXlayerCommitmentsEnabled()) {
    throw Object.assign(new Error('X Layer commitments are not configured'), {
      code: 'NOT_CONFIGURED',
      status: 409,
    });
  }

  const agreement = await loadOrganizationAgreement({
    organizationId: input.organizationId,
    agreementId: input.agreementId,
  });
  if (!agreement) {
    throw Object.assign(new Error('Agreement not found for this organization'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  const extraction = extractionOf(agreement.extraction_result);
  if (!extraction) {
    throw Object.assign(new Error('Agreement extraction is required before creating a commitment'), {
      code: 'MISSING_EXTRACTION',
      status: 409,
    });
  }

  const decision = await getEarlyPaymentIncentiveDecision(input.organizationId, agreement.id);
  const incentive = incentiveSnapshotFromDecision(decision);
  const amountMinorUnits = amountMinorUnitsFromExtraction(extraction);
  const sourceCurrency = currencyFromExtraction(extraction);
  const purpose = purposeFromExtraction(extraction);
  const dueDateUnix = dueDateUnixFromExtraction(extraction);
  const termsHash = computeTermsHash({
    sourceAgreementId: agreement.id,
    amountMinorUnits,
    sourceCurrency,
    settlementCurrency: sourceCurrency,
    dueDateUnix,
    purpose,
    incentive,
  });

  const record = await upsertPreparedCommitment({
    organizationId: input.organizationId,
    userId: input.userId,
    sourceAgreementId: agreement.id,
    pilotDealId: agreement.pilot_deal_id,
    buyerLabel: buyerLabelFromExtraction(extraction),
    supplierLabel: supplierLabelFromExtraction(extraction),
    amountMinorUnits,
    sourceCurrency,
    settlementCurrency: sourceCurrency,
    dueDate: new Date(dueDateUnix * 1000),
    purpose,
    termsHash,
    offchainLifecycleStage: offchainStageFromAgreement(agreement),
    originalDueLabel: originalDueLabelFromExtraction(extraction),
    incentive,
  });

  if (record.verificationStatus === 'prepared') {
    await writeCommitmentAudit({
      organizationId: input.organizationId,
      userId: input.userId,
      entityId: record.id,
      action: 'prepared',
      values: {
        sourceAgreementId: agreement.id,
        termsHash,
        amountMinorUnits,
        chainId: record.chainId,
      },
    });
  }

  const view = await getXlayerCommitmentView({
    organizationId: input.organizationId,
    agreementId: agreement.id,
  });
  view.commitment = record;
  return view;
}
