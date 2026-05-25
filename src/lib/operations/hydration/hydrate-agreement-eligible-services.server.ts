import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  hydrateEligibleCatalogServices,
  type HydratedCatalogService,
} from '@/lib/operations/hydration/hydrate-eligible-catalog-services';
import { prisma } from '@/lib/server/prisma';
import { resolveOrganizationIdForPilotDeal } from '@/lib/referrals/ensure-referral-issuance';

export type HydratedEligibleService = HydratedCatalogService;

/** Resolve and hydrate eligible catalog services for agreement DTO boundaries. */
export async function hydrateAgreementEligibleServices(input: {
  participant: DemoParticipant;
  dealUserId: string;
  dealId: string;
  fallbackCurrency?: string;
}): Promise<HydratedEligibleService[]> {
  const profileIds = input.participant.compensationProfile?.commissionServiceIds ?? [];
  const commerceIds = input.participant.referralCommerce?.enabledServiceIds ?? [];
  const serviceIds = profileIds.length > 0 ? profileIds : commerceIds;
  if (serviceIds.length === 0) return [];

  const organizationId = await resolveOrganizationIdForPilotDeal(input.dealUserId, input.dealId);
  if (!organizationId) {
    return hydrateEligibleCatalogServices(serviceIds, [], input.fallbackCurrency);
  }

  const catalogRows = await prisma.organization_services.findMany({
    where: { organization_id: organizationId, id: { in: serviceIds } },
    select: { id: true, name: true, description: true, currency: true, price: true },
  });

  return hydrateEligibleCatalogServices(
    serviceIds,
    catalogRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      currency: row.currency,
      price: Number(row.price),
    })),
    input.fallbackCurrency
  );
}
