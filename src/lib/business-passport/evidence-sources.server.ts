import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import type { OrganizationEvidenceSnapshot } from '@/lib/business-passport/types';

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isAirwallexConfigured(row: {
  encrypted_api_key: string;
  status: string;
  metadata: unknown;
} | null): boolean {
  if (!row || row.status !== 'active' || !row.encrypted_api_key.trim()) return false;
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return typeof metadata.clientId === 'string' && Boolean(metadata.clientId.trim());
}

/**
 * Read organisation-scoped facts only. Never seeds, backfills, or infers
 * registration, address, directors, or proof-of-address.
 */
export async function collectOrganizationEvidence(
  organizationId: string
): Promise<OrganizationEvidenceSnapshot | null> {
  const organization = await prisma.organizations.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!organization) return null;

  const [merchant, xero, onboarding, airwallex] = await Promise.all([
    prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: {
        display_name: true,
        default_currency: true,
        enabled_currencies: true,
        wise_profile_id: true,
        stripe_account_id: true,
      },
    }),
    prisma.xero_connections.findUnique({
      where: { organization_id: organizationId },
      select: { id: true },
    }),
    getOperatorOnboardingState(organizationId),
    prisma.treasury_integration_connections.findUnique({
      where: {
        ux_treasury_connections_org_provider: {
          organization_id: organizationId,
          provider: 'airwallex',
        },
      },
      select: {
        encrypted_api_key: true,
        status: true,
        metadata: true,
      },
    }),
  ]);

  return {
    organizationId: organization.id,
    organizationName: trimToNull(organization.name),
    displayName: trimToNull(merchant?.display_name),
    industry: trimToNull(onboarding?.workspace_industry),
    defaultCurrency: trimToNull(merchant?.default_currency),
    enabledCurrencies: merchant?.enabled_currencies ?? [],
    airwallexConfigured: isAirwallexConfigured(airwallex),
    wiseProfileId: trimToNull(merchant?.wise_profile_id),
    stripeAccountId: trimToNull(merchant?.stripe_account_id),
    xeroConnected: Boolean(xero),
  };
}
