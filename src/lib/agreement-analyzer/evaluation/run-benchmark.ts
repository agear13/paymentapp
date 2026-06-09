import { access, readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';

import { buildBenchmarkReport, formatBenchmarkMarkdown } from '@/lib/agreement-analyzer/evaluation/benchmark-report';
import {
  ExpectedAgreementEvaluationSchema,
  type BenchmarkPerAgreementResult,
  type BenchmarkReport,
  type ExpectedAgreementEvaluation,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import { normalizeActualExtraction } from '@/lib/agreement-analyzer/evaluation/normalize-actual-extraction';
import {
  scoreAgreementEvaluation,
  zeroScoreAgreementEvaluation,
} from '@/lib/agreement-analyzer/evaluation/scoring';
import { getAgreementExtractionProvider } from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import { resolveAgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/provider-config';
import type { AgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/types';
import { runProductionAgreementExtraction } from '@/lib/agreement-analyzer/extraction/core/run-production-extraction';

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listBenchmarkAgreementIds(samplesDirectory: string): Promise<string[]> {
  const entries = await readdir(samplesDirectory, { withFileTypes: true });
  const ids: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const agreementPath = path.join(samplesDirectory, entry.name, 'agreement.md');
    if (await fileExists(agreementPath)) {
      ids.push(entry.name);
    }
  }

  return ids.sort();
}

export async function runAgreementBenchmark(options: {
  samplesDirectory: string;
  jsonOutputPath: string;
  mdOutputPath: string;
  providerId?: AgreementExtractionProviderId | string | null;
}): Promise<BenchmarkReport> {
  const providerId = resolveAgreementExtractionProviderId(options.providerId);
  const provider = getAgreementExtractionProvider(providerId);
  const agreementIds = await listBenchmarkAgreementIds(options.samplesDirectory);
  const perAgreement: BenchmarkPerAgreementResult[] = [];
  const actualByAgreementId: Record<string, unknown> = {};
  const expectedByAgreementId: Record<string, ExpectedAgreementEvaluation> = {};

  let succeeded = 0;
  let failed = 0;
  let observedModelName = provider.modelName;

  for (const agreementId of agreementIds) {
    const sampleDir = path.join(options.samplesDirectory, agreementId);
    const agreementPath = path.join(sampleDir, 'agreement.md');
    const expectedPath = path.join(sampleDir, 'expected.json');
    const actualPath = path.join(sampleDir, 'actual.json');

    const expectedRaw = await readJsonFile(expectedPath);
    const expected = ExpectedAgreementEvaluationSchema.parse(expectedRaw);
    expectedByAgreementId[agreementId] = expected;

    const agreementText = await readFile(agreementPath, 'utf8');
    const extractionResult = await runProductionAgreementExtraction({
      bytes: Buffer.from(agreementText, 'utf8'),
      mimeType: 'text/plain',
      providerId,
    });

    if (extractionResult.success) {
      succeeded += 1;
      observedModelName = extractionResult.modelName;
      const actualPayload = {
        extraction: extractionResult.extraction,
        provider: extractionResult.providerId,
        modelName: extractionResult.modelName,
        processingDurationMs: extractionResult.processingDurationMs,
      };
      actualByAgreementId[agreementId] = actualPayload;
      await writeFile(actualPath, `${JSON.stringify(actualPayload, null, 2)}\n`, 'utf8');

      const actual = normalizeActualExtraction(actualPayload);
      perAgreement.push({
        ...scoreAgreementEvaluation(agreementId, expected, actual!),
        extractionStatus: 'success',
      });
      continue;
    }

    failed += 1;
    const actualPayload = {
      success: false,
      error: extractionResult.error,
      stage: extractionResult.stage,
      provider: extractionResult.providerId,
      modelName: extractionResult.modelName,
      processingDurationMs: extractionResult.processingDurationMs,
    };
    actualByAgreementId[agreementId] = actualPayload;
    await writeFile(actualPath, `${JSON.stringify(actualPayload, null, 2)}\n`, 'utf8');

    perAgreement.push({
      ...zeroScoreAgreementEvaluation(agreementId, expected, 'invalid_actual', [
        `Production extraction failed at ${extractionResult.stage}: ${extractionResult.error}`,
      ]),
      extractionStatus: 'failed',
      extractionError: extractionResult.error,
    });
  }

  const report = buildBenchmarkReport({
    samplesDirectory: options.samplesDirectory,
    provider: {
      provider: providerId,
      model: observedModelName,
    },
    extraction: {
      processed: agreementIds.length,
      succeeded,
      failed,
    },
    perAgreement,
    actualByAgreementId,
    expectedByAgreementId,
  });

  await writeFile(options.jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(options.mdOutputPath, formatBenchmarkMarkdown(report), 'utf8');

  return report;
}
