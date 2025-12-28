/**
 * Alert Monitoring API
 * Evaluate and retrieve alert status
 * 
 * Sprint 15: Alerting & Monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateAllAlerts, getAlertRules } from '@/lib/monitoring/alert-rules';
import { logger } from '@/lib/logger';

/**
 * GET /api/monitoring/alerts?organization_id=xxx
 * 
 * Evaluate all alert rules and return results
 * 
 * Query params:
 * - organization_id: optional, filter alerts for specific organization
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id') || undefined;

    // TODO: Verify user has permission to access this organization

    logger.info({ organizationId, userId: user.id }, 'Evaluating alerts via API');

    // Evaluate all alerts
    const evaluation = await evaluateAllAlerts(organizationId);

    // Get alert rule definitions
    const rules = getAlertRules();

    // Combine results with rule definitions
    const alertsWithRules = evaluation.alerts.map((alert) => {
      const rule = rules.find((r) => r.id === alert.rule);
      return {
        ...alert,
        ruleDefinition: rule ? {
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          enabled: rule.enabled,
        } : null,
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
 * POST /api/monitoring/alerts/evaluate
 * 
 * Manually trigger alert evaluation (for testing or manual checks)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret or admin auth
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow either cron secret or authenticated user
    let authorized = false;
    
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    } else {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      authorized = !authError && !!user;
    }

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId } = body;

    logger.info({ organizationId }, 'Manual alert evaluation triggered');

    const evaluation = await evaluateAllAlerts(organizationId);

    const triggeredAlerts = evaluation.alerts.filter((a) => a.result.triggered);

    // Log triggered alerts
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







