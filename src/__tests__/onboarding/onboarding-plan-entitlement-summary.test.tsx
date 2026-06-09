/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { OnboardingPlanEntitlementSummary } from '@/components/onboarding/onboarding-plan-entitlement-summary';
import {
  GROWTH_PLAN_SUMMARY,
  PROFESSIONAL_PLAN_SUMMARY,
  STARTER_PLAN_INCLUDES,
  STARTER_UPGRADE_COMPARISON,
} from '@/lib/entitlements/plan-onboarding-summaries';

describe('OnboardingPlanEntitlementSummary', () => {
  it('renders Starter plan includes and upgrade comparison', () => {
    const onSelectProfessional = jest.fn();
    render(
      <OnboardingPlanEntitlementSummary
        planId="starter"
        onSelectProfessional={onSelectProfessional}
      />
    );

    expect(screen.getByText('Starter Plan Includes:')).toBeInTheDocument();
    for (const item of STARTER_PLAN_INCLUDES) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: STARTER_UPGRADE_COMPARISON })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: STARTER_UPGRADE_COMPARISON }));
    expect(onSelectProfessional).toHaveBeenCalledTimes(1);
  });

  it('renders Professional plan summary', () => {
    render(<OnboardingPlanEntitlementSummary planId="professional" />);
    expect(screen.getByText(PROFESSIONAL_PLAN_SUMMARY)).toBeInTheDocument();
  });

  it('renders Growth plan summary', () => {
    render(<OnboardingPlanEntitlementSummary planId="growth" />);
    expect(screen.getByText(GROWTH_PLAN_SUMMARY)).toBeInTheDocument();
  });
});
