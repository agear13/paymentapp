import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';

export function emitAgreementUploadStored(input: {
  provider: 'local' | 'r2';
  fileSize: number;
  mimeType: string;
}): void {
  trackAgreementAnalyzerEvent('agreement_upload_stored', {
    provider: input.provider,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
  });
}
