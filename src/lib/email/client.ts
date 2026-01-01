/**
 * Email Client (optional Resend integration)
 *
 * This module is build-safe even if the `resend` package is not installed.
 * If Resend isn't available (or RESEND_API_KEY missing), sendEmail() will
 * return success:false and log a warning instead of crashing the build.
 */

type ResendCtor = new (apiKey?: string) => {
  emails: {
    send: (args: any) => Promise<{ data?: { id?: string } | null; error?: { message?: string } | null }>
    get: (id: string) => Promise<any>
  }
}

// Lazy-loaded Resend instance (so missing dependency doesn't fail build)
let resend: InstanceType<ResendCtor> | null = null
let resendInitAttempted = false

async function getResendClient() {
  if (resend || resendInitAttempted) return resend
  resendInitAttempted = true

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set. Email sending disabled.')
    return null
  }

  try {
    // dynamic import so build doesn't require `resend` installed
    const mod: any = await import('resend')
    const Resend: ResendCtor = mod.Resend
    resend = new Resend(apiKey)
    return resend
  } catch (err: any) {
    console.warn(
      "[Email] 'resend' package not available. Run `npm i resend` to enable email sending.",
      err?.message || err
    )
    return null
  }
}

export interface SendEmailOptions {
  to: string | string[]
  from?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}

export interface EmailResponse {
  id: string
  success: boolean
  error?: string
}

/**
 * Send an email.
 * If Resend isn't configured, this returns success:false (and does not throw).
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResponse> {
  try {
    const client = await getResendClient()
    if (!client) {
      return {
        id: '',
        success: false,
        error: 'Email provider not configured (Resend not available)',
      }
    }

    const { data, error } = await client.emails.send({
      from: options.from || process.env.EMAIL_FROM || 'Provvypay <noreply@provvypay.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
      tags: options.tags,
    })

    if (error) {
      console.error('[Email] Send error:', error)
      return { id: '', success: false, error: error.message || 'Failed to send email' }
    }

    return { id: data?.id || '', success: true }
  } catch (error: any) {
    console.error('[Email] Unexpected error:', error)
    return { id: '', success: false, error: error.message || 'Failed to send email' }
  }
}

/**
 * Send bulk emails (batch)
 */
export async function sendBulkEmails(emails: SendEmailOptions[]): Promise<EmailResponse[]> {
  const results = await Promise.allSettled(emails.map((email) => sendEmail(email)))

  return results.map((result) => {
    if (result.status === 'fulfilled') return result.value
    return { id: '', success: false, error: (result.reason as any)?.message || 'Failed to send email' }
  })
}

/**
 * Get email delivery status from Resend.
 * Returns null if email provider isn't configured.
 */
export async function getEmailStatus(emailId: string) {
  try {
    const client = await getResendClient()
    if (!client) return null
    return await client.emails.get(emailId)
  } catch (error: any) {
    console.error('[Email] Get status error:', error)
    return null
  }
}

// Optional export for places that want direct access.
// Will be null unless Resend successfully initialised.
export { resend }
