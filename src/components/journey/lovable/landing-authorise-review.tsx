'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { INDICATIVE_ESTIMATE_COPY } from '@/lib/journey/landing-provider-pricing';
import type { LandingProviderResult } from '@/lib/journey/landing-provider-search';
import { recommendationBadge } from '@/lib/journey/landing-result-labels';
import {
  countryName,
  formatLandingAmount,
  transactionTypeLabel,
  type LandingSearchQuery,
} from '@/lib/journey/landing-route-model';

type LandingAuthoriseReviewProps = {
  item: LandingProviderResult | null;
  query: LandingSearchQuery;
  authorised: boolean;
  onClose: () => void;
  onAuthorise: () => void;
  onPersonalise: () => void;
};

export function LandingAuthoriseReview({
  item,
  query,
  authorised,
  onClose,
  onAuthorise,
  onPersonalise,
}: LandingAuthoriseReviewProps) {
  if (!item) return null;

  const offering = item.offering;
  const corridor = `${countryName(query.originCountry)} → ${countryName(query.destinationCountry)}`;
  const amount = formatLandingAmount(query.amount, query.currency);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {authorised ? (
          <>
            <DialogHeader>
              <DialogTitle>You authorised. Provvy can coordinate what follows.</DialogTitle>
              <DialogDescription>
                Provvy does not move money until you approve a real payment in your workspace.
              </DialogDescription>
            </DialogHeader>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              For this {transactionTypeLabel(query.transactionType).toLowerCase()} to{' '}
              {countryName(query.destinationCountry)}, Provvy would next prepare the {offering.providerName}{' '}
              route, keep the expected cost and arrival visible, and line up the work around the payment —
              records, approvals and whatever you have connected.
            </p>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              This page is a demonstration. To authorise a live payment, connect your business so Provvy
              can use your actual context.
            </p>
            <Link
              href={COMMERCIAL_OS_ROUTES.assessment}
              onClick={onPersonalise}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-[13px] font-medium text-background"
            >
              Connect your business
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Review before you authorise</DialogTitle>
              <DialogDescription>
                Provvy recommends. You authorise. Nothing is sent until you confirm.
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <ReviewField label="Route" value={`${offering.providerName} · ${offering.productName}`} />
              <ReviewField
                label="Why this route"
                value={item.isRecommended ? recommendationBadge(query.priority) : item.bestFor}
              />
              <ReviewField label="Amount" value={`${amount} ${query.currency}`} />
              <ReviewField label="Destination" value={corridor} />
              <ReviewField label="Expected cost" value={item.pricing.totalLabel} />
              <ReviewField label="Expected arrival" value={offering.arrivalLabel} />
              <ReviewField label="Recipient needs" value={item.recipientScan} />
              <ReviewField label="Setup" value={offering.setupLabel} />
            </dl>

            {item.pricing.feeLabel || item.pricing.fxLabel ? (
              <p className="text-[12px] text-ink-soft">
                {[item.pricing.feeLabel, item.pricing.fxLabel, offering.fxLabel].filter(Boolean).join(' · ')}
              </p>
            ) : null}

            <div>
              <h4 className="text-[12px] font-semibold">Why Provvy ranked it here</h4>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{item.whyRank}</p>
            </div>

            {offering.potentialIssues[0] ? (
              <div>
                <h4 className="text-[12px] font-semibold">Worth knowing</h4>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  {offering.potentialIssues[0]}
                </p>
              </div>
            ) : null}

            <div>
              <h4 className="text-[12px] font-semibold">After you authorise</h4>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Provvy prepares the {offering.providerName} route and coordinates the work around this
                payment. It does not silently take control of your money.
              </p>
            </div>

            <p className="text-[12px] text-ink-soft">{INDICATIVE_ESTIMATE_COPY}</p>

            <button
              type="button"
              onClick={onAuthorise}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-[13px] font-medium text-background"
            >
              Authorise payment
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-medium leading-snug">{value}</dd>
    </div>
  );
}
