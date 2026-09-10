function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAgreementUpdatedEmail(params: {
  participantName: string;
  organizationName: string;
  agreementTitle: string;
  workspaceUrl: string;
}): { subject: string; html: string; text: string } {
  const name = params.participantName.trim() || 'there';
  const org = params.organizationName.trim() || 'your organiser';
  const title = params.agreementTitle.trim() || 'affiliate agreement';
  const url = params.workspaceUrl.trim();
  const subject = `Your ${title} has been updated. Please review and sign the new version.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Updated agreement</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 12px;">Agreement update</p>
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;">Hi ${escapeHtml(name)}, please review the new version</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;">
      ${escapeHtml(org)} approved a change to your <strong>${escapeHtml(title)}</strong>.
      The previous version is preserved. Please review and sign the updated agreement.
    </p>
    <p style="margin:24px 0;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:600;">
        Review updated agreement
      </a>
    </p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all;">If the button does not work, copy this link: ${escapeHtml(url)}</p>
  </div>
</body>
</html>`;

  const text = `Hi ${name},

${org} approved a change to your ${title}. The previous version is preserved.

Please review and sign the updated agreement:
${url}`;

  return { subject, html, text };
}

export function buildAgreementChangeRejectedEmail(params: {
  participantName: string;
  organizationName: string;
  agreementTitle: string;
  reviewNote?: string | null;
  workspaceUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const name = params.participantName.trim() || 'there';
  const org = params.organizationName.trim() || 'the organiser';
  const title = params.agreementTitle.trim() || 'agreement';
  const note = params.reviewNote?.trim();
  const url = params.workspaceUrl?.trim();
  const subject = 'Your suggested change was not approved.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Suggested change</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;">Hi ${escapeHtml(name)}</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;">
      ${escapeHtml(org)} reviewed your suggested change to <strong>${escapeHtml(title)}</strong>.
      Your suggested change was not approved.
    </p>
    ${note ? `<p style="font-size:15px;color:#475569;line-height:1.6;">Note: ${escapeHtml(note)}</p>` : ''}
    ${
      url
        ? `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:600;">View agreement</a></p>`
        : ''
    }
  </div>
</body>
</html>`;

  const text = `Hi ${name},

${org} reviewed your suggested change to ${title}. Your suggested change was not approved.
${note ? `\nNote: ${note}\n` : ''}${url ? `\nView agreement: ${url}` : ''}`;

  return { subject, html, text };
}

export function buildAgreementChangeClarificationEmail(params: {
  participantName: string;
  organizationName: string;
  agreementTitle: string;
  reviewNote: string;
  workspaceUrl: string;
}): { subject: string; html: string; text: string } {
  const name = params.participantName.trim() || 'there';
  const org = params.organizationName.trim() || 'the organiser';
  const title = params.agreementTitle.trim() || 'agreement';
  const note = params.reviewNote.trim();
  const url = params.workspaceUrl.trim();
  const subject = `${org} asked for clarification on your suggested change`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clarification requested</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;">Hi ${escapeHtml(name)}</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;">
      ${escapeHtml(org)} asked for more information about your suggested change to <strong>${escapeHtml(title)}</strong>.
    </p>
    <p style="font-size:15px;color:#475569;line-height:1.6;">${escapeHtml(note)}</p>
    <p style="margin:24px 0;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:600;">
        Review agreement
      </a>
    </p>
  </div>
</body>
</html>`;

  const text = `Hi ${name},

${org} asked for more information about your suggested change to ${title}.

${note}

Review agreement: ${url}`;

  return { subject, html, text };
}
