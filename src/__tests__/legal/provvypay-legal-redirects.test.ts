import fs from 'fs';
import path from 'path';

import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from '@/lib/legal/provvypay-legal-paths';
import { PROVVYPAY_LEGAL_REDIRECTS } from '@/lib/legal/provvypay-legal-redirects';

describe('Provvypay legal redirects', () => {
  it('defines permanent redirects from legacy legal routes', () => {
    expect(PROVVYPAY_LEGAL_REDIRECTS).toEqual([
      {
        source: '/legal/terms',
        destination: PROVVYPAY_TERMS_PATH,
        permanent: true,
      },
      {
        source: '/legal/privacy',
        destination: PROVVYPAY_PRIVACY_PATH,
        permanent: true,
      },
    ]);
  });

  it('registers redirects in next.config', async () => {
    const nextConfigModule = await import('../../next.config');
    const redirects = await nextConfigModule.default.redirects?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/legal/terms',
          destination: '/terms',
          permanent: true,
        }),
        expect.objectContaining({
          source: '/legal/privacy',
          destination: '/privacy',
          permanent: true,
        }),
      ])
    );
  });
});

const SOURCE_ROOT = path.join(__dirname, '../..');
const IGNORED_DIRS = new Set([
  '.next',
  'node_modules',
  'test-results',
  'coverage',
  'e2e',
]);
const ALLOWED_LEGACY_PATH_FILES = new Set([
  'lib/legal/provvypay-legal-redirects.ts',
  '__tests__/legal/provvypay-legal-redirects.test.ts',
]);

const LEGACY_INTERNAL_ROUTE_PATTERN =
  /(?:href|source|destination)\s*[=:]\s*['"`]\/legal\/(?:terms|privacy)['"`]/;

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }

    if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Provvypay legal route audit', () => {
  it('does not reference legacy /legal/terms or /legal/privacy routes in app source', () => {
    const offenders: string[] = [];

    for (const filePath of collectSourceFiles(SOURCE_ROOT)) {
      const relativePath = path.relative(SOURCE_ROOT, filePath).split(path.sep).join('/');
      if (ALLOWED_LEGACY_PATH_FILES.has(relativePath)) continue;

      const contents = fs.readFileSync(filePath, 'utf8');
      if (LEGACY_INTERNAL_ROUTE_PATTERN.test(contents)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps canonical legal content in provvypay document components only', () => {
    const termsDocument = fs.readFileSync(
      path.join(SOURCE_ROOT, 'components/legal/provvypay-terms-document.tsx'),
      'utf8'
    );
    const privacyDocument = fs.readFileSync(
      path.join(SOURCE_ROOT, 'components/legal/provvypay-privacy-document.tsx'),
      'utf8'
    );
    const legacyTermsPage = fs.readFileSync(
      path.join(SOURCE_ROOT, 'app/(legal)/legal/terms/page.tsx'),
      'utf8'
    );
    const legacyPrivacyPage = fs.readFileSync(
      path.join(SOURCE_ROOT, 'app/(legal)/legal/privacy/page.tsx'),
      'utf8'
    );

    expect(termsDocument).toContain('Provvypay Terms of Service');
    expect(privacyDocument).toContain('We do not sell personal information');
    expect(legacyTermsPage).not.toContain('LegalDocument');
    expect(legacyPrivacyPage).not.toContain('LegalDocument');
    expect(legacyTermsPage).toContain("redirect(PROVVYPAY_TERMS_PATH)");
    expect(legacyPrivacyPage).toContain("redirect(PROVVYPAY_PRIVACY_PATH)");
  });
});
