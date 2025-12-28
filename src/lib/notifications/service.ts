/**
 * Notification Service
 * 
 * Handles creating and sending notifications via:
 * - Email (using Resend)
 * - In-app notifications (database)
 * 
 * Respects user notification preferences
 */

import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/client';
import {
  renderPaymentConfirmedEmail,
  renderPaymentFailedEmail,
  renderXeroSyncFailedEmail,
  renderWeeklySummaryEmail,
  type PaymentConfirmedEmailProps,
  type PaymentFailedEmailProps,
  type XeroSyncFailedEmailProps,
  type WeeklySummaryEmailProps,
} from '@/lib/email/templates';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType =
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_EXPIRED'
  | 'XERO_SYNC_FAILED'
  | 'RECONCILIATION_ISSUE'
  | 'SECURITY_ALERT'
  | 'WEEKLY_SUMMARY'
  | 'SYSTEM_ALERT';

export interface CreateNotificationOptions {
  organizationId: string;
  userEmail?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  sendEmail?: boolean;
}

/**
 * Create a notification (in-app and optionally email)
 */
export async function createNotification(options: CreateNotificationOptions) {
  const {
    organizationId,
    userEmail,
    type,
    title,
    message,
    data,
    sendEmail: shouldSendEmail = true,
  } = options;

  try {
    // Check user preferences
    let preferences = null;
    if (userEmail) {
      preferences = await prisma.notification_preferences.findUnique({
        where: {
          organization_id_user_email: {
            organization_id: organizationId,
            user_email: userEmail,
          },
        },
      });
    }

    // Determine if we should send email and in-app based on preferences
    const shouldSendEmailNotification =
      shouldSendEmail &&
      userEmail &&
      (preferences ? getEmailPreference(preferences, type) : true);

    const shouldCreateInAppNotification =
      preferences ? getInAppPreference(preferences, type) : true;

    // Create in-app notification
    let notification = null;
    if (shouldCreateInAppNotification) {
      notification = await prisma.notifications.create({
        data: {
          id: uuidv4(),
          organization_id: organizationId,
          user_email: userEmail,
          type,
          title,
          message,
          data: data || {},
          read: false,
          email_sent: false,
        },
      });
    }

    // Send email if needed
    if (shouldSendEmailNotification && notification) {
      // Email sending will be handled by a separate queue/job
      // For now, we'll mark it as pending
      await prisma.email_logs.create({
        data: {
          id: uuidv4(),
          notification_id: notification.id,
          to_email: userEmail!,
          from_email: process.env.EMAIL_FROM || 'noreply@provvypay.com',
          subject: title,
          template_name: type,
          template_data: data || {},
          status: 'PENDING',
        },
      });
    }

    return notification;
  } catch (error) {
    console.error('[Notification Service] Error creating notification:', error);
    throw error;
  }
}

/**
 * Send payment confirmed notification
 */
export async function notifyPaymentConfirmed(
  organizationId: string,
  paymentData: PaymentConfirmedEmailProps & { customerEmail?: string }
) {
  const html = renderPaymentConfirmedEmail(paymentData);

  // Create in-app notification
  await createNotification({
    organizationId,
    userEmail: paymentData.customerEmail,
    type: 'PAYMENT_CONFIRMED',
    title: 'Payment Confirmed',
    message: `Payment of ${paymentData.currency} ${paymentData.amount} has been confirmed`,
    data: paymentData,
    sendEmail: true,
  });

  // Send email directly (for customer notifications)
  if (paymentData.customerEmail) {
    const result = await sendEmail({
      to: paymentData.customerEmail,
      subject: `Payment Confirmed - ${paymentData.currency} ${paymentData.amount}`,
      html,
    });

    // Log email
    await prisma.email_logs.create({
      data: {
        id: uuidv4(),
        to_email: paymentData.customerEmail,
        from_email: process.env.EMAIL_FROM || 'noreply@provvypay.com',
        subject: `Payment Confirmed - ${paymentData.currency} ${paymentData.amount}`,
        template_name: 'PAYMENT_CONFIRMED',
        template_data: paymentData,
        status: result.success ? 'SENT' : 'FAILED',
        provider_id: result.id,
        error_message: result.error,
      },
    });
  }
}

/**
 * Send payment failed notification
 */
export async function notifyPaymentFailed(
  organizationId: string,
  paymentData: PaymentFailedEmailProps & { customerEmail?: string }
) {
  const html = renderPaymentFailedEmail(paymentData);

  await createNotification({
    organizationId,
    userEmail: paymentData.customerEmail,
    type: 'PAYMENT_FAILED',
    title: 'Payment Failed',
    message: `Payment of ${paymentData.currency} ${paymentData.amount} failed`,
    data: paymentData,
    sendEmail: true,
  });

  if (paymentData.customerEmail) {
    const result = await sendEmail({
      to: paymentData.customerEmail,
      subject: `Payment Failed - ${paymentData.currency} ${paymentData.amount}`,
      html,
    });

    await prisma.email_logs.create({
      data: {
        id: uuidv4(),
        to_email: paymentData.customerEmail,
        from_email: process.env.EMAIL_FROM || 'noreply@provvypay.com',
        subject: `Payment Failed - ${paymentData.currency} ${paymentData.amount}`,
        template_name: 'PAYMENT_FAILED',
        template_data: paymentData,
        status: result.success ? 'SENT' : 'FAILED',
        provider_id: result.id,
        error_message: result.error,
      },
    });
  }
}

/**
 * Send Xero sync failed notification
 */
export async function notifyXeroSyncFailed(
  organizationId: string,
  merchantEmail: string,
  syncData: XeroSyncFailedEmailProps
) {
  const html = renderXeroSyncFailedEmail(syncData);

  await createNotification({
    organizationId,
    userEmail: merchantEmail,
    type: 'XERO_SYNC_FAILED',
    title: 'Xero Sync Failed',
    message: `Xero sync failed for payment ${syncData.shortCode}`,
    data: syncData,
    sendEmail: true,
  });

  const result = await sendEmail({
    to: merchantEmail,
    subject: `⚠️ Xero Sync Failed - ${syncData.shortCode}`,
    html,
  });

  await prisma.email_logs.create({
    data: {
      id: uuidv4(),
      to_email: merchantEmail,
      from_email: process.env.EMAIL_FROM || 'noreply@provvypay.com',
      subject: `⚠️ Xero Sync Failed - ${syncData.shortCode}`,
      template_name: 'XERO_SYNC_FAILED',
      template_data: syncData,
      status: result.success ? 'SENT' : 'FAILED',
      provider_id: result.id,
      error_message: result.error,
    },
  });
}

/**
 * Send weekly summary
 */
export async function sendWeeklySummary(
  organizationId: string,
  merchantEmail: string,
  summaryData: WeeklySummaryEmailProps
) {
  const html = renderWeeklySummaryEmail(summaryData);

  await createNotification({
    organizationId,
    userEmail: merchantEmail,
    type: 'WEEKLY_SUMMARY',
    title: 'Weekly Summary',
    message: `Your weekly summary is ready`,
    data: summaryData,
    sendEmail: true,
  });

  const result = await sendEmail({
    to: merchantEmail,
    subject: `📊 Weekly Summary - ${summaryData.weekStart} to ${summaryData.weekEnd}`,
    html,
  });

  await prisma.email_logs.create({
    data: {
      id: uuidv4(),
      to_email: merchantEmail,
      from_email: process.env.EMAIL_FROM || 'noreply@provvypay.com',
      subject: `📊 Weekly Summary - ${summaryData.weekStart} to ${summaryData.weekEnd}`,
      template_name: 'WEEKLY_SUMMARY',
      template_data: summaryData,
      status: result.success ? 'SENT' : 'FAILED',
      provider_id: result.id,
      error_message: result.error,
    },
  });
}

/**
 * Get email preference for notification type
 */
function getEmailPreference(preferences: any, type: NotificationType): boolean {
  switch (type) {
    case 'PAYMENT_CONFIRMED':
      return preferences.payment_confirmed_email;
    case 'PAYMENT_FAILED':
      return preferences.payment_failed_email;
    case 'XERO_SYNC_FAILED':
      return preferences.xero_sync_failed_email;
    case 'RECONCILIATION_ISSUE':
      return preferences.reconciliation_issue_email;
    case 'WEEKLY_SUMMARY':
      return preferences.weekly_summary_email;
    case 'SECURITY_ALERT':
      return preferences.security_alert_email;
    default:
      return true;
  }
}

/**
 * Get in-app preference for notification type
 */
function getInAppPreference(preferences: any, type: NotificationType): boolean {
  switch (type) {
    case 'PAYMENT_CONFIRMED':
      return preferences.payment_confirmed_inapp;
    case 'PAYMENT_FAILED':
      return preferences.payment_failed_inapp;
    case 'XERO_SYNC_FAILED':
      return preferences.xero_sync_failed_inapp;
    default:
      return true;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  return await prisma.notifications.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Get unread notifications for user
 */
export async function getUnreadNotifications(
  organizationId: string,
  userEmail?: string
) {
  return await prisma.notifications.findMany({
    where: {
      organization_id: organizationId,
      ...(userEmail && { user_email: userEmail }),
      read: false,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 50,
  });
}

/**
 * Get all notifications for user
 */
export async function getNotifications(
  organizationId: string,
  userEmail?: string,
  limit = 50
) {
  return await prisma.notifications.findMany({
    where: {
      organization_id: organizationId,
      ...(userEmail && { user_email: userEmail }),
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  });
}







