import {
    getLifecycleContactConfig,
    type LifecycleContactConfig,
  } from '@/lib/email/lifecycle/contact-config';
  import {
    escapeHtml,
    renderLifecycleEmailLayout,
  } from '@/lib/email/lifecycle/templates/lifecycle-email-layout';
  
  export type ActivationEmailParams = {
    userName?: string | null;
    contactConfig?: LifecycleContactConfig;
  };
  
  export function buildActivationEmail(
    params: ActivationEmailParams = {},
  ): {
    subject: string;
    html: string;
    text: string;
  } {
    const config = params.contactConfig || getLifecycleContactConfig();
  
    const greeting = params.userName
      ? `Hi ${escapeHtml(params.userName)},`
      : 'Hi there,';
  
    const subject = 'Your Provvy account is ready — here’s what to do next';
    const preheader =
      "You've verified your email. Your next step is to create your workspace and start exploring Provvy.";
    const headline = "You're in — let's get Provvy set up";
  
    const bodyHtml = `
      <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        ${greeting}
      </p>
  
      <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        Thanks for verifying your email.
      </p>
  
      <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        You've got a Provvy account — the next step is simply to create your workspace.
      </p>
  
      <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        Once you're in, you can start exploring how Provvy helps businesses make the movement of money clearer and easier to manage — from agreements and obligations through to payments, participants and reconciliation.
      </p>
  
      <div style="margin:0 0 20px;padding:16px;background-color:#1c1829;border-radius:8px;border:1px solid #3d3554;">
        <h3 style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#f5f3ff;">
          Your first step
        </h3>
  
        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#c9c2d8;">
          Create your workspace and have a look around. You don't need to have everything figured out first.
        </p>
      </div>
  
      <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        Once you're inside, your AI Advisor can help you work out what to do next, answer questions about Provvy, or help you think through a workflow you're currently managing manually.
      </p>
  
      <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        And if you're not sure where Provvy fits yet, that's completely fine.
      </p>
  
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c2d8;">
        We're building this alongside businesses actually dealing with these problems, so we'd genuinely rather understand how you work than have you force your process into a product.
      </p>
    `;
  
    const bodyText = [
      params.userName ? `Hi ${params.userName},` : 'Hi there,',
      '',
      'Thanks for verifying your email.',
      '',
      "You've got a Provvy account — the next step is simply to create your workspace.",
      '',
      'Once you are inside, you can explore how Provvy helps businesses make the movement of money clearer and easier to manage — from agreements and obligations through to payments, participants and reconciliation.',
      '',
      'Your first step:',
      "Create your workspace and have a look around. You don't need to have everything figured out first.",
      '',
      'Once you are inside, your AI Advisor can help you work out what to do next, answer questions about Provvy, or help you think through a workflow you are currently managing manually.',
      '',
      "And if you're not sure where Provvy fits yet, that's completely fine.",
      '',
      "We're building this alongside businesses actually dealing with these problems, so we'd genuinely rather understand how you work than have you force your process into a product.",
    ].join('\n');
  
    return renderLifecycleEmailLayout({
      subject,
      preheader,
      headline,
      bodyHtml,
      bodyText,
      primaryCta: {
        label: 'Create Your Workspace',
        url: `${config.appUrl}/journey/provisioning?build=1`,
      },
      secondaryCtas: [
        {
          label: 'Book a 30-min consultation',
          url: config.consultationUrl,
        },
      ],
      showContactBlock: true,
      contactConfig: config,
    });
  }