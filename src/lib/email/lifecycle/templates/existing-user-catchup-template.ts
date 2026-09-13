import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';

export type ExistingUserCatchupEmailParams = {
  userName?: string | null;
  workspaceName?: string | null;
  contactConfig?: LifecycleContactConfig;
};

export function buildExistingUserCatchupEmail(params: ExistingUserCatchupEmailParams = {}): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig || getLifecycleContactConfig();
  const nameGreeting = params.userName ? `${escapeHtml(params.userName)}, you're` : "You're";

  const subject = "You're already part of Provvy — here's how to get the most out of it";
  const preheader = "A quick overview of what is available in your Provvy workspace today.";
  const headline = `${nameGreeting} already part of Provvy`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      You set up your Provvy account, but we haven't checked in recently. We've introduced substantial improvements to the platform to help you coordinate commercial workflows with less friction.
    </p>
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Here is everything you should know to get the most value out of your workspace:
    </p>
    <div style="margin:0 0 20px;padding:16px;background-color:#1c1829;border-radius:8px;border:1px solid #3d3554;">
      <h3 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#f5f3ff;">1. AI Advisor</h3>
      <p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#c9c2d8;">
        Ask contextual questions about your commercial terms, compare payment routing options, and plan operational workflows.
      </p>
      <h3 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#f5f3ff;">2. Connected Economic Intelligence</h3>
      <p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#c9c2d8;">
        Real route economics and official reference rate comparisons (such as RBA AUD→IDR benchmarks) without guessing fees or hidden FX spreads.
      </p>
      <h3 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#f5f3ff;">3. System Integrations</h3>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#c9c2d8;">
        Link your Xero ledger or Wise account to keep payments, invoices, and accounting in sync.
      </p>
    </div>
  `;

  const bodyText = [
    `${params.userName ? `${params.userName}, you're` : "You're"} already part of Provvy — here's how to get the most out of it.`,
    '',
    "You set up your Provvy account, but we haven't checked in recently. We've introduced substantial improvements to the platform to help you coordinate commercial workflows with less friction.",
    '',
    'Core capabilities in your workspace:',
    '1. AI Advisor: Contextual guidance on commercial terms and payment routing.',
    '2. Connected Economic Intelligence: Real provider quotes vs official reference rates.',
    '3. System Integrations: Sync with Xero, Wise, and bank rails.',
  ].join('\n');

  const secondaryCtas: { label: string; url: string }[] = [
    { label: 'Try AI Advisor', url: config.advisorUrl },
    { label: 'Book a 30-min walkthrough call', url: config.consultationUrl },
  ];

  if (config.discordInviteUrl) {
    secondaryCtas.push({ label: 'Join Provvy Community', url: config.discordInviteUrl });
  }

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Open Provvy',
      url: `${config.appUrl}/dashboard`,
    },
    secondaryCtas,
    showContactBlock: true,
    contactConfig: config,
  });
}
