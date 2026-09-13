import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';

export type WelcomeEmailParams = {
  userName?: string | null;
  workspaceName?: string | null;
  contactConfig?: LifecycleContactConfig;
};

export function buildWelcomeEmail(params: WelcomeEmailParams = {}): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig || getLifecycleContactConfig();
  const greeting = params.userName ? `Welcome, ${escapeHtml(params.userName)}!` : 'Welcome to Provvy!';
  const workspaceMention = params.workspaceName
    ? `Your workspace <strong>${escapeHtml(params.workspaceName)}</strong> is active and ready.`
    : 'Your workspace is active and ready.';

  const subject = 'Welcome to Provvy — your commercial operating system';
  const preheader = 'Your workspace is ready. Here is what Provvy does and how to get started.';
  const headline = greeting;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      ${workspaceMention} Provvy is the commercial operating system designed to give businesses clarity and control over their agreements, invoicing, cross-border payment intelligence, and ledger reconciliation.
    </p>
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Here is what you can do right now in your workspace:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#c9c2d8;">
      <li style="margin-bottom:8px;"><strong>Ask the AI Advisor</strong> — Get instant commercial answers, invoice assistance, and payment routing suggestions.</li>
      <li style="margin-bottom:8px;"><strong>Create Invoices & Payment Links</strong> — Bill clients across domestic and international corridors with live reference rates.</li>
      <li style="margin-bottom:8px;"><strong>Connect Systems</strong> — Optional integrations with Xero, Wise, and bank rails for automated reconciliation.</li>
    </ul>
  `;

  const bodyText = [
    params.userName ? `Welcome, ${params.userName}!` : 'Welcome to Provvy!',
    '',
    params.workspaceName
      ? `Your workspace "${params.workspaceName}" is active and ready.`
      : 'Your workspace is active and ready.',
    '',
    'Provvy is the commercial operating system designed to give businesses clarity and control over their agreements, invoicing, cross-border payment intelligence, and ledger reconciliation.',
    '',
    'Here is what you can do right now:',
    '- Ask the AI Advisor: Get instant commercial answers and payment routing suggestions.',
    '- Create Invoices & Payment Links: Bill clients with transparent economics.',
    '- Connect Systems: Optional integrations with Xero, Wise, and bank rails.',
  ].join('\n');

  const secondaryCtas: { label: string; url: string }[] = [
    { label: 'Try AI Advisor', url: config.advisorUrl },
    { label: 'Book a 30-min consultation', url: config.consultationUrl },
  ];

  if (config.discordInviteUrl) {
    secondaryCtas.push({ label: 'Join the Provvy Discord community', url: config.discordInviteUrl });
  }

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Open Your Workspace',
      url: `${config.appUrl}/dashboard`,
    },
    secondaryCtas,
    showContactBlock: true,
    contactConfig: config,
  });
}
