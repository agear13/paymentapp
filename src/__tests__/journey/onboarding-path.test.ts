/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';
import { JOURNEY_ROUTES } from '@/lib/journey/hackathon-journey';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('new-user onboarding path', () => {
  test('Context continues to Create workspace and no longer requires 4 of 5 answers', () => {
    const source = read('components/journey/lovable/assessment-business-screen.tsx');
    expect(source).toContain("router.push('/journey/provisioning')");
    expect(source).not.toContain('canContinue');
    expect(source).not.toContain('filled >= 4');
    expect(source).not.toContain('autonomous reconciliation');
    expect(source).not.toContain('HubSpot');
    expect(source).not.toContain('1–5');
    expect(source).toContain('Help us understand your current setup');
  });

  test('Intent no longer promises a designed or deployed workflow', () => {
    const source = read('components/journey/lovable/assessment-objective-screen.tsx');
    expect(source).toContain('What do you want to get done first?');
    expect(source).not.toContain('design the right commercial workflow');
    expect(source).not.toContain('Let Provvy AI figure out where to start');
  });

  test('legacy middle journey screens redirect to Create workspace', () => {
    expect(read('components/journey/lovable/assessment-connect-screen.tsx')).toContain(
      JOURNEY_ROUTES.provisioning
    );
    expect(read('components/journey/lovable/assessment-analysis-screen.tsx')).toContain(
      JOURNEY_ROUTES.provisioning
    );
    expect(read('components/journey/lovable/workflow-recommendation-screen.tsx')).toContain(
      JOURNEY_ROUTES.provisioning
    );
    expect(read('components/journey/lovable/assessment-analysis-screen.tsx')).not.toContain(
      'Connecting accounting'
    );
    expect(read('components/journey/lovable/workflow-recommendation-screen.tsx')).not.toContain(
      'Autonomous Reconciliation'
    );
  });

  test('Create workspace and provisioning use the Professional trial, not a free or prescribed deploy', () => {
    const create = read('components/journey/lovable/workspace-create-screen.tsx');
    const provision = read('components/journey/lovable/workspace-provisioning-screen.tsx');

    expect(create).toContain('Start with 30 days of Provvy Professional');
    expect(create).toContain('You can create invoices now');
    expect(create).toContain('Add payment methods when you');
    expect(create).toContain('Contextual');
    expect(create).toContain('Plan &amp; Billing');
    expect(create).not.toContain('payment links are ready to explore');
    expect(create).not.toContain('usage remaining');
    expect(create).not.toContain('usage left');
    expect(create).not.toContain('Free while in early access');
    expect(create).not.toContain('deploy Autonomous Reconciliation');
    expect(create).toContain('/journey/assessment/business');

    expect(provision).toContain('Creating your workspace');
    expect(provision).toContain('Setting up your Professional trial');
    expect(provision).toContain('You can create invoices now');
    expect(provision).toContain('Add payment methods when you are ready');
    expect(provision).toContain('Contextual AI guidance');
    expect(provision).toContain('Plan &amp; Billing');
    expect(provision).not.toContain('payment links are ready to explore');
    expect(provision).not.toContain('usage remaining');
    expect(provision).not.toContain('usage left');
    expect(provision).not.toContain('Connecting systems');
    expect(provision).not.toContain('Preparing automations');
    expect(provision).not.toContain('Configuring workflows');
  });

  test('landing frames start-working and the trial, not system analysis', () => {
    const landing = read('components/journey/lovable/journey-landing-page.tsx');
    expect(landing).toContain("Tell Provvy what you&apos;re trying to do, then start working");
    expect(landing).toContain('30 days of Professional');
    expect(landing).not.toContain('maps how your commercial operations work today');
  });
});
