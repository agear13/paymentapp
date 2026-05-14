/**
 * Immutable commission attribution snapshot for payment_links.
 * Shape matches Stripe session metadata keys consumed by commission-posting.
 */

import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import {
  extractReferralMetadata,
  parseReferralSplitsFromMetadata,
} from '@/lib/referrals/commission-posting';

export type ReferralLinkForSnapshot = {
  id: string;
  organization_id: string;
  code: string;
  referral_link_splits: Array<{
    id: string;
    label: string;
    percentage: Prisma.Decimal | number | unknown;
    beneficiary_id: string | null;
    sort_order: number;
  }>;
  referral_rules: Array<{
    consultant_id: string | null;
    bd_partner_id: string | null;
    consultant_pct: Prisma.Decimal | number | unknown;
    bd_partner_pct: Prisma.Decimal | number | unknown;
    basis: string;
  }>;
};

export function isCompleteCommissionAttributionMetadata(
  md: Stripe.Metadata | null | undefined
): boolean {
  if (!md?.referral_link_id) return false;
  const splits = parseReferralSplitsFromMetadata(md);
  if (splits && splits.length > 0) return true;
  return extractReferralMetadata(md) != null;
}

/**
 * Build Stripe-shaped metadata frozen onto the invoice at creation time.
 * Omits payment_link_id / short_code — add those after the row exists if needed for parity with Stripe sessions.
 */
export function buildCommissionAttributionMetadataFromReferralLink(
  referralLink: ReferralLinkForSnapshot
): Record<string, string> {
  const splits = referralLink.referral_link_splits ?? [];
  const rule = referralLink.referral_rules?.[0];
  const hasSplits = splits.length > 0;
  const basis = hasSplits ? 'GROSS' : (rule?.basis ?? 'GROSS');
  const code = referralLink.code.trim().toUpperCase();

  const out: Record<string, string> = {
    referral_link_id: referralLink.id,
    organization_id: referralLink.organization_id,
    referral_code: code,
    commission_basis: basis,
  };

  if (hasSplits) {
    out.referral_splits = JSON.stringify(
      splits.map((s) => ({
        split_id: s.id,
        label: s.label,
        percentage: Number(s.percentage),
        beneficiary_id: s.beneficiary_id ?? null,
        sort_order: s.sort_order,
      }))
    );
  } else if (rule) {
    out.consultant_id = rule.consultant_id ?? '';
    out.bd_partner_id = rule.bd_partner_id ?? '';
    out.consultant_pct = String(rule.consultant_pct);
    out.bd_partner_pct = String(rule.bd_partner_pct);
    out.commission_basis = rule.basis;
  }

  return out;
}

export function commissionSnapshotToPrismaJson(
  meta: Record<string, string>
): Prisma.InputJsonValue {
  return meta as Prisma.InputJsonValue;
}
