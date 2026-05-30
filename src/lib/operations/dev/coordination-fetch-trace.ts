'use client';

let requestSeq = 0;

function nextRequestId(): string {
  requestSeq += 1;
  return `coord-${requestSeq}-${Date.now().toString(36)}`;
}

export function logCoordinationFetch(
  phase: 'activation-start' | 'activation-complete' | 'snapshot-start' | 'snapshot-complete',
  input: {
    requestId?: string;
    projectId?: string | null;
    durationMs?: number;
    success?: boolean;
  }
): string {
  const requestId = input.requestId ?? nextRequestId();
  if (process.env.NODE_ENV === 'production' && phase.endsWith('-start')) {
    return requestId;
  }
  console.info('[coordination-fetch]', {
    phase,
    requestId,
    projectId: input.projectId ?? null,
    durationMs: input.durationMs ?? null,
    success: input.success ?? true,
    at: new Date().toISOString(),
  });
  return requestId;
}
