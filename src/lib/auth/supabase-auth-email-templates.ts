import {
  MAGIC_LINK_CONFIRMATION_PLACEHOLDER,
  PROVVYPAY_SUPPORT_EMAIL,
  REAUTHENTICATION_TOKEN_PLACEHOLDER,
} from '@/lib/auth/production-auth-branding';

type AuthEmailCta = {
  href: string;
  label: string;
};

function wrapProvvypayAuthEmail(options: {
  title: string;
  intro: string;
  extraHtml?: string;
  cta?: AuthEmailCta;
  footer?: string;
}): string {
  const extra = options.extraHtml ?? '';
  const cta = options.cta
    ? `<p style="margin:0 0 24px;">
                <a href="${options.cta.href}" style="display:inline-block;background:#5170ff;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:600;">${options.cta.label}</a>
              </p>
              <p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">If the button does not work, copy this link:<br>${options.cta.href}</p>`
    : '';
  const footer =
    options.footer ??
    `If you did not request this email, you can ignore it. Need help? Contact ${PROVVYPAY_SUPPORT_EMAIL}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5170ff;">Provvypay</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">${options.title}</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">${options.intro}</p>
              ${extra}${cta}
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const confirmationUrlCta = (label: string): AuthEmailCta => ({
  href: MAGIC_LINK_CONFIRMATION_PLACEHOLDER,
  label,
});

export const SUPABASE_AUTH_EMAIL_TEMPLATES = {
  confirmation: wrapProvvypayAuthEmail({
    title: 'Confirm your Provvypay account',
    intro:
      'Thanks for signing up. Confirm this email address to finish creating your Provvypay account.',
    cta: confirmationUrlCta('Confirm your email'),
  }),
  magic_link: wrapProvvypayAuthEmail({
    title: 'Sign in to Provvypay',
    intro:
      'Use this secure link to sign in to your Provvypay workspace. It expires shortly and can only be used once.',
    cta: confirmationUrlCta('Sign in to Provvypay'),
  }),
  invite: wrapProvvypayAuthEmail({
    title: 'You are invited to Provvypay',
    intro: 'You have been invited to create a Provvypay account. Open the link below to accept.',
    cta: confirmationUrlCta('Accept invitation'),
  }),
  recovery: wrapProvvypayAuthEmail({
    title: 'Reset your Provvypay password',
    intro:
      'We received a request to reset the password for your Provvypay account. Open the link below to choose a new password.',
    cta: confirmationUrlCta('Reset password'),
  }),
  email_change: wrapProvvypayAuthEmail({
    title: 'Confirm your new Provvypay email',
    intro:
      'Confirm {{ .NewEmail }} as the new email address for your Provvypay account.',
    cta: confirmationUrlCta('Confirm new email'),
  }),
  reauthentication: wrapProvvypayAuthEmail({
    title: 'Confirm it is you',
    intro:
      'Use this Provvypay verification code to confirm a sensitive account change. It expires shortly.',
    extraHtml: `<p style="margin:0 0 24px;font-size:28px;letter-spacing:.24em;font-weight:700;color:#0f172a;">${REAUTHENTICATION_TOKEN_PLACEHOLDER}</p>`,
  }),
  password_changed_notification: wrapProvvypayAuthEmail({
    title: 'Your Provvypay password was changed',
    intro: 'The password for your Provvypay account was recently changed.',
    footer: `If you did not make this change, reset your password and contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
  email_changed_notification: wrapProvvypayAuthEmail({
    title: 'Your Provvypay email address was changed',
    intro:
      'The email address for your Provvypay account was changed from {{ .OldEmail }} to {{ .Email }}.',
    footer: `If you did not make this change, contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
  phone_changed_notification: wrapProvvypayAuthEmail({
    title: 'Your Provvypay phone number was changed',
    intro:
      'The phone number for your Provvypay account was changed from {{ .OldPhone }} to {{ .Phone }}.',
    footer: `If you did not make this change, contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
  identity_linked_notification: wrapProvvypayAuthEmail({
    title: 'A sign-in method was added',
    intro:
      'Your {{ .Provider }} account was linked as a sign-in method for your Provvypay account ({{ .Email }}).',
    footer: `If you did not make this change, contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
  identity_unlinked_notification: wrapProvvypayAuthEmail({
    title: 'A sign-in method was removed',
    intro:
      'Your {{ .Provider }} account was removed as a sign-in method for your Provvypay account ({{ .Email }}).',
    footer: `If you did not make this change, contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
  mfa_factor_enrolled_notification: wrapProvvypayAuthEmail({
    title: 'A verification method was added',
    intro:
      'Sign-in verification method {{ .FactorType }} was added to your Provvypay account.',
    footer: `If you did not make this change, contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
  mfa_factor_unenrolled_notification: wrapProvvypayAuthEmail({
    title: 'A verification method was removed',
    intro:
      'Sign-in verification method {{ .FactorType }} was removed from your Provvypay account.',
    footer: `If you did not make this change, contact ${PROVVYPAY_SUPPORT_EMAIL} immediately.`,
  }),
} as const;

export type SupabaseAuthEmailTemplateName = keyof typeof SUPABASE_AUTH_EMAIL_TEMPLATES;
