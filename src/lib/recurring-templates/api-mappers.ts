import type { RecurringTemplateInterval, RecurringTemplateStatus } from '@prisma/client';
import type { z } from 'zod';
import { RecurringTemplateIntervalApiSchema } from '@/lib/validations/schemas';

type ApiInterval = z.infer<typeof RecurringTemplateIntervalApiSchema>;

export function apiIntervalToPrisma(v: ApiInterval): RecurringTemplateInterval {
  const m: Record<ApiInterval, RecurringTemplateInterval> = {
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    custom: 'CUSTOM',
  };
  return m[v];
}

export function prismaIntervalToApi(v: RecurringTemplateInterval): ApiInterval {
  const m: Record<RecurringTemplateInterval, ApiInterval> = {
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    CUSTOM: 'custom',
  };
  return m[v];
}

export function prismaStatusToApi(v: RecurringTemplateStatus): 'active' | 'paused' {
  return v === 'ACTIVE' ? 'active' : 'paused';
}

export function apiStatusToPrisma(v: 'active' | 'paused'): RecurringTemplateStatus {
  return v === 'active' ? 'ACTIVE' : 'PAUSED';
}
