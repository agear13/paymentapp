import { parseJsonFromModelResponse } from '@/lib/agreement-analyzer/ai/parse-json-response';
import { AgreementExecutiveSummarySchema } from '@/lib/agreement-analyzer/extraction/extraction-types';

export function parseExecutiveSummaryResponse(raw: string) {
  const parsed = parseJsonFromModelResponse(raw);
  return AgreementExecutiveSummarySchema.parse(parsed);
}
