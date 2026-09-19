import fs from 'fs';
import path from 'path';
import { buildWorkflowAgreementHubSummary } from '@/lib/workflows/agreement-intelligence/hub-summary';
import { agreementPaymentScheduleFromExtraction } from '@/lib/commercial-os/payment-schedule-presentation';
import { hubObligationMetricPresentation } from '@/lib/commercial-os/hub-obligation-metric';
import { abcRetailAcmeSupplyProductionExtraction } from '@/__tests__/commercial-incentive/extraction-fixture';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';

function hubFor(extraction: ReturnType<typeof abcRetailAcmeSupplyProductionExtraction>) {
  return buildWorkflowAgreementHubSummary({
    lifecycleStatus: 'READY_FOR_REVIEW',
    configuration: { defaultSettlementCurrency: 'AUD', operatorApprovalRequired: true },
    agreement: {
      id: 'agr-abc',
      organizationId: 'org-a',
      organizationWorkflowId: 'wf-ai',
      sourceType: 'PASTE',
      title: extraction.projectName.value,
      originalFilename: null,
      mimeType: null,
      fileSizeBytes: null,
      storageKey: null,
      sourceText: 'text',
      extractionStatus: 'READY_FOR_REVIEW',
      extractionResult: extraction,
      commercialGraph: null,
      approvedStructure: null,
      extractionError: null,
      extractedAt: '2026-09-17T00:00:00.000Z',
      approvedAt: null,
      approvedByUserId: null,
      pilotDealId: null,
      bootstrapError: null,
      bootstrappedAt: null,
      isCurrent: true,
      createdAt: '2026-09-17T00:00:00.000Z',
      updatedAt: '2026-09-17T00:00:00.000Z',
    },
  });
}

describe('hub obligation metric presentation', () => {
  it('derives four payment obligations from the production ABC Retail extraction without changing party obligationCount', () => {
    const extraction = abcRetailAcmeSupplyProductionExtraction();
    expect(extraction.projectValue.value).toBe(100_000);
    expect(extraction.parties[0]?.compensationTerms).toHaveLength(4);
    expect(extraction.parties[0]?.compensationTerms?.[0]?.amount.value).toBe(25_000);
    expect(extraction.parties[0]?.compensationTerms?.[0]?.trigger.value).toBe(
      'Within 30 days of invoice date'
    );

    const hub = hubFor(extraction);
    expect(hub.obligationCount).toBe(0);

    const schedule = agreementPaymentScheduleFromExtraction(extraction);
    expect(schedule?.milestoneCount).toBe(4);
    expect(schedule?.equalMilestoneAmount).toBe(25_000);
    expect(schedule?.totalAmount).toBe(100_000);

    const metric = hubObligationMetricPresentation({
      partyObligationCount: hub.obligationCount,
      paymentSchedule: schedule,
    });
    expect(metric.label).toBe('Payment obligations');
    expect(metric.value).toBe(4);
  });

  it('keeps Obligations identified when only party compensation exists', () => {
    const metric = hubObligationMetricPresentation({
      partyObligationCount: 2,
      paymentSchedule: null,
    });
    expect(metric.label).toBe('Obligations identified');
    expect(metric.value).toBe(2);
  });

  it('does not remap a revenue-share party into a payment-obligation count', () => {
    const extraction = abcRetailAcmeSupplyProductionExtraction();
    extraction.parties = [
      testParty({
        id: 'apex',
        name: field('Apex Promotions'),
        participationModel: field('revenue_share'),
        revenueSharePct: field(20),
        compensationTerms: [],
      }),
    ];
    extraction.paymentTerms = [];
    extraction.projectValue = field(null, 'absent');

    const hub = hubFor(extraction);
    expect(hub.obligationCount).toBe(1);
    expect(hub.revenueShareCount).toBe(1);

    const metric = hubObligationMetricPresentation({
      partyObligationCount: hub.obligationCount,
      paymentSchedule: agreementPaymentScheduleFromExtraction(extraction),
    });
    expect(metric.label).toBe('Obligations identified');
    expect(metric.value).toBe(1);
  });

  it('uses the presentation helper on the Agreement Intelligence hub', () => {
    const hubScreen = [
      path.join(process.cwd(), 'components/journey/lovable/agreement-intelligence-hub-screen.tsx'),
      path.join(process.cwd(), 'src/components/journey/lovable/agreement-intelligence-hub-screen.tsx'),
    ].find((file) => fs.existsSync(file));
    if (!hubScreen) throw new Error('Could not find agreement-intelligence-hub-screen.tsx');
    const source = fs.readFileSync(hubScreen, 'utf8');
    expect(source).toContain('hubObligationMetricPresentation');
    expect(source).toContain('obligationMetric.label');
    expect(source).not.toContain('label="Obligations identified"');
  });
});
