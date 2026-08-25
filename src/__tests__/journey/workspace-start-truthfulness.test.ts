/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('workspace start and trial copy truthfulness', () => {
  test('does not tell new users they can immediately accept payment before rails are configured', () => {
    const start = read('components/journey/lovable/workspace-start-screen.tsx');
    const create = read('components/journey/lovable/workspace-create-screen.tsx');
    const provision = read('components/journey/lovable/workspace-provisioning-screen.tsx');

    for (const source of [start, create, provision]) {
      expect(source).not.toMatch(/accept fiat or crypto/i);
      expect(source).not.toContain('payment links are ready to explore');
      expect(source).not.toContain('Invoices and payment links are ready');
    }

    expect(start).toContain('Create Invoice');
    expect(start).toContain('COMMERCIAL_OS_ROUTES.createInvoice');
    expect(start).toContain('Add payment methods when you are ready');
    expect(start).toContain('Commercial Workspaces');
    expect(start).toContain('COMMERCIAL_OS_ROUTES.arrangements');
    expect(start).toContain('Create Commercial Workspace');
    expect(start).toContain('?create=1');
    expect(start).toContain('Operating dashboard');
    expect(start).not.toMatch(/title: 'Commercial Workspace'/);
    expect(create).toContain('You can create invoices now');
    expect(create).toContain('Add payment methods when you');
    expect(provision).toContain('You can create invoices now');
  });

  test('does not imply mandatory configuration or existing active workflows', () => {
    const start = read('components/journey/lovable/workspace-start-screen.tsx');

    expect(start).not.toContain('Configuration complete');
    expect(start).not.toContain('reconcile automatically');
    expect(start).not.toContain('active workflows');
    expect(start).toContain('Your workspace is ready');
    expect(start).toContain('Connect accounting when you are ready');
  });

  test('uses durable trial status language instead of a hardcoded remaining-day grant', () => {
    const start = read('components/journey/lovable/workspace-start-screen.tsx');

    expect(start).not.toContain('You have 30 days');
    expect(start).toContain('active Professional trial');
    expect(start).toContain('Plan &amp; Billing');
    expect(start).not.toContain('usage remaining');
    expect(start).not.toContain('usage left');
  });
});
