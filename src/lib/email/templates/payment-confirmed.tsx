import * as React from 'react';

export interface PaymentConfirmedEmailProps {
  customerName?: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  tokenType?: string;
  shortCode: string;
  description: string;
  invoiceReference?: string;
  transactionId?: string;
  merchantName: string;
}

export function PaymentConfirmedEmail({
  customerName,
  amount,
  currency,
  paymentMethod,
  tokenType,
  shortCode,
  description,
  invoiceReference,
  transactionId,
  merchantName,
}: PaymentConfirmedEmailProps) {
  const paymentMethodDisplay = 
    paymentMethod === 'HEDERA' && tokenType
      ? `Hedera - ${tokenType}`
      : paymentMethod === 'STRIPE'
      ? 'Credit Card (Stripe)'
      : paymentMethod;

  return (
    <html>
      <head>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .success-icon {
            font-size: 48px;
            margin-bottom: 10px;
          }
          .amount {
            font-size: 36px;
            font-weight: bold;
            color: #10b981;
            margin: 20px 0;
          }
          .details {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #6b7280;
            font-weight: 500;
          }
          .detail-value {
            color: #111827;
            font-weight: 600;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin: 20px 0;
          }
        `}</style>
      </head>
      <body>
        <div className="header">
          <div className="success-icon">✓</div>
          <h1 style={{ margin: 0 }}>Payment Confirmed!</h1>
          <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
            Your payment has been successfully processed
          </p>
        </div>

        <div className="content">
          {customerName && (
            <p>Hi {customerName},</p>
          )}
          
          <p>
            Thank you for your payment! We've received your payment and it has been confirmed.
          </p>

          <div className="amount">
            {currency} {amount}
          </div>

          <div className="details">
            <div className="detail-row">
              <span className="detail-label">Payment Method</span>
              <span className="detail-value">{paymentMethodDisplay}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Description</span>
              <span className="detail-value">{description}</span>
            </div>

            {invoiceReference && (
              <div className="detail-row">
                <span className="detail-label">Invoice Reference</span>
                <span className="detail-value">{invoiceReference}</span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">Payment Link</span>
              <span className="detail-value">{shortCode}</span>
            </div>

            {transactionId && (
              <div className="detail-row">
                <span className="detail-label">Transaction ID</span>
                <span className="detail-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                  {transactionId}
                </span>
              </div>
            )}
          </div>

          <p>
            If you have any questions about this payment, please contact {merchantName}.
          </p>
        </div>

        <div className="footer">
          <p style={{ margin: '0 0 10px 0' }}>
            This is an automated email from Provvypay
          </p>
          <p style={{ margin: 0, fontSize: '12px' }}>
            © {new Date().getFullYear()} Provvypay. All rights reserved.
          </p>
        </div>
      </body>
    </html>
  );
}

/**
 * Generate HTML for payment confirmed email
 */
export function renderPaymentConfirmedEmail(props: PaymentConfirmedEmailProps): string {
  const paymentMethodDisplay = 
    props.paymentMethod === 'HEDERA' && props.tokenType
      ? `Hedera - ${props.tokenType}`
      : props.paymentMethod === 'STRIPE'
      ? 'Credit Card (Stripe)'
      : props.paymentMethod;

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
      .success-icon {
        font-size: 64px;
        margin-bottom: 15px;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
      }
      .header p {
        margin: 10px 0 0 0;
        opacity: 0.95;
        font-size: 16px;
      }
      .content {
        padding: 40px 30px;
      }
      .amount {
        font-size: 42px;
        font-weight: bold;
        color: #10b981;
        text-align: center;
        margin: 30px 0;
      }
      .details {
        background: #f9fafb;
        padding: 25px;
        border-radius: 8px;
        margin: 25px 0;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-label {
        color: #6b7280;
        font-weight: 500;
      }
      .detail-value {
        color: #111827;
        font-weight: 600;
        text-align: right;
        max-width: 60%;
        word-break: break-word;
      }
      .footer {
        background: #f9fafb;
        padding: 25px;
        text-align: center;
        color: #6b7280;
        font-size: 14px;
      }
      .footer p {
        margin: 5px 0;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="success-icon">✓</div>
        <h1>Payment Confirmed!</h1>
        <p>Your payment has been successfully processed</p>
      </div>

      <div class="content">
        ${props.customerName ? `<p>Hi ${props.customerName},</p>` : '<p>Hello,</p>'}
        
        <p>
          Thank you for your payment! We've received your payment and it has been confirmed.
        </p>

        <div class="amount">
          ${props.currency} ${props.amount}
        </div>

        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">${paymentMethodDisplay}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">${props.description}</span>
          </div>

          ${props.invoiceReference ? `
          <div class="detail-row">
            <span class="detail-label">Invoice Reference</span>
            <span class="detail-value">${props.invoiceReference}</span>
          </div>
          ` : ''}

          <div class="detail-row">
            <span class="detail-label">Payment Link</span>
            <span class="detail-value">${props.shortCode}</span>
          </div>

          ${props.transactionId ? `
          <div class="detail-row">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value" style="font-size: 11px;">${props.transactionId}</span>
          </div>
          ` : ''}
        </div>

        <p>
          If you have any questions about this payment, please contact ${props.merchantName}.
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

