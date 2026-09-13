import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';

export type AiAdvisorEmailParams = {
  userName?: string | null;
  contactConfig?: LifecycleContactConfig;
};

export const ADVISOR_EXAMPLE_PROMPTS = [
  'What is the most cost-effective route to settle a $10,000 AUD payment to Indonesia?',
  'Does our quoted FX include spread, and how does it compare to the official RBA reference?',
  'What commercial milestones are pending across our active agreements this month?',
] as const;

export function buildAiAdvisorEmail(params: AiAdvisorEmailParams = {}): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig || getLifecycleContactConfig();
  const subject = 'Meet your Provvy AI Advisor';
  const preheader = 'Get commercial guidance, payment route intelligence, and agreement analysis.';
  const headline = 'Commercial answers right in your workspace';

  const promptQuotesHtml = ADVISOR_EXAMPLE_PROMPTS.map(
    (prompt) => `
      <div style="margin-bottom:10px;padding:10px 14px;background-color:#221c32;border-left:3px solid #7C5CFF;border-radius:4px;">
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#ece8f4;">
          &ldquo;${escapeHtml(prompt)}&rdquo;
        </p>
      </div>`
  ).join('');

  const promptQuotesText = ADVISOR_EXAMPLE_PROMPTS.map((p) => `> "${p}"`).join('\n\n');

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Managing commercial operations often involves scattered documents, complex cross-border rate quotes, and manual reconciliation checks.
    </p>
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      The <strong>Provvy AI Advisor</strong> is built into your workspace to answer questions grounded in your actual business context, ledger data, and real payment corridors.
    </p>
    <p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9b7dff;">
      Try asking questions like:
    </p>
    ${promptQuotesHtml}
    <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#c9c2d8;">
      The Advisor is available 24/7 inside your Provvy dashboard with zero additional setup.
    </p>
  `;

  const bodyText = [
    'Meet your Provvy AI Advisor — Commercial answers right in your workspace.',
    '',
    'Managing commercial operations often involves scattered documents, complex cross-border rate quotes, and manual reconciliation checks.',
    'The Provvy AI Advisor is built into your workspace to answer questions grounded in your actual business context, ledger data, and real payment corridors.',
    '',
    'Try asking questions like:',
    promptQuotesText,
    '',
    'The Advisor is available 24/7 inside your Provvy dashboard.',
  ].join('\n');

  const secondaryCtas: { label: string; url: string }[] = [
    { label: 'Book a 30-min consultation', url: config.consultationUrl },
  ];

  if (config.discordInviteUrl) {
    secondaryCtas.push({ label: 'Join Community', url: config.discordInviteUrl });
  }

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Open AI Advisor',
      url: config.advisorUrl,
    },
    secondaryCtas,
    showContactBlock: true,
    contactConfig: config,
  });
}
