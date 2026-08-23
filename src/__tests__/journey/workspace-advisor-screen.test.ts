/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('workspace advisor screen', () => {
  test('cannot fall back to the old mock demo chat', () => {
    const source = read('components/journey/lovable/workspace-advisor-screen.tsx');

    expect(source).toContain('buildWorkspaceAdvisorIntro');
    expect(source).toContain('What Provvy knows so far');
    expect(source).toContain('What I recommend next');
    expect(source).toContain('What Provvy is learning');
    expect(source).toContain('What you told us during setup');
    expect(source).toContain('Based on what you told us during setup');
    expect(source).toContain('deriveAdvisorActivityNote');
    expect(source).not.toContain('Suggested prompts');
    expect(source).not.toContain('Ask Provvy AI');
    expect(source).not.toContain('CONVERSATION');
    expect(source).not.toContain('Autonomous Reconciliation');
    expect(source).not.toContain('Commercial Health');
    expect(source).not.toContain('82 / 100');
    expect(source).not.toContain('Pinch Payments');
    expect(source).not.toContain('analysing your connected systems');
    expect(source).not.toContain('Forecast next 30 days');
    expect(source).not.toContain('Which customers are slowest');
  });

  test('does not invent business facts when onboarding context is empty', () => {
    const source = read('components/journey/lovable/workspace-advisor-screen.tsx');

    expect(source).toContain('You have not told Provvy anything during setup yet');
    expect(source).toContain("do not invent assessment data");
    expect(source).not.toContain("business.industry || 'Professional services'");
    expect(source).not.toContain('autonomous-reconciliation');
  });

  test('keeps Create Invoice contextual guidance off this route', () => {
    const source = read('components/journey/lovable/workspace-advisor-screen.tsx');

    expect(source).not.toContain('deriveCreateInvoiceContextualGuidance');
    expect(source).not.toContain('Set up branding');
    expect(source).not.toContain('Choose payment methods');
  });

  test('Workspace Start no longer implies a conversational Advisor', () => {
    const panel = read('components/journey/lovable/workspace-advisor-panel.tsx');

    expect(panel).toContain('See what Provvy knows');
    expect(panel).not.toContain('Ask Provvy AI');
    expect(panel).toContain('buildWorkspaceAdvisorIntro');
  });
});
