/**
 * Alert Monitoring API
 * Evaluate and retrieve alert status
 *
 * Sprint 15: Alerting & Monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { evaluateAllAlerts, getAlertRules } from '@/lib/monitoring/alert-rules';
import { logger } from '@/lib/logger';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import {
  cronAuthFailureResponse,
  verifyCronRequest,
} from '@/lib/jobs/cron-request-auth';

/**
 * GET /api/monitoring/alerts
 *
 * Merchant callers are always scoped to the session organization.
 * A client-supplied organization_id is accepted only when it matches that org.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) {
      return auth.response ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = await resolveSessionOrganizationId(
      auth.user.id,
      searchParams.get('organization_id'),
      'monitoring/alerts'
    );
    if (resolved.response || !resolved.organizationId) {
      return (
        resolved.response ??
        NextResponse.json({ error: 'Organization required' }, { status: 403 })
      );
    }
    const organizationId = resolved.organizationId;

    logger.info({ organizationId, userId: auth.user.id }, 'Evaluating alerts via API');

    const evaluation = await evaluateAllAlerts(organizationId);
    const rules = getAlertRules();

    const alertsWithRules = evaluation.alerts.map((alert) => {
      const rule = rules.find((r) => r.id === alert.rule);
      return {
        ...alert,
        ruleDefinition: rule
          ? {
              name: rule.name,
              description: rule.description,
              severity: rule.severity,
              enabled: rule.enabled,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        organizationId,
        summary: {
          total: evaluation.alerts.length,
          triggered: evaluation.alerts.filter((a) => a.result.triggered).length,
          critical: evaluation.criticalCount,
          warning: evaluation.warningCount,
        },
        alerts: alertsWithRules,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error evaluating alerts');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/alerts
 *
 * Cron or platform admin only. May evaluate globally when organizationId is omitted.
 */
export async function POST(request: NextRequest) {
  try {
    const cronAuthFailure = verifyCronRequest(request);
    if (cronAuthFailure) {
      const adminAuth = await checkAdminAuth();
      if (!adminAuth.isAdmin) {
        return cronAuthFailureResponse(cronAuthFailure);
      }
    }

    const body = await request.json().catch(() => ({}));
    const { organizationId } = body as { organizationId?: string };

    logger.info({ organizationId }, 'Manual alert evaluation triggered');

    const evaluation = await evaluateAllAlerts(
      typeof organizationId === 'string' ? organizationId : undefined
    );

    const triggeredAlerts = evaluation.alerts.filter((a) => a.result.triggered);

    if (triggeredAlerts.length > 0) {
      logger.warn(
        {
          count: triggeredAlerts.length,
          critical: evaluation.criticalCount,
          warning: evaluation.warningCount,
        },
        'Alerts triggered'
      );

      triggeredAlerts.forEach((alert) => {
        logger.warn(
          {
            rule: alert.rule,
            message: alert.result.message,
            details: alert.result.details,
          },
          `Alert: ${alert.rule}`
        );
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        evaluated: evaluation.alerts.length,
        triggered: triggeredAlerts.length,
        critical: evaluation.criticalCount,
        warning: evaluation.warningCount,
        alerts: triggeredAlerts,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error in manual alert evaluation');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
