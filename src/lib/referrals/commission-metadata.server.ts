import 'server-only';

import type Stripe from 'stripe';
import { prisma } from '@/lib/server/prisma';
import {
  coerceJsonToCommissionMetadata,
  parseReferralSplitsFromMetadata,
} from '@/lib/referrals/commission-posting';
import { isCompleteCommissionAttributionMetadata } from '@/lib/referrals/commission-attribution-snapshot';

function setCommissionMetaIfEmpty(
  out: Record<string, string>,
  key: string,
  value: string | null | undefined
) {
  const cur = out[key];
  if (cur != null && String(cur).trim() !== '') return;
  if (value == null || String(value).trim() === '') return;
  out[key] = String(value);
}

/**
 * Merge payment event metadata with immutable `payment_links.commission_attribution_snapshot`,
 * then load splits/rules from DB only if commission parsers still lack a full shape.
 */
export async function resolveReferralCommissionMetadata(params: {
  paymentEventMetadata: unknown;
  paymentLinkReferralLinkId: string | null;
  paymentLinkCommissionSnapshot: unknown;
}): Promise<Stripe.Metadata | undefined> {
  const base = coerceJsonToCommissionMetadata(params.paymentEventMetadata);
  const snapMd = coerceJsonToCommissionMetadata(params.paymentLinkCommissionSnapshot);

  let out: Record<string, string> = { ...(base ?? {}) };
  if (snapMd && isCompleteCommissionAttributionMetadata(snapMd)) {
    out = {
      ...out,
      ...Object.fromEntries(
        Object.entries(snapMd).filter(([, v]) => v != null && String(v).trim() !== '')
      ),
    };
  }

  const fromEvent = String(out.referral_link_id ?? '').trim();
  if (!fromEvent && params.paymentLinkReferralLinkId) {
    out.referral_link_id = params.paymentLinkReferralLinkId;
  }

  const rid = String(out.referral_link_id ?? '').trim();
  if (!rid) {
    return Object.keys(out).length > 0 ? (out as Stripe.Metadata) : undefined;
  }

  let md = out as Stripe.Metadata;
  if (isCompleteCommissionAttributionMetadata(md)) {
    return md;
  }

  const refLink = await prisma.referral_links.findUnique({
    where: { id: rid },
    include: {
      referral_link_splits: { orderBy: { sort_order: 'asc' } },
      referral_rules: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  });
  if (!refLink) {
    return Object.keys(out).length > 0 ? (out as Stripe.Metadata) : undefined;
  }

  setCommissionMetaIfEmpty(out, 'referral_code', refLink.code);

  const splits = refLink.referral_link_splits;
  const rule = refLink.referral_rules[0];
  if (splits.length > 0) {
    if (!parseReferralSplitsFromMetadata(out as Stripe.Metadata)) {
      out.referral_splits = JSON.stringify(
        splits.map((s) => ({
          split_id: s.id,
          label: s.label,
          percentage: Number(s.percentage),
          beneficiary_id: s.beneficiary_id ?? null,
          sort_order: s.sort_order,
        }))
      );
    }
    setCommissionMetaIfEmpty(out, 'commission_basis', 'GROSS');
  } else if (rule) {
    setCommissionMetaIfEmpty(out, 'consultant_id', rule.consultant_id ?? '');
    setCommissionMetaIfEmpty(out, 'bd_partner_id', rule.bd_partner_id ?? '');
    setCommissionMetaIfEmpty(out, 'consultant_pct', rule.consultant_pct.toString());
    setCommissionMetaIfEmpty(out, 'bd_partner_pct', rule.bd_partner_pct.toString());
    setCommissionMetaIfEmpty(out, 'commission_basis', rule.basis);
  }

  md = out as Stripe.Metadata;
  return Object.keys(out).length > 0 ? md : undefined;
}
