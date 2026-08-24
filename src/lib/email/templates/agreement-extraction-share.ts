import type { ExtractionExportDocument } from '@/lib/ai-extractor/extraction-export';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAgreementExtractionShareEmail(input: {
  document: ExtractionExportDocument;
  senderName?: string | null;
}): { subject: string; html: string; text: string } {
  const title = input.document.title?.trim() || 'Agreement extraction';
  const sender = input.senderName?.trim() || 'A Provvy operator';
  const summary = input.document.summary;
  const parties = input.document.extraction.parties
    .map((party) => party.name.value?.trim())
    .filter((name): name is string => Boolean(name));

  const subject = `Agreement Intelligence extraction: ${title}`;
  const htmlTitle = escapeHtml(title);
  const htmlSender = escapeHtml(sender);
  const htmlOneLiner = escapeHtml(summary.oneLiner || 'Structured commercial terms were extracted.');
  const partyList =
    parties.length > 0
      ? parties.map((name) => `<li>${escapeHtml(name)}</li>`).join('')
      : '<li>No named parties</li>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlTitle}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 12px;">Agreement Intelligence</p>
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;">Extraction complete</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;">
      ${htmlSender} shared the structured extraction for <strong>${htmlTitle}</strong>.
    </p>
    <p style="font-size:15px;color:#475569;line-height:1.6;">${htmlOneLiner}</p>
    <ul style="font-size:14px;color:#334155;line-height:1.6;padding-left:18px;">
      <li>${summary.participantCount} participant${summary.participantCount === 1 ? '' : 's'}</li>
      <li>${summary.fixedFeeObligationCount + summary.revenueShareObligationCount} obligation${summary.fixedFeeObligationCount + summary.revenueShareObligationCount === 1 ? '' : 's'}</li>
      <li>${summary.revenueShareObligationCount} revenue share${summary.revenueShareObligationCount === 1 ? '' : 's'}</li>
    </ul>
    <p style="font-size:13px;font-weight:600;color:#0f172a;margin:16px 0 8px;">Parties</p>
    <ul style="font-size:14px;color:#334155;line-height:1.6;padding-left:18px;">${partyList}</ul>
    <p style="font-size:13px;color:#64748b;margin-top:24px;">The full structured extraction JSON is attached.</p>
  </div>
</body>
</html>`;

  const text = `Extraction complete: ${title}

${sender} shared a structured Agreement Intelligence extraction.

${summary.oneLiner || ''}

Participants: ${summary.participantCount}
Obligations: ${summary.fixedFeeObligationCount + summary.revenueShareObligationCount}
Revenue shares: ${summary.revenueShareObligationCount}

Parties:
${parties.length > 0 ? parties.map((name) => `- ${name}`).join('\n') : '- None named'}

The full structured extraction JSON is attached.`;

  return { subject, html, text };
}
