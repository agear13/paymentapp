import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';

export type ConsultationEmailParams = {
  userName?: string | null;
  contactConfig?: LifecycleContactConfig;
};

export function buildConsultationEmail(params: ConsultationEmailParams = {}): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig || getLifecycleContactConfig();
  const subject = 'Book a 30-minute commercial consultation with Provvy';
  const preheader = 'Walk through your payment corridors, ledger sync, or commercial workflow needs.';
  const headline = params.userName
    ? `Let's discuss your commercial operations, ${escapeHtml(params.userName)}`
    : "Let's discuss your commercial operations";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Every business handles payments, invoices, and contracts differently. Whether you are streamlining domestic payment links or managing cross-border supplier settlements, we are here to help you get the most out of Provvy.
    </p>
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      In this 30-minute consultation call, we can cover:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#c9c2d8;">
      <li style="margin-bottom:8px;">Evaluating your current payment corridor costs and FX transparency</li>
      <li style="margin-bottom:8px;">Configuring accounting integrations (such as Xero) for automated reconciliation</li>
      <li style="margin-bottom:8px;">Setting up agreement analysis and milestone invoice tracking</li>
    </ul>
  `;

  const bodyText = [
    headline,
    '',
    'Every business handles payments, invoices, and contracts differently. In this 30-minute consultation call, we can cover:',
    '- Evaluating your current payment corridor costs and FX transparency',
    '- Configuring accounting integrations for automated reconciliation',
    '- Setting up agreement analysis and milestone invoice tracking',
  ].join('\n');

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Schedule a 30-Min Call',
      url: config.consultationUrl,
    },
    secondaryCtas: [{ label: 'Open Your Workspace', url: `${config.appUrl}/dashboard` }],
    showContactBlock: true,
    contactConfig: config,
  });
}
