import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  queryAuditLogs,
  exportAuditLogs,
  AuditEventType,
  AuditSeverity,
} from '@/lib/audit/audit-log';
import { z } from 'zod';

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventTypes: z.array(z.nativeEnum(AuditEventType)).optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  severity: z.array(z.nativeEnum(AuditSeverity)).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  export: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/admin/audit-logs
 * Query audit logs (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Check if user has admin role
    // For now, allow any authenticated user

    const { searchParams } = new URL(req.url);
    const params = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      eventTypes: searchParams.get('eventTypes')?.split(',') || undefined,
      userId: searchParams.get('userId') || undefined,
      organizationId: searchParams.get('organizationId') || undefined,
      severity: searchParams.get('severity')?.split(',') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
      export: searchParams.get('export') || undefined,
    };

    const validation = querySchema.safeParse(params);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const filters = {
      startDate: validation.data.startDate ? new Date(validation.data.startDate) : undefined,
      endDate: validation.data.endDate ? new Date(validation.data.endDate) : undefined,
      eventTypes: validation.data.eventTypes,
      userId: validation.data.userId,
      organizationId: validation.data.organizationId,
      severity: validation.data.severity,
      limit: validation.data.limit || 100,
      offset: validation.data.offset || 0,
    };

    // Export to CSV
    if (validation.data.export === 'true') {
      const csv = await exportAuditLogs(filters);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${Date.now()}.csv"`,
        },
      });
    }

    // Return JSON
    const logs = await queryAuditLogs(filters);
    return NextResponse.json({ logs, total: logs.length });
  } catch (error: any) {
    console.error('Error querying audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}







