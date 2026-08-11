/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PlanComparison } from '@/components/plans/plan-comparison';

jest.mock('@/lib/billing/start-saas-checkout.client', () => ({
  startSaasCheckout: jest.fn(),
}));

describe('PlanComparison', () => {
  it('renders all four plans from App_Pricing', () => {
    render(<PlanComparison currentPlan="starter" highlightPlan="professional" />);

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('shows Contact Sales for Enterprise not a dollar price', () => {
    render(<PlanComparison />);
    expect(screen.getAllByText('Contact Sales').length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$999/)).not.toBeInTheDocument();
  });

  it('marks current and recommended plans', () => {
    render(<PlanComparison currentPlan="starter" highlightPlan="professional" />);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('includes Payment Links on Professional column', () => {
    render(<PlanComparison />);
    expect(screen.getAllByText('Payment Links').length).toBeGreaterThan(0);
  });

  it('uses a scroll region and responsive card minimum widths', () => {
    render(<PlanComparison currentPlan="starter" />);

    expect(screen.getByTestId('plan-comparison-scroll-region')).toBeInTheDocument();
    expect(screen.getByTestId('plan-comparison-layout')).toBeInTheDocument();
    expect(screen.getByTestId('plan-comparison-card-growth')).toBeInTheDocument();
  });

  it('gives plan cards a readable minimum width class for scroll layout', () => {
    render(<PlanComparison />);
    const growthCard = screen.getByTestId('plan-comparison-card-growth');
    expect(growthCard.className).toContain('min-w-[280px]');
  });
});
