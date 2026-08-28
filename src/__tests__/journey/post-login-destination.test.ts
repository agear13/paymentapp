import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMMERCIAL_OS_ROUTES,
  isRestorablePostLoginPath,
  postLoginDestination,
  resolvePostLoginDestination,
} from '@/lib/journey/commercial-os-routes';

describe('post-login destination', () => {
  it('defaults to Commercial OS provisioning', () => {
    expect(postLoginDestination()).toBe(COMMERCIAL_OS_ROUTES.provisioningBuild);
    expect(resolvePostLoginDestination(null)).toBe(COMMERCIAL_OS_ROUTES.provisioningBuild);
    expect(resolvePostLoginDestination('/workspace')).toBe('/workspace');
  });

  it('does not restore the participant test developer path', () => {
    expect(isRestorablePostLoginPath('/dashboard/admin/developer/participant-portal')).toBe(
      false
    );
    expect(
      resolvePostLoginDestination('/dashboard/admin/developer/participant-portal')
    ).toBe(COMMERCIAL_OS_ROUTES.provisioningBuild);
    expect(
      resolvePostLoginDestination('/dashboard/admin/developer/participant-portal?x=1')
    ).toBe(COMMERCIAL_OS_ROUTES.provisioningBuild);
  });

  it('login and MFA honour resolvePostLoginDestination', () => {
    const login = readFileSync(join(process.cwd(), 'app/auth/login/login-page-client.tsx'), 'utf8');
    const mfa = readFileSync(
      join(process.cwd(), 'app/auth/mfa/mfa-challenge-client.tsx'),
      'utf8'
    );
    expect(login).toContain('resolvePostLoginDestination(searchParams?.get(\'redirectedFrom\'))');
    expect(mfa).toContain('resolvePostLoginDestination(next)');
  });
});
