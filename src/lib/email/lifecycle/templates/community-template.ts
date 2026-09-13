import {
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';

export type CommunityEmailParams = {
  userName?: string | null;
  contactConfig?: LifecycleContactConfig;
};

export function buildCommunityInviteEmail(params: CommunityEmailParams = {}): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig || getLifecycleContactConfig();
  if (!config.discordInviteUrl) {
    throw new Error('Cannot build community invite email without configured DISCORD_INVITE_URL');
  }

  const subject = 'Join the Provvy Community on Discord';
  const preheader = 'Connect with operators, accountants, and partners shaping commercial workflows.';
  const headline = params.userName
    ? `Join the Provvy community, ${escapeHtml(params.userName)}`
    : 'Join the Provvy community';

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Provvy brings together business operators, accountants, finance teams, and partners who are building modern commercial operations.
    </p>
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      In our community Discord, members share:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#c9c2d8;">
      <li style="margin-bottom:8px;"><strong>Product Updates & Early Access</strong> — Be the first to try new corridors, AI tools, and features.</li>
      <li style="margin-bottom:8px;"><strong>Workflow Best Practices</strong> — Real-world patterns for invoice reconciliation, agreement milestones, and multi-currency routing.</li>
      <li style="margin-bottom:8px;"><strong>Direct Feedback</strong> — Speak directly with our product and engineering team.</li>
    </ul>
  `;

  const bodyText = [
    headline,
    '',
    'Provvy brings together business operators, accountants, finance teams, and partners who are building modern commercial operations.',
    '',
    'In our Discord community, members share:',
    '- Product Updates & Early Access: First look at new features and corridors.',
    '- Workflow Best Practices: Real-world patterns for reconciliation and payment routing.',
    '- Direct Feedback: Speak directly with our team.',
  ].join('\n');

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Join Provvy Discord',
      url: config.discordInviteUrl,
    },
    secondaryCtas: [{ label: 'Open Workspace', url: `${config.appUrl}/dashboard` }],
    showContactBlock: true,
    contactConfig: config,
  });
}
