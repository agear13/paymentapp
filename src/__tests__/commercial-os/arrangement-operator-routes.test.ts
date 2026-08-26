import {
  arrangementMoneyAccountingPath,
  arrangementPeopleFocusPath,
  arrangementPersonOnboardPath,
  arrangementPersonReviewPath,
  arrangementWorkflowCtaHref,
} from '@/lib/commercial-os/arrangement-operator-routes';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { dashboardWorkflowCtaHref } from '@/lib/projects/workflow-cta-href';
import {
  projectOperatorReviewPath,
  projectPaymentRequestsPath,
  projectParticipantsPath,
  projectSettlementPath,
  projectSupplierOnboardingPath,
  projectXeroExportPath,
} from '@/lib/projects/project-routes';

const PROJECT_ID = 'proj-1';
const PARTICIPANT_ID = 'p-1';

describe('Phase 4B workflow CTA href resolver', () => {
  it('keeps dashboard defaults on /dashboard/projects/*', () => {
    expect(dashboardWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'send_payment_request')).toBe(
      projectPaymentRequestsPath(PROJECT_ID)
    );
    expect(dashboardWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'await_participant')).toBe(
      projectPaymentRequestsPath(PROJECT_ID)
    );
    expect(dashboardWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'review_payment')).toBe(
      projectOperatorReviewPath(PROJECT_ID, PARTICIPANT_ID)
    );
    expect(dashboardWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'xero_export')).toBe(
      projectXeroExportPath(PROJECT_ID)
    );
    expect(dashboardWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'settlement')).toBe(
      projectSettlementPath(PROJECT_ID)
    );
    expect(dashboardWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'send_agreement')).toBe(
      projectParticipantsPath(PROJECT_ID)
    );
    expect(projectSupplierOnboardingPath(PROJECT_ID)).toBe(
      `/dashboard/projects/${PROJECT_ID}/participants?focus=onboarding`
    );
  });

  it('maps the same destinations onto Commercial OS arrangement routes', () => {
    expect(arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'send_payment_request')).toBe(
      arrangementPeopleFocusPath(PROJECT_ID, 'payment-requests')
    );
    expect(arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'await_participant')).toBe(
      arrangementPeopleFocusPath(PROJECT_ID, 'payment-requests')
    );
    expect(arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'review_payment')).toBe(
      arrangementPersonReviewPath(PROJECT_ID, PARTICIPANT_ID)
    );
    expect(arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'xero_export')).toBe(
      arrangementMoneyAccountingPath(PROJECT_ID)
    );
    expect(arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'settlement')).toBe(
      COMMERCIAL_OS_ROUTES.settlement
    );
    expect(arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, 'send_agreement')).toBe(
      COMMERCIAL_OS_ROUTES.arrangementPeople(PROJECT_ID)
    );
    expect(arrangementPersonOnboardPath(PROJECT_ID, PARTICIPANT_ID)).toBe(
      `/workspace/arrangements/${PROJECT_ID}/people/${PARTICIPANT_ID}/onboard`
    );
  });

  it('never emits /dashboard/projects from the OS resolver', () => {
    const destinations = [
      'configure_earnings',
      'send_agreement',
      'await_participant',
      'send_payment_request',
      'review_payment',
      'xero_export',
      'settlement',
      'none',
    ] as const;
    for (const destination of destinations) {
      const href = arrangementWorkflowCtaHref(PROJECT_ID, PARTICIPANT_ID, destination);
      expect(href).not.toContain('/dashboard/projects');
      expect(href.startsWith('/workspace/')).toBe(true);
    }
  });
});
