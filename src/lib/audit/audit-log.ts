/**
 * Comprehensive Audit Logging System
 * 
 * Tracks all security-relevant events and user actions
 * Compliance with SOC 2, ISO 27001, and GDPR audit requirements
 */

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication Events
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_PASSWORD_CHANGE = 'auth.password.change',
  AUTH_MFA_ENABLED = 'auth.mfa.enabled',
  AUTH_MFA_DISABLED = 'auth.mfa.disabled',
  
  // Authorization Events
  ACCESS_GRANTED = 'access.granted',
  ACCESS_DENIED = 'access.denied',
  PERMISSION_CHANGED = 'permission.changed',
  
  // Data Events
  DATA_CREATED = 'data.created',
  DATA_UPDATED = 'data.updated',
  DATA_DELETED = 'data.deleted',
  DATA_EXPORTED = 'data.exported',
  DATA_IMPORTED = 'data.imported',
  
  // Payment Events
  PAYMENT_LINK_CREATED = 'payment.link.created',
  PAYMENT_LINK_CANCELED = 'payment.link.canceled',
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_REFUNDED = 'payment.refunded',
  
  // Integration Events
  XERO_CONNECTED = 'xero.connected',
  XERO_DISCONNECTED = 'xero.disconnected',
  XERO_SYNC_SUCCESS = 'xero.sync.success',
  XERO_SYNC_FAILED = 'xero.sync.failed',
  STRIPE_WEBHOOK_RECEIVED = 'stripe.webhook.received',
  
  // Security Events
  SECURITY_CSRF_VIOLATION = 'security.csrf.violation',
  SECURITY_RATE_LIMIT_EXCEEDED = 'security.ratelimit.exceeded',
  SECURITY_IP_BLOCKED = 'security.ip.blocked',
  SECURITY_ENCRYPTION_FAILED = 'security.encryption.failed',
  SECURITY_KEY_ROTATED = 'security.key.rotated',
  
  // Administrative Events
  ADMIN_USER_CREATED = 'admin.user.created',
  ADMIN_USER_DELETED = 'admin.user.deleted',
  ADMIN_ORG_CREATED = 'admin.org.created',
  ADMIN_ORG_DELETED = 'admin.org.deleted',
  ADMIN_SETTINGS_CHANGED = 'admin.settings.changed',
  
  // GDPR Events
  GDPR_DATA_EXPORT_REQUESTED = 'gdpr.data.export.requested',
  GDPR_DATA_DELETION_REQUESTED = 'gdpr.data.deletion.requested',
  GDPR_CONSENT_GRANTED = 'gdpr.consent.granted',
  GDPR_CONSENT_REVOKED = 'gdpr.consent.revoked',
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Create an audit log entry
 * 
 * @param entry - Audit log entry data
 * @returns Created audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Store in database (create audit_logs table if needed)
    // For now, using structured logging
    log.info({
      auditEvent: entry.eventType,
      severity: entry.severity,
      userId: entry.userId,
      organizationId: entry.organizationId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      resource: entry.resource,
      resourceId: entry.resourceId,
      action: entry.action,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      metadata: entry.metadata,
      timestamp: entry.timestamp.toISOString(),
    }, 'Audit Event');

    // TODO: Store in dedicated audit_logs table for persistence
    // await prisma.audit_logs.create({ data: entry });
  } catch (error: any) {
    // Never fail the operation due to audit log failure
    log.error({
      error: error.message,
      entry,
    }, 'Failed to create audit log');
  }
}

/**
 * Log authentication event
 */
export async function logAuthEvent(data: {
  eventType: AuditEventType;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}) {
  await createAuditLog({
    eventType: data.eventType,
    severity: data.success ? AuditSeverity.INFO : AuditSeverity.WARNING,
    userId: data.userId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    metadata: {
      email: data.email,
      success: data.success,
      reason: data.reason,
    },
    timestamp: new Date(),
  });
}

/**
 * Log authorization event
 */
export async function logAuthorizationEvent(data: {
  userId: string;
  organizationId?: string;
  resource: string;
  action: string;
  granted: boolean;
  reason?: string;
  ipAddress?: string;
}) {
  await createAuditLog({
    eventType: data.granted ? AuditEventType.ACCESS_GRANTED : AuditEventType.ACCESS_DENIED,
    severity: data.granted ? AuditSeverity.INFO : AuditSeverity.WARNING,
    userId: data.userId,
    organizationId: data.organizationId,
    ipAddress: data.ipAddress,
    resource: data.resource,
    action: data.action,
    metadata: {
      granted: data.granted,
      reason: data.reason,
    },
    timestamp: new Date(),
  });
}

/**
 * Log data modification event
 */
export async function logDataEvent(data: {
  eventType: AuditEventType;
  userId: string;
  organizationId: string;
  resource: string;
  resourceId: string;
  action: 'create' | 'update' | 'delete';
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
}) {
  // Sanitize sensitive data before logging
  const sanitizedOld = sanitizeSensitiveData(data.oldValue);
  const sanitizedNew = sanitizeSensitiveData(data.newValue);

  await createAuditLog({
    eventType: data.eventType,
    severity: data.action === 'delete' ? AuditSeverity.WARNING : AuditSeverity.INFO,
    userId: data.userId,
    organizationId: data.organizationId,
    ipAddress: data.ipAddress,
    resource: data.resource,
    resourceId: data.resourceId,
    action: data.action,
    oldValue: sanitizedOld ? JSON.stringify(sanitizedOld) : undefined,
    newValue: sanitizedNew ? JSON.stringify(sanitizedNew) : undefined,
    timestamp: new Date(),
  });
}

/**
 * Log payment event
 */
export async function logPaymentEvent(data: {
  eventType: AuditEventType;
  organizationId: string;
  paymentLinkId: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  status?: string;
  metadata?: Record<string, any>;
}) {
  await createAuditLog({
    eventType: data.eventType,
    severity: AuditSeverity.INFO,
    organizationId: data.organizationId,
    resource: 'payment_link',
    resourceId: data.paymentLinkId,
    metadata: {
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      status: data.status,
      ...data.metadata,
    },
    timestamp: new Date(),
  });
}

/**
 * Log security event
 */
export async function logSecurityEvent(data: {
  eventType: AuditEventType;
  severity?: AuditSeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  reason?: string;
  metadata?: Record<string, any>;
}) {
  await createAuditLog({
    eventType: data.eventType,
    severity: data.severity || AuditSeverity.WARNING,
    userId: data.userId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    resource: data.resource,
    metadata: {
      reason: data.reason,
      ...data.metadata,
    },
    timestamp: new Date(),
  });
}

/**
 * Log GDPR event
 */
export async function logGDPREvent(data: {
  eventType: AuditEventType;
  userId: string;
  action: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  await createAuditLog({
    eventType: data.eventType,
    severity: AuditSeverity.INFO,
    userId: data.userId,
    ipAddress: data.ipAddress,
    action: data.action,
    metadata: data.metadata,
    timestamp: new Date(),
  });
}

/**
 * Sanitize sensitive data before logging
 * Removes passwords, tokens, and other sensitive fields
 */
function sanitizeSensitiveData(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'apiKey',
    'accessToken',
    'refreshToken',
    'creditCard',
    'cvv',
    'ssn',
  ];

  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeSensitiveData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Query audit logs
 * 
 * @param filters - Query filters
 * @returns Audit log entries
 */
export async function queryAuditLogs(filters: {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  userId?: string;
  organizationId?: string;
  severity?: AuditSeverity[];
  limit?: number;
  offset?: number;
}) {
  // TODO: Implement database query when audit_logs table exists
  // For now, return empty array
  log.info(filters, 'Audit log query requested');
  return [];
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogs(filters: {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  userId?: string;
  organizationId?: string;
}): Promise<string> {
  const logs = await queryAuditLogs(filters);
  
  // Convert to CSV format
  const headers = [
    'Timestamp',
    'Event Type',
    'Severity',
    'User ID',
    'Organization ID',
    'IP Address',
    'Resource',
    'Action',
    'Details',
  ];

  const rows = logs.map((entry: any) => [
    entry.timestamp,
    entry.eventType,
    entry.severity,
    entry.userId || '',
    entry.organizationId || '',
    entry.ipAddress || '',
    entry.resource || '',
    entry.action || '',
    JSON.stringify(entry.metadata || {}),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}

/**
 * Audit log retention policy
 * Delete logs older than retention period
 * 
 * @param retentionDays - Number of days to retain logs
 */
export async function enforceRetentionPolicy(retentionDays: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  log.info({ cutoffDate, retentionDays }, 'Enforcing audit log retention policy');

  // TODO: Implement database deletion when audit_logs table exists
  // await prisma.audit_logs.deleteMany({
  //   where: {
  //     timestamp: {
  //       lt: cutoffDate,
  //     },
  //   },
  // });
}







