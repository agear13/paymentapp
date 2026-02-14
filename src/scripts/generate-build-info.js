/**
 * Generates src/generated/build-info.ts with GIT_SHA and BUILD_TIME.
 * Run via prebuild / predev (before npm run build / npm run dev).
 */
const fs = require('fs');
const path = require('path');

const gitSha = process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || 'unknown';
const buildTime = process.env.BUILD_TIME || new Date().toISOString();

const outDir = path.join(__dirname, '../generated');
const outFile = path.join(outDir, 'build-info.ts');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  `/** Auto-generated at build time. Do not edit. */
export const GIT_SHA = ${JSON.stringify(gitSha)};
export const BUILD_TIME = ${JSON.stringify(buildTime)};
`
);
