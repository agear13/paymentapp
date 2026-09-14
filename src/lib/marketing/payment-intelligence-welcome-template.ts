import {
  getLifecycleContactConfig,
  resolveLifecycleAppUrl,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import {
  escapeHtml,
  renderLifecycleEmailLayout,
} from '@/lib/email/lifecycle/templates/lifecycle-email-layout';
import { PAYMENT_INTELLIGENCE_TOPICS } from '@/lib/marketing/payment-intelligence-subscribe';

export type PaymentIntelligenceWelcomeEmailParams = {
  unsubscribeUrl: string;
  signupUrl: string;
  contactConfig?: LifecycleContactConfig;
};

export function buildPaymentIntelligenceWelcomeEmail(
  params: PaymentIntelligenceWelcomeEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const config = params.contactConfig ?? getLifecycleContactConfig();
  const appUrl = resolveLifecycleAppUrl();

  const subject = 'Payment Intelligence — you are on the list';
  const preheader =
    'Rail updates, routes to consider, regulatory changes, and what they mean for your business.';
  const headline = 'Payment Intelligence is on its way';

  const topicItems = PAYMENT_INTELLIGENCE_TOPICS.map(
    (topic) =>
      `<li style="margin-bottom:8px;"><strong>${escapeHtml(topic.title)}</strong> — ${escapeHtml(topic.detail)}</li>`
  ).join('');

  const topicText = PAYMENT_INTELLIGENCE_TOPICS.map(
    (topic) => `- ${topic.title}: ${topic.detail}`
  ).join('\n');

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Thanks for subscribing. Provvy Payment Intelligence helps you stay ahead of how money actually moves — without noise or generic fintech updates.
    </p>
    <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      Here is what you can expect in your inbox:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#c9c2d8;">
      ${topicItems}
    </ul>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
      When you are ready to move from intelligence to action, Provvy helps businesses coordinate agreements, payments, and reconciliation in one workspace.
    </p>
  `;

  const bodyText = [
    'Thanks for subscribing to Provvy Payment Intelligence.',
    '',
    'Here is what you can expect:',
    topicText,
    '',
    'When you are ready to move from intelligence to action, Provvy helps businesses coordinate agreements, payments, and reconciliation in one workspace.',
  ].join('\n');

  return renderLifecycleEmailLayout({
    subject,
    preheader,
    headline,
    bodyHtml,
    bodyText,
    primaryCta: {
      label: 'Explore Provvy Today',
      url: appUrl,
    },
    secondaryCtas: [
      {
        label: 'Create your Provvy account',
        url: params.signupUrl,
      },
      {
        label: 'Book a 30-min consultation',
        url: config.consultationUrl,
      },
    ],
    showContactBlock: true,
    contactConfig: config,
    footerNotice:
      'You are receiving this email because you subscribed to Provvy Payment Intelligence.',
    emailPreferencesUrl: params.unsubscribeUrl,
    emailPreferencesLabel: 'Unsubscribe',
  });
}
