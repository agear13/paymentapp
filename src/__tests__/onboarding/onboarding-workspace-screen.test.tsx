/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import { OnboardingVisualProgress } from '@/components/provvypay/onboarding-visual-progress';
import { onboardingStepSubtext } from '@/lib/onboarding/operator-onboarding-types';

describe('OnboardingVisualProgress', () => {
  it('renders desktop phase labels without truncation', () => {
    render(<OnboardingVisualProgress step="workspace" />);

    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('does not use clipped label styles in the progress component', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/provvypay/onboarding-visual-progress.tsx'),
      'utf8'
    );

    expect(source).not.toContain('truncate');
  });
});

describe('Create workspace onboarding copy', () => {
  it('keeps workspace guidance in a single header subtext source', () => {
    const formSource = fs.readFileSync(
      path.join(process.cwd(), 'components/onboarding/workflow-onboarding-form.tsx'),
      'utf8'
    );
    const subtext = onboardingStepSubtext('workspace');

    expect(subtext).toContain('Tell us your business name');
    expect(formSource).not.toContain(
      'This workspace coordinates agreements, obligations, approvals, and settlement across'
    );
  });
});

describe('Start method onboarding copy', () => {
  it('uses scannable header copy without product explanations in the form body', () => {
    const formSource = fs.readFileSync(
      path.join(process.cwd(), 'components/onboarding/workflow-onboarding-form.tsx'),
      'utf8'
    );

    expect(onboardingStepSubtext('start_method')).toBe(
      'Pick the path that fits how you work today.'
    );
    expect(formSource).not.toContain('Provvypay transforms conversations');
    expect(formSource).not.toContain('All three paths are first-class workflows');
    expect(formSource).not.toContain('Skip Setup And Explore');
    expect(formSource).toContain('Skip for now');
  });
});
