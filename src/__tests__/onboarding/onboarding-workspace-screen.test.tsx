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

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Agreement')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
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

    expect(subtext).toContain('coordinates agreements');
    expect(formSource).not.toContain(
      'This workspace coordinates agreements, obligations, approvals, and settlement across'
    );
  });
});
