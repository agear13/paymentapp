import 'server-only';

import { AuditEventType, AuditSeverity, createAuditLog } from '@/lib/audit/audit-log';
import type { WiseIntelligenceConsentState } from '@/lib/connected-intelligence/types';
import { prisma } from '@/lib/server/prisma';

export type { WiseIntelligenceConsentState };

export type MerchantWiseSettingsRow = {
  organization_id: string;
  wise_enabled: boolean;
  wise_profile_id: string | null;
  wise_intelligence_consent: boolean;
  wise_intelligence_consented_at: Date | null;
  wise_intelligence_revoked_at: Date | null;
};

export function toConsentState(row: MerchantWiseSettingsRow | null): WiseIntelligenceConsentState {
  if (!row) {
    return {
      organizationId: '',
      connected: false,
      profilePresent: false,
      consented: false,
      consentedAt: null,
      revokedAt: null,
    };
  }
  const profilePresent = Boolean(row.wise_profile_id?.trim());
  return {
    organizationId: row.organization_id,
    connected: row.wise_enabled === true && profilePresent,
    profilePresent,
    consented: row.wise_intelligence_consent === true,
    consentedAt: row.wise_intelligence_consented_at?.toISOString() ?? null,
    revokedAt: row.wise_intelligence_revoked_at?.toISOString() ?? null,
  };
}

export function canFetchConnectedWiseEconomics(state: WiseIntelligenceConsentState): boolean {
  return state.connected && state.consented;
}

export async function readWiseIntelligenceConsent(
  organizationId: string
): Promise<WiseIntelligenceConsentState> {
  const row = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      organization_id: true,
      wise_enabled: true,
      wise_profile_id: true,
      wise_intelligence_consent: true,
      wise_intelligence_consented_at: true,
      wise_intelligence_revoked_at: true,
    },
  });
  const state = toConsentState(row);
  return { ...state, organizationId };
}

export async function setWiseIntelligenceConsent(input: {
  organizationId: string;
  userId: string;
  consented: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<WiseIntelligenceConsentState> {
  const existing = await prisma.merchant_settings.findFirst({
    where: { organization_id: input.organizationId },
    select: { id: true, wise_intelligence_consent: true },
  });
  if (!existing) {
    throw new Error('Merchant settings not found');
  }

  const now = new Date();
  await prisma.merchant_settings.update({
    where: { id: existing.id },
    data: input.consented
      ? {
          wise_intelligence_consent: true,
          wise_intelligence_consented_at: now,
          wise_intelligence_revoked_at: null,
        }
      : {
          wise_intelligence_consent: false,
          wise_intelligence_revoked_at: now,
        },
  });

  await createAuditLog({
    eventType: input.consented
      ? AuditEventType.WISE_INTELLIGENCE_CONSENT_GRANTED
      : AuditEventType.WISE_INTELLIGENCE_CONSENT_REVOKED,
    severity: AuditSeverity.INFO,
    userId: input.userId,
    organizationId: input.organizationId,
    resource: 'merchant_settings',
    resourceId: existing.id,
    action: input.consented ? 'grant_wise_intelligence_consent' : 'revoke_wise_intelligence_consent',
    oldValue: JSON.stringify({ consented: existing.wise_intelligence_consent }),
    newValue: JSON.stringify({ consented: input.consented }),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    timestamp: now,
  });

  return readWiseIntelligenceConsent(input.organizationId);
}
