import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';

export type LifecycleEmailLayoutProps = {
  subject: string;
  preheader: string;
  headline: string;
  bodyHtml: string;
  bodyText: string;
  primaryCta?: {
    label: string;
    url: string;
  };
  secondaryCtas?: {
    label: string;
    url: string;
  }[];
  showContactBlock?: boolean;
  contactConfig?: LifecycleContactConfig;
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const preheaderPad =
  '&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;';

export function renderLifecycleEmailLayout(props: LifecycleEmailLayoutProps): {
  subject: string;
  html: string;
  text: string;
} {
  const config = props.contactConfig || getLifecycleContactConfig();
  const safeSubject = escapeHtml(props.subject);
  const safePreheader = escapeHtml(props.preheader);
  const safeHeadline = escapeHtml(props.headline);

  // Primary CTA HTML & Text
  let primaryCtaHtml = '';
  let primaryCtaText = '';
  if (props.primaryCta) {
    const safeUrl = escapeHtml(props.primaryCta.url);
    const safeLabel = escapeHtml(props.primaryCta.label);
    primaryCtaHtml = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 16px;">
        <tr>
          <td bgcolor="#7C5CFF" style="background-color:#7C5CFF;border-radius:8px;">
            <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;">
              ${safeLabel} →
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 20px;font-family:${FONT};font-size:12px;line-height:1.5;color:#8b8499;word-break:break-all;">
        If the button does not work, copy this link:<br>${safeUrl}
      </p>
    `;
    primaryCtaText = `\n${props.primaryCta.label} → ${props.primaryCta.url}\n`;
  }

  // Secondary CTAs HTML & Text
  let secondaryCtasHtml = '';
  let secondaryCtasText = '';
  if (props.secondaryCtas && props.secondaryCtas.length > 0) {
    const items = props.secondaryCtas
      .map(
        (cta) => `
        <li style="margin-bottom:8px;font-family:${FONT};font-size:14px;line-height:1.5;color:#c9c2d8;">
          <a href="${escapeHtml(cta.url)}" style="color:#c4b5fd;text-decoration:none;font-weight:600;">${escapeHtml(cta.label)} &rarr;</a>
        </li>`
      )
      .join('');
    secondaryCtasHtml = `
      <div style="margin:20px 0 24px;padding:16px;background-color:#221c32;border-radius:8px;border-left:3px solid #7C5CFF;">
        <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9b7dff;">Next Steps & Resources</p>
        <ul style="margin:0;padding-left:18px;">
          ${items}
        </ul>
      </div>
    `;
    secondaryCtasText = `\nNext Steps & Resources:\n` +
      props.secondaryCtas.map((c) => `- ${c.label}: ${c.url}`).join('\n') + '\n';
  }

  // Human Contact / Help Section
  let contactHtml = '';
  let contactText = '';
  if (props.showContactBlock !== false) {
    const lines: string[] = [];
    const textLines: string[] = [];

    if (config.founderEmail) {
      lines.push(`Email our founder: <a href="mailto:${escapeHtml(config.founderEmail)}" style="color:#c4b5fd;text-decoration:none;">${escapeHtml(config.founderEmail)}</a>`);
      textLines.push(`Email our founder: ${config.founderEmail}`);
    } else {
      lines.push(`Support & questions: <a href="mailto:${escapeHtml(config.supportEmail)}" style="color:#c4b5fd;text-decoration:none;">${escapeHtml(config.supportEmail)}</a>`);
      textLines.push(`Support & questions: ${config.supportEmail}`);
    }

    if (config.founderWhatsapp) {
      lines.push(`WhatsApp: ${escapeHtml(config.founderWhatsapp)}`);
      textLines.push(`WhatsApp: ${config.founderWhatsapp}`);
    }

    if (config.helpdeskUrl) {
      lines.push(`Help Center: <a href="${escapeHtml(config.helpdeskUrl)}" style="color:#c4b5fd;text-decoration:none;">${escapeHtml(config.helpdeskUrl)}</a>`);
      textLines.push(`Help Center: ${config.helpdeskUrl}`);
    }

    lines.push(`Book a 30-min consultation: <a href="${escapeHtml(config.consultationUrl)}" style="color:#c4b5fd;text-decoration:none;">Schedule call</a>`);
    textLines.push(`Book a 30-min consultation: ${config.consultationUrl}`);

    if (config.discordInviteUrl) {
      lines.push(`Community: <a href="${escapeHtml(config.discordInviteUrl)}" style="color:#c4b5fd;text-decoration:none;">Join Discord</a>`);
      textLines.push(`Community: ${config.discordInviteUrl}`);
    }

    contactHtml = `
      <div style="margin:24px 0 0;padding-top:20px;border-top:1px solid #3d3554;">
        <p style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:600;color:#f5f3ff;">Need help or have questions?</p>
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:#8b8499;">
          ${lines.join('<br>')}
        </p>
      </div>
    `;
    contactText = `\nNeed help or have questions?\n` + textLines.join('\n') + '\n';
  }

  const safePrivacy = escapeHtml(config.privacyUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${safeSubject}</title>
  <style type="text/css">
    @media screen and (max-width: 600px) {
      .lifecycle-email-card {
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;max-width:100%;background-color:#100e18;font-family:${FONT};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${safePreheader}${preheaderPad}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#100e18" style="background-color:#100e18;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <div class="lifecycle-email-card" style="width:100%;max-width:560px;margin:0 auto;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td>
        <![endif]-->
        <table class="lifecycle-email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100% !important;max-width:560px;border-collapse:collapse;table-layout:fixed;">
          <tr>
            <td bgcolor="#17141f" style="background-color:#17141f;border:1px solid #3d3554;border-radius:12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;">
                <tr>
                  <td style="padding:28px 24px 12px;border-bottom:1px solid #3d3554;">
                    <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c4b5fd;">Provvy</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px 20px;word-break:break-word;overflow-wrap:break-word;">
                    <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:#f5f3ff;">${safeHeadline}</h1>
                    ${props.bodyHtml}
                    ${primaryCtaHtml}
                    ${secondaryCtasHtml}
                    ${contactHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px 28px;border-top:1px solid #3d3554;word-break:break-word;overflow-wrap:break-word;">
                    <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.55;color:#8b8499;">
                      You are receiving this product lifecycle email because you created a verified workspace on Provvy.
                    </p>
                    <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.55;color:#8b8499;">
                      <a href="${safePrivacy}" style="color:#c4b5fd;text-decoration:underline;">Privacy Policy</a> &bull;
                      <a href="mailto:${escapeHtml(config.supportEmail)}" style="color:#c4b5fd;text-decoration:underline;">Email Preferences</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td></tr></table>
        <![endif]-->
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    props.preheader,
    '',
    props.headline,
    '='.repeat(props.headline.length),
    '',
    props.bodyText,
    primaryCtaText,
    secondaryCtasText,
    contactText,
    '---',
    'You are receiving this product lifecycle email because you created a verified workspace on Provvy.',
    `Privacy Policy: ${config.privacyUrl}`,
    `Support: ${config.supportEmail}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return {
    subject: props.subject,
    html,
    text,
  };
}
