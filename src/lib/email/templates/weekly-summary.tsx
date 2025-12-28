export interface WeeklySummaryEmailProps {
  merchantName: string;
  weekStart: string;
  weekEnd: string;
  totalRevenue: string;
  totalPayments: number;
  stripeRevenue: string;
  hbarRevenue: string;
  usdcRevenue: string;
  usdtRevenue: string;
  auddRevenue: string;
  failedPayments: number;
  pendingXeroSyncs: number;
  dashboardUrl: string;
}

export function renderWeeklySummaryEmail(props: WeeklySummaryEmailProps): string {
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
      }
      .content {
        padding: 40px 30px;
      }
      .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin: 25px 0;
      }
      .stat-card {
        background: #f9fafb;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
      }
      .stat-value {
        font-size: 28px;
        font-weight: bold;
        color: #111827;
        margin: 10px 0;
      }
      .stat-label {
        color: #6b7280;
        font-size: 14px;
      }
      .breakdown {
        background: #f9fafb;
        padding: 25px;
        border-radius: 8px;
        margin: 25px 0;
      }
      .breakdown-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .breakdown-row:last-child {
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
      .alert {
        background: #fef2f2;
        border-left: 4px solid #ef4444;
        padding: 15px;
        margin: 20px 0;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <h1 style="margin: 0;">📊 Weekly Summary</h1>
        <p style="margin: 10px 0 0 0;">${props.weekStart} - ${props.weekEnd}</p>
      </div>

      <div class="content">
        <p>Hi ${props.merchantName},</p>
        
        <p>
          Here's your weekly payment summary. Great work this week!
        </p>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value">${props.totalRevenue}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Payments</div>
            <div class="stat-value">${props.totalPayments}</div>
          </div>
        </div>

        <h3>Revenue by Payment Method</h3>
        <div class="breakdown">
          <div class="breakdown-row">
            <span>💳 Stripe</span>
            <strong>${props.stripeRevenue}</strong>
          </div>
          <div class="breakdown-row">
            <span>ℏ Hedera - HBAR</span>
            <strong>${props.hbarRevenue}</strong>
          </div>
          <div class="breakdown-row">
            <span>💵 Hedera - USDC</span>
            <strong>${props.usdcRevenue}</strong>
          </div>
          <div class="breakdown-row">
            <span>💰 Hedera - USDT</span>
            <strong>${props.usdtRevenue}</strong>
          </div>
          <div class="breakdown-row">
            <span>🇦🇺 Hedera - AUDD</span>
            <strong>${props.auddRevenue}</strong>
          </div>
        </div>

        ${props.failedPayments > 0 || props.pendingXeroSyncs > 0 ? `
        <div class="alert">
          <strong>⚠️ Action Required:</strong><br>
          ${props.failedPayments > 0 ? `• ${props.failedPayments} failed payment(s)<br>` : ''}
          ${props.pendingXeroSyncs > 0 ? `• ${props.pendingXeroSyncs} pending Xero sync(s)` : ''}
        </div>
        ` : ''}

        <center>
          <a href="${props.dashboardUrl}" class="button">
            View Full Report
          </a>
        </center>

        <p>
          Keep up the great work! We'll send you another summary next week.
        </p>
      </div>

      <div class="footer">
        <p><strong>This is an automated weekly summary from Provvypay</strong></p>
        <p>You can manage your notification preferences in your dashboard settings.</p>
        <p>© ${new Date().getFullYear()} Provvypay. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`;
}







