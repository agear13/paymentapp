import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

export type MatrixResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT RUN' | 'SKIP';

export type MatrixRow = {
  criterion: string;
  result: MatrixResult;
  detail?: string;
};

export function createEvidenceTracker(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(outDir, 'screenshots'), { recursive: true });

  const matrix: MatrixRow[] = [];

  function record(criterion: string, result: MatrixResult, detail?: string) {
    matrix.push({ criterion, result, detail });
    writeMatrix();
  }

  function pass(criterion: string, detail?: string) {
    record(criterion, 'PASS', detail);
  }

  function fail(criterion: string, detail?: string) {
    record(criterion, 'FAIL', detail);
  }

  function blocked(criterion: string, detail?: string) {
    record(criterion, 'BLOCKED', detail);
  }

  function notRun(criterion: string, detail?: string) {
    record(criterion, 'NOT RUN', detail);
  }

  function writeMatrix() {
    writeFileSync(
      resolve(outDir, 'p3c-browser-matrix.json'),
      JSON.stringify({ matrix, generatedAt: new Date().toISOString() }, null, 2)
    );
  }

  async function screenshot(page: Page, stage: string): Promise<void> {
    const safeName = stage.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
    await page.screenshot({
      path: resolve(outDir, 'screenshots', `${safeName}.png`),
      fullPage: true,
    });
  }

  return { matrix, pass, fail, blocked, notRun, writeMatrix, screenshot };
}
