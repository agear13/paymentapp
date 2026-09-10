import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { resolveMerchantBranding } from '@/lib/branding/resolve-merchant-branding';
import type { OrganizationAgreementBranding } from '@/lib/agreements/agreement-presentation';

export async function loadOrganizationAgreementBranding(
  organizationId: string | null | undefined,
  origin?: string | null
): Promise<OrganizationAgreementBranding | null> {
  if (!organizationId) return null;

  const organization = await prisma.organizations.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      merchant_settings: {
        take: 1,
        orderBy: { created_at: 'desc' },
        select: {
          display_name: true,
          organization_logo_url: true,
        },
      },
    },
  });
  if (!organization) return null;

  const settings = organization.merchant_settings[0];
  const organizationName = organization.name.trim() || 'Organisation';
  const legalName = settings?.display_name?.trim() || organizationName;
  const resolved = resolveMerchantBranding({
    merchantName: legalName,
    logoSource: settings?.organization_logo_url,
    requestOrigin: origin ?? undefined,
    context: 'organization-agreement-branding',
  });

  return {
    organizationName,
    legalName,
    logoUrl: resolved.logoUrl,
    logoSource: settings?.organization_logo_url ?? null,
  };
}
