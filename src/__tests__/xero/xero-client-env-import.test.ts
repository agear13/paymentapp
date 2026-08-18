/**
 * Regression: client Xero UI must not import server env validation.
 * Importing `@/lib/config/env` in a `'use client'` bundle runs Zod validation in the
 * browser and throws "Environment validation failed" after OAuth redirect.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const CLIENT_XERO_UI_FILES = [
  path.join(ROOT, 'components', 'dashboard', 'settings', 'xero-account-mapping.tsx'),
  path.join(ROOT, 'components', 'dashboard', 'settings', 'xero-integration-panel.tsx'),
  path.join(ROOT, 'components', 'dashboard', 'settings', 'xero-connection.tsx'),
  path.join(ROOT, 'components', 'journey', 'lovable', 'workspace-xero-manage-screen.tsx'),
  path.join(ROOT, 'components', 'journey', 'lovable', 'workspace-connected-screen.tsx'),
];

describe('Xero OAuth return — client bundle must not import server env', () => {
  it.each(CLIENT_XERO_UI_FILES)('%s does not import @/lib/config/env', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toMatch(/^'use client'/m);
    expect(source).not.toMatch(/from ['"]@\/lib\/config\/env['"]/);
  });
});
