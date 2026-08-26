import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export type GeneratePaymentRequestClientResult = {
  participant?: DemoParticipant;
  portalUrl?: string;
  emailSent?: boolean;
  emailError?: string;
  message?: string;
  error?: string;
};

/** Existing payment-request generate API. Shared by dashboard People and Commercial OS People. */
export async function generatePaymentRequestClient(
  participantId: string,
  options?: { sendEmail?: boolean }
): Promise<GeneratePaymentRequestClientResult> {
  const res = await fetch(
    `/api/deal-network-pilot/participants/${encodeURIComponent(participantId)}/payment-request/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendEmail: options?.sendEmail ?? false }),
    }
  );
  const json = (await res.json().catch(() => ({}))) as GeneratePaymentRequestClientResult;
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to generate payment request');
  }
  return json;
}
