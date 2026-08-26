import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('provisioning preserves Generate my invoice intent', () => {
  it('captures invoice intent on the provisioning page and consumes it after bootstrap', () => {
    const page = readFileSync(
      join(process.cwd(), 'components/journey/lovable/provisioning-page-client.tsx'),
      'utf8'
    );
    const bootstrap = readFileSync(
      join(process.cwd(), 'components/journey/lovable/workspace-provisioning-screen.tsx'),
      'utf8'
    );
    const create = readFileSync(
      join(process.cwd(), 'components/journey/lovable/workspace-create-screen.tsx'),
      'utf8'
    );

    expect(page).toContain('captureInvoiceActivationIntentFromSearchParams');
    expect(bootstrap).toContain('consumePostProvisioningDestination');
    expect(bootstrap).toContain('COMMERCIAL_OS_ROUTES.workspace');
    expect(create).toContain('consumePostProvisioningDestination');
    expect(create).toContain('COMMERCIAL_OS_ROUTES.workspace');
  });
});
