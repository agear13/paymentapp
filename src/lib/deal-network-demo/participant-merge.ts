/**
 * Pilot helpers to avoid duplicate payout-party rows (e.g. same person as deal
 * Introducer/Closer and again as an invited participant for the same role).
 */

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export function normParticipantName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function internalId(dealId: string, role: 'Introducer' | 'Closer') {
  return `internal-${role.toLowerCase()}-${dealId}`;
}

/**
 * Merge a new invite into existing participants: prefer updating internal Introducer/Closer
 * rows when the invite targets the same person already attributed on the deal.
 */
export function mergePilotInvite(
  prev: DemoParticipant[],
  incoming: DemoParticipant,
  deal: RecentDeal
): DemoParticipant[] {
  const withMeta: DemoParticipant = {
    ...incoming,
    dealId: deal.id,
    dealName: deal.dealName,
    partner: deal.partner,
  };

  const n = normParticipantName(withMeta.name);

  if (withMeta.role === 'Introducer' && normParticipantName(deal.introducer) === n) {
    const id = internalId(deal.id, 'Introducer');
    const idx = prev.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        ...withMeta,
        id,
        inviteToken: next[idx].inviteToken,
        role: 'Introducer',
        inviteLink:
          typeof window !== 'undefined'
            ? `${window.location.origin}/deal-invites/${next[idx].inviteToken}`
            : next[idx].inviteLink,
      };
      return next;
    }
  }

  if (withMeta.role === 'Closer' && normParticipantName(deal.closer) === n) {
    const id = internalId(deal.id, 'Closer');
    const idx = prev.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        ...withMeta,
        id,
        inviteToken: next[idx].inviteToken,
        role: 'Closer',
        inviteLink:
          typeof window !== 'undefined'
            ? `${window.location.origin}/deal-invites/${next[idx].inviteToken}`
            : next[idx].inviteLink,
      };
      return next;
    }
  }

  const dupIdx = prev.findIndex(
    (p) =>
      p.dealId === deal.id &&
      p.role === withMeta.role &&
      normParticipantName(p.name) === n &&
      !p.id.startsWith('internal-')
  );
  if (dupIdx >= 0) {
    const next = [...prev];
    next[dupIdx] = { ...next[dupIdx], ...withMeta, id: next[dupIdx].id, inviteToken: next[dupIdx].inviteToken };
    return next;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const withLink: DemoParticipant = {
    ...withMeta,
    inviteLink:
      withMeta.inviteLink ?? (origin ? `${origin}/deal-invites/${withMeta.inviteToken}` : undefined),
  };
  return [...prev, withLink];
}

/**
 * Remove invited rows that duplicate internal Introducer/Closer attribution (same name + role).
 */
export function stripDuplicateRoleInvites(
  participants: DemoParticipant[],
  deals: RecentDeal[]
): DemoParticipant[] {
  const dealById = new Map(deals.map((d) => [d.id, d]));
  return participants.filter((p) => {
    // If an operator intentionally created a duplicate, keep it visible.
    if (p.userRequestedDuplicate) return true;
    if (!p.dealId || p.id.startsWith('internal-')) return true;
    const deal = dealById.get(p.dealId);
    if (!deal) return true;
    const n = normParticipantName(p.name);
    if (p.role === 'Introducer' && normParticipantName(deal.introducer) === n) return false;
    if (p.role === 'Closer' && normParticipantName(deal.closer) === n) return false;
    return true;
  });
}

/** One row per deal + role + normalized name (prefers non-internal, then row with email). */
export function dedupeParticipantsForDisplay(rows: DemoParticipant[]): DemoParticipant[] {
  const seen = new Map<string, DemoParticipant>();
  for (const p of rows) {
    // When an operator intentionally created duplicates, keep them distinct in display/export.
    const duplicateSuffix = p.userRequestedDuplicate ? `|${p.inviteToken}` : '';
    const key = `${p.dealId ?? ''}|${p.role}|${normParticipantName(p.name)}${duplicateSuffix}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
      continue;
    }
    const preferNonInternal =
      existing.id.startsWith('internal-') && !p.id.startsWith('internal-')
        ? p
        : !existing.id.startsWith('internal-') && p.id.startsWith('internal-')
          ? existing
          : null;
    if (preferNonInternal) {
      seen.set(key, preferNonInternal);
      continue;
    }
    const preferEmail =
      p.email?.trim() && !existing.email?.trim()
        ? p
        : existing.email?.trim() && !p.email?.trim()
          ? existing
          : existing;
    seen.set(key, preferEmail);
  }
  return Array.from(seen.values());
}
