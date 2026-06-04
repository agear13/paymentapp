import {
  isEmailInAdminAllowlist,
  resolveAdminEmailAllowlist,
} from '@/lib/config/admin-email-allowlist';

describe('admin-email-allowlist (B5 C4)', () => {
  it('uses ADMIN_EMAIL_ALLOWLIST as authoritative', () => {
    const list = resolveAdminEmailAllowlist({
      ADMIN_EMAIL_ALLOWLIST: 'Ops@Example.com, admin@other.com',
      ADMIN_EMAILS: 'legacy@example.com',
    });
    expect(list).toEqual(
      expect.arrayContaining(['ops@example.com', 'admin@other.com', 'legacy@example.com'])
    );
    expect(list).toHaveLength(3);
  });

  it('falls back to deprecated ADMIN_EMAILS when allowlist empty', () => {
    const list = resolveAdminEmailAllowlist({
      ADMIN_EMAIL_ALLOWLIST: '',
      ADMIN_EMAILS: 'legacy@example.com',
    });
    expect(list).toEqual(['legacy@example.com']);
  });

  it('isEmailInAdminAllowlist is case-insensitive', () => {
    const list = ['admin@example.com'];
    expect(isEmailInAdminAllowlist('Admin@Example.com', list)).toBe(true);
    expect(isEmailInAdminAllowlist('other@example.com', list)).toBe(false);
  });
});

describe('checkAdminAuth uses resolved allowlist (contract)', () => {
  const adminServerSource = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'lib', 'auth', 'admin.server.ts'),
    'utf-8'
  );

  it('reads config.admin.emailAllowlist not raw ADMIN_EMAILS', () => {
    expect(adminServerSource).toContain('config.admin.emailAllowlist');
    expect(adminServerSource).not.toContain("process.env.ADMIN_EMAILS?.split");
  });
});
