/**
 * Generates src/generated/build-info.ts with BUILD_ID, GIT_SHA and BUILD_TIME.
 * Run via prebuild / predev (before npm run build / npm run dev).
 */
const fs = require('fs');
const path = require('path');

const gitSha = process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || 'unknown';
const buildTime = process.env.BUILD_TIME || new Date().toISOString();
const buildId = process.env.BUILD_ID || gitSha || buildTime;

if ((process.env.NODE_ENV || 'development') === 'production' && !process.env.NEXT_PUBLIC_APP_URL?.trim()) {
  console.warn(
    '[build-info] NEXT_PUBLIC_APP_URL is missing during production build. Customer-facing invoice links will fail until configured.'
  );
}

const outDir = path.join(__dirname, '../generated');
const outFile = path.join(outDir, 'build-info.ts');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  `/** Auto-generated at build time. Do not edit. */
export const BUILD_ID = ${JSON.stringify(buildId)};
export const GIT_SHA = ${JSON.stringify(gitSha)};
export const BUILD_TIME = ${JSON.stringify(buildTime)};
`
);
