import type { CommercialTimelineAccountStatus } from '@/lib/workspace-timeline/commercial-timeline-types';

export type CommercialTimelineAccountState = 'no_organization' | 'empty' | 'ready';

export function interpretCommercialTimelineAccount(input: {
  status?: CommercialTimelineAccountStatus | string | null;
  organizationId?: string | null;
  hasCommercialActivity?: boolean;
}): CommercialTimelineAccountState {
  if (input.status === 'no_organization' || !input.organizationId) {
    return 'no_organization';
  }
  if (input.hasCommercialActivity) {
    return 'ready';
  }
  return 'empty';
}
