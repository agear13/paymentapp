/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('@/hooks/use-deployed-workflows', () => ({
  useDeployedWorkflows: () => ({
    isInstalled: () => true,
    loading: false,
    getBySlug: () => ({ id: 'wf-1' }),
  }),
}));

jest.mock('@/components/journey/lovable/agreement-intelligence-index-screen', () => ({
  AgreementIntelligenceIndexScreen: () => (
    <div data-testid="agreement-intelligence-index">collection</div>
  ),
}));

jest.mock('@/components/journey/lovable/agreement-intelligence-hub-screen', () => ({
  AgreementIntelligenceHubScreen: () => (
    <div data-testid="agreement-intelligence-detail">detail</div>
  ),
}));

jest.mock('@/components/journey/lovable/referral-management-hub-screen', () => ({
  ReferralManagementHubScreen: () => <div data-testid="referral-management-hub" />,
}));

import { WorkflowInstanceScreen } from '@/components/journey/lovable/workflow-instance-screen';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Agreement Intelligence collection routing', () => {
  it('renders the collection index at the installed workflow root, not the current-agreement hub', () => {
    render(<WorkflowInstanceScreen slug="agreement-intelligence" />);

    expect(screen.getByTestId('agreement-intelligence-index')).toBeInTheDocument();
    expect(screen.queryByTestId('agreement-intelligence-detail')).not.toBeInTheDocument();
  });

  it('wires the root workflow page through WorkflowInstanceScreen only', () => {
    const source = readSrc('app/(commercial-os)/workspace/workflows/[slug]/page.tsx');
    expect(source).toContain('WorkflowInstanceScreen');
    expect(source).not.toContain('AgreementIntelligenceHubScreen');
  });

  it('does not mount the per-agreement hub from workflow-instance-screen', () => {
    const source = readSrc('components/journey/lovable/workflow-instance-screen.tsx');
    expect(source).toContain('AgreementIntelligenceIndexScreen');
    expect(source).not.toContain('AgreementIntelligenceHubScreen');
  });

  it('mounts the per-agreement hub only on the agreementId child route', () => {
    const source = readSrc(
      'app/(commercial-os)/workspace/workflows/[slug]/[agreementId]/page.tsx'
    );
    expect(source).toContain('AgreementIntelligenceHubScreen');
    expect(source).toContain('agreementId={agreementId}');
    expect(source).toContain("slug !== 'agreement-intelligence'");
  });
});
