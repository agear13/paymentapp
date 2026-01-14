export interface XeroSyncFailedEmailProps {
  merchantName: string;
  paymentLinkId: string;
  shortCode: string;
  amount: string;
  currency: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  dashboardUrl: string;
}

export function renderXeroSyncFailedEmail(props: XeroSyncFailedEmailProps): string {
  const isLastRetry = props.retryCount >= props.maxRetries;

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
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
      }
      .warning-icon {
        font-size: 64px;
        margin-bottom: 15px;
      }
      .content {
        padding: 40px 30px;
      }
      .error-box {
        background: #fffbeb;
        border-left: 4px solid #f59e0b;
        padding: 20px;
        margin: 25px 0;
        border-radius: 4px;
      }
      .details {
        background: #f9fafb;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .detail-row {
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .detail-row:last-child {
        border-bottom: none;
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
        <div class="warning-icon">⚠️</div>
        <h1 style="margin: 0;">Xero Sync Failed</h1>
        <p style="margin: 10px 0 0 0;">Action required: Manual intervention needed</p>
      </div>

      <div class="content">
        <p>Hi ${props.merchantName},</p>
        
        <p>
          We encountered an issue while syncing a payment to your Xero account. 
          ${isLastRetry 
            ? 'After multiple retry attempts, we were unable to complete the sync automatically.' 
            : 'We will automatically retry, but you may want to check the details below.'}
        </p>

        <div class="details">
          <div class="detail-row">
            <strong>Invoice:</strong> ${props.shortCode}
          </div>
          <div class="detail-row">
            <strong>Amount:</strong> ${props.currency} ${props.amount}
          </div>
          <div class="detail-row">
            <strong>Retry Attempt:</strong> ${props.retryCount} of ${props.maxRetries}
          </div>
        </div>

        <div class="error-box">
          <strong>Error Details:</strong><br>
          ${props.errorMessage}
        </div>

        <p><strong>What to do next:</strong></p>
        <ul>
          <li>Check your Xero connection status</li>
          <li>Verify your Xero account mappings are correct</li>
          <li>Review the error details above</li>
          ${isLastRetry ? '<li><strong>Manually replay the sync from your dashboard</strong></li>' : ''}
        </ul>

        <center>
          <a href="${props.dashboardUrl}" class="button">
            View in Dashboard
          </a>
        </center>

        <p>
          ${isLastRetry 
            ? 'Please resolve this issue as soon as possible to ensure accurate bookkeeping.' 
            : 'We will continue to retry automatically. You will receive another notification if all retries fail.'}
        </p>
      </div>

      <div class="footer">
        <p><strong>This is an automated alert from Provvypay</strong></p>
        <p>© ${new Date().getFullYear()} Provvypay. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`;
}







