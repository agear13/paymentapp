import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { RequiredParticipant } from '@/lib/commercial-network/providers/canton/workflow-types';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';

const ROLE_PARTY_ENV_KEYS: Record<string, string> = {
  venue: 'CANTON_VENUE_PARTY',
  promoter: 'CANTON_PROMOTER_PARTY',
  artist: 'CANTON_ARTIST_PARTY',
  dj: 'CANTON_ARTIST_PARTY',
  sponsor: 'CANTON_SPONSOR_PARTY',
};

function normalizeRoleKey(role: string): string {
  return role.trim().toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
}

export function resolveCantonPlatformParty(env: NodeJS.ProcessEnv = process.env): string {
  return env.CANTON_PLATFORM_PARTY?.trim() || 'party::provvypay-platform';
}

/** Resolve ledger party for a participant — stable across requests. */
export function resolveCantonPartyForParticipant(
  participant: DemoParticipant,
  env: NodeJS.ProcessEnv = process.env
): string {
  const stored = participant.cantonParty;
  if (typeof stored === 'string' && stored.trim()) {
    return stored.trim();
  }

  const roleLabel = operationalRoleLabel(participant);
  const commercialRole =
    typeof participant.roleDetails === 'string' && participant.roleDetails.trim()
      ? participant.roleDetails.trim()
      : roleLabel;

  for (const [key, envKey] of Object.entries(ROLE_PARTY_ENV_KEYS)) {
    if (normalizeRoleKey(commercialRole).includes(key)) {
      const mapped = env[envKey]?.trim();
      if (mapped) return mapped;
    }
  }

  return `party::participant-${participant.id}`;
}

export function resolveCantonRoleLabel(
  participant: DemoParticipant,
  deal: RecentDeal
): string {
  const commercialRoles = deal.commercialRoles ?? [];
  const match = commercialRoles.find(
    (r) => r.title && participant.name && r.title.toLowerCase() === participant.name.toLowerCase()
  );
  if (match?.title) return match.title;

  const roleDetails = participant.roleDetails?.trim();
  if (roleDetails) return roleDetails;

  return operationalRoleLabel(participant);
}

export function buildRequiredParticipantsForDeal(
  deal: RecentDeal,
  participants: DemoParticipant[]
): RequiredParticipant[] {
  // Caller already scoped the deal. Only drop rows that explicitly belong elsewhere.
  // Do not require approvalStatus — People-flow invitees are Pending and must still
  // be written onto CommercialAgreementProposal.requiredParticipants.
  return participants
    .filter((p) => !p.dealId || p.dealId === deal.id)
    .map((participant) => ({
      party: resolveCantonPartyForParticipant(participant),
      role: resolveCantonRoleLabel(participant, deal),
    }));
}

export function cantonRequiredPartiesEqual(
  left: RequiredParticipant[],
  right: RequiredParticipant[]
): boolean {
  if (left.length !== right.length) return false;
  const parties = new Set(left.map((row) => row.party));
  return right.every((row) => parties.has(row.party));
}

export function cantonRequiredPartiesMissing(
  required: RequiredParticipant[],
  existing: RequiredParticipant[]
): RequiredParticipant[] {
  const have = new Set(existing.map((row) => row.party));
  return required.filter((row) => !have.has(row.party));
}
