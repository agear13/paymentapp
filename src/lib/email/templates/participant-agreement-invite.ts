function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ParticipantAgreementInviteEmailParams = {
  participantName: string;
  operatorName: string;
  projectName: string;
  workspaceUrl: string;
};

export function buildParticipantAgreementInviteEmail(
  params: ParticipantAgreementInviteEmailParams
): { subject: string; html: string; text: string } {
  const participantName = params.participantName.trim() || 'there';
  const operatorName = params.operatorName.trim() || 'Your organiser';
  const projectName = params.projectName.trim() || 'Referral Management';
  const workspaceUrl = params.workspaceUrl.trim();

  const subject = `Please review and approve your agreement for ${projectName}`;
  const htmlName = escapeHtml(participantName);
  const htmlOperator = escapeHtml(operatorName);
  const htmlProject = escapeHtml(projectName);
  const htmlUrl = escapeHtml(workspaceUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review your agreement</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <p style="font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:0 0 12px;">Referral Management</p>
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;">Hi ${htmlName}, please review your agreement</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;">
      ${htmlOperator} invited you to participate in <strong>${htmlProject}</strong>.
      Open your secure workspace to review and approve your agreement. You will sign in with this email address.
    </p>
    <p style="margin:24px 0;">
      <a href="${htmlUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:600;">
        Review agreement
      </a>
    </p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all;">If the button does not work, copy this link: ${htmlUrl}</p>
  </div>
</body>
</html>`;

  const text = `Hi ${participantName},

${operatorName} invited you to participate in ${projectName}.

Open your secure workspace to review and approve your agreement:
${workspaceUrl}

You will sign in with this email address.`;

  return { subject, html, text };
}
