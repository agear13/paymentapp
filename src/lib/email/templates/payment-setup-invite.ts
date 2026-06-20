/**
 * Payment Setup Invitation Email Template
 *
 * Sent to suppliers after their agreement is approved, inviting them to complete
 * their payment information via the public portal.
 *
 * Uses plain HTML — no JSX — so it can be called from server-only code.
 */

export type PaymentSetupEmailParams = {
  supplierName: string;
  operatorName: string;
  projectName: string;
  invoiceTotal: string;
  portalUrl: string;
  expiresAt: string;
};

export function buildPaymentSetupInviteEmail(params: PaymentSetupEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { supplierName, operatorName, projectName, invoiceTotal, portalUrl, expiresAt } = params;

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const subject = `Action required: Complete your payment information for ${projectName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete your payment information</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 40px auto; padding: 0 16px; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .header { background: #0f172a; padding: 28px 32px; }
    .header-logo { color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.025em; }
    .body { padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    p { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 16px; }
    .invoice-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .invoice-row { display: flex; justify-content: space-between; font-size: 14px; color: #64748b; margin-bottom: 6px; }
    .invoice-total { font-weight: 700; color: #0f172a; font-size: 16px; }
    .checklist { list-style: none; padding: 0; margin: 16px 0 24px; }
    .checklist li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #475569; padding: 4px 0; }
    .check { color: #10b981; font-size: 16px; }
    .cta { display: block; background: #0f172a; color: #ffffff; text-decoration: none; text-align: center; border-radius: 8px; padding: 14px 24px; font-size: 15px; font-weight: 600; margin: 24px 0 16px; }
    .expiry { font-size: 13px; color: #94a3b8; text-align: center; }
    .footer { padding: 20px 32px; border-top: 1px solid #f1f5f9; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 0; }
    .url-fallback { font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-logo">Provvy</div>
      </div>
      <div class="body">
        <h1>Hi ${supplierName}, please complete your payment information</h1>
        <p>
          ${operatorName} needs your payment details to finalise your invoice for
          <strong>${projectName}</strong>. This only takes a few minutes.
        </p>

        <div class="invoice-box">
          <div class="invoice-row">
            <span>Project</span>
            <span><strong>${projectName}</strong></span>
          </div>
          <div class="invoice-row invoice-total">
            <span>Invoice total</span>
            <span>${invoiceTotal}</span>
          </div>
        </div>

        <p style="font-size:14px;color:#475569;margin-bottom:8px;"><strong>You'll be asked to provide:</strong></p>
        <ul class="checklist">
          <li><span class="check">✓</span> Review your invoice</li>
          <li><span class="check">✓</span> Bank account or alternative payment method</li>
          <li><span class="check">✓</span> ABN (if you have one)</li>
          <li><span class="check">✓</span> GST registration status</li>
        </ul>

        <a href="${portalUrl}" class="cta">Complete your payment information</a>
        <p class="expiry">Link expires ${expiryDate}</p>
      </div>
      <div class="footer">
        <p>This link was sent by ${operatorName} via Provvy. If you weren't expecting this email, you can safely ignore it.</p>
        <p class="url-fallback">If the button above doesn't work, copy this link: ${portalUrl}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${supplierName},

${operatorName} needs your payment details to finalise your invoice for ${projectName} (${invoiceTotal}).

Complete your payment information here:
${portalUrl}

You'll need to provide:
- Review your invoice
- Bank account or alternative payment method  
- ABN (if you have one)
- GST registration status

This link expires on ${expiryDate}.

If you weren't expecting this email, you can safely ignore it.`;

  return { subject, html, text };
}
