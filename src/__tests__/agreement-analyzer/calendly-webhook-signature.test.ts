import crypto from 'crypto';

import {
  parseCalendlyWebhookSignatureHeader,
  verifyCalendlyWebhookSignature,
} from '@/lib/agreement-analyzer/calendly/calendly-webhook-signature.server';

describe('Calendly webhook signature verification', () => {
  const signingKey = 'calendly-webhook-signing-key-test';
  const rawBody = JSON.stringify({ event: 'invitee.created', payload: { name: 'Alex' } });

  function buildSignature(body: string, timestamp: number) {
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  it('parses Calendly signature headers', () => {
    const header = buildSignature(rawBody, 1_700_000_000);
    expect(parseCalendlyWebhookSignatureHeader(header)).toEqual({
      timestamp: '1700000000',
      signature: expect.any(String),
    });
  });

  it('accepts valid signatures', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = buildSignature(rawBody, timestamp);

    expect(
      verifyCalendlyWebhookSignature({
        rawBody,
        signatureHeader: header,
        signingKey,
      })
    ).toBe(true);
  });

  it('rejects invalid signatures with 401 semantics', () => {
    const timestamp = Math.floor(Date.now() / 1000);

    expect(
      verifyCalendlyWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=deadbeef`,
        signingKey,
      })
    ).toBe(false);
  });
});
