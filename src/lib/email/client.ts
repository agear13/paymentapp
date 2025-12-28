/**
 * Email Client using Resend
 * 
 * Resend is a modern email API that provides:
 * - High deliverability
 * - Email tracking (opens, clicks)
 * - Bounce handling
 * - Simple API
 * 
 * Alternative: Could use SendGrid, AWS SES, or Postmark
 */

import { Resend } from 'resend';

// Initialize Resend client
// Get API key from environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailResponse {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResponse> {
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || process.env.EMAIL_FROM || 'Provvypay <noreply@provvypay.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
      tags: options.tags,
    });

    if (error) {
      console.error('[Email] Send error:', error);
      return {
        id: '',
        success: false,
        error: error.message,
      };
    }

    return {
      id: data?.id || '',
      success: true,
    };
  } catch (error: any) {
    console.error('[Email] Unexpected error:', error);
    return {
      id: '',
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Send bulk emails (batch)
 */
export async function sendBulkEmails(emails: SendEmailOptions[]): Promise<EmailResponse[]> {
  const results = await Promise.allSettled(
    emails.map((email) => sendEmail(email))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        id: '',
        success: false,
        error: result.reason?.message || 'Failed to send email',
      };
    }
  });
}

/**
 * Get email delivery status from Resend
 */
export async function getEmailStatus(emailId: string) {
  try {
    const email = await resend.emails.get(emailId);
    return email;
  } catch (error: any) {
    console.error('[Email] Get status error:', error);
    return null;
  }
}

export { resend };







