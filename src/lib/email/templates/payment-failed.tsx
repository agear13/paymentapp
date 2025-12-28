export interface PaymentFailedEmailProps {
  customerName?: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  shortCode: string;
  description: string;
  errorMessage?: string;
  retryUrl: string;
  merchantName: string;
}

export function renderPaymentFailedEmail(props: PaymentFailedEmailProps): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f3f4f6;
      }
      .email-container {
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
      }
      .error-icon {
        font-size: 64px;
        margin-bottom: 15px;
      }
      .content {
        padding: 40px 30px;
      }
      .amount {
        font-size: 36px;
        font-weight: bold;
        color: #6b7280;
        text-align: center;
        margin: 25px 0;
      }
      .error-box {
        background: #fef2f2;
        border-left: 4px solid #ef4444;
        padding: 20px;
        margin: 25px 0;
        border-radius: 4px;
      }
      .button {
        display: inline-block;
        background: #667eea;
        color: white !important;
        padding: 14px 28px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        margin: 25px 0;
        text-align: center;
      }
      .footer {
        background: #f9fafb;
        padding: 25px;
        text-align: center;
        color: #6b7280;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="error-icon">⚠️</div>
        <h1 style="margin: 0;">Payment Failed</h1>
        <p style="margin: 10px 0 0 0;">We couldn't process your payment</p>
      </div>

      <div class="content">
        ${props.customerName ? `<p>Hi ${props.customerName},</p>` : '<p>Hello,</p>'}
        
        <p>
          Unfortunately, we were unable to process your payment. This can happen for various reasons, such as insufficient funds, incorrect payment details, or network issues.
        </p>

        <div class="amount">
          ${props.currency} ${props.amount}
        </div>

        ${props.errorMessage ? `
        <div class="error-box">
          <strong>Error Details:</strong><br>
          ${props.errorMessage}
        </div>
        ` : ''}

        <p><strong>What to do next:</strong></p>
        <ul>
          <li>Check your payment method details</li>
          <li>Ensure you have sufficient funds</li>
          <li>Try a different payment method</li>
          <li>Contact your bank if the issue persists</li>
        </ul>

        <center>
          <a href="${props.retryUrl}" class="button">
            Try Again
          </a>
        </center>

        <p>
          If you continue to experience issues, please contact ${props.merchantName} for assistance.
        </p>
      </div>

      <div class="footer">
        <p><strong>This is an automated email from Provvypay</strong></p>
        <p>© ${new Date().getFullYear()} Provvypay. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`;
}







