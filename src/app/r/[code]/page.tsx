import { createUserClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ReferralLandingClient } from '@/components/referrals/referral-landing-client';
import { ReferralPayPageClient } from '@/components/referrals/referral-pay-page-client';
import { ReferralCommissionLanding } from '@/components/referrals/referral-commission-landing';
import { prisma } from '@/lib/server/prisma';
import {
  filterServicesForReferralConfig,
  isCustomAmountAllowedOnCheckoutConfig,
} from '@/lib/referrals/referral-commerce-config';
import { resolveMerchantBranding } from '@/lib/branding/resolve-merchant-branding';
import { getBrandedAppOrigin } from '@/lib/runtime/customer-facing-url';
import {
  resolveCustomerPaymentRails,
} from '@/lib/referrals/referral-payment-rails';

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const referralCode = code?.trim()?.toUpperCase() || '';

  if (!referralCode) {
    notFound();
  }

  const referralLink = await prisma.referral_links.findFirst({
    where: {
      code: referralCode,
      status: 'ACTIVE',
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    include: {
      referral_rules: { orderBy: { created_at: 'desc' }, take: 1 },
      referral_link_splits: { orderBy: { sort_order: 'asc' } },
      organizations: {
        include: {
          merchant_settings: {
            take: 1,
          },
        },
      },
    },
  });

  const hasRules = referralLink && referralLink.referral_rules.length > 0;
  const hasSplits = referralLink && referralLink.referral_link_splits.length > 0;
  const isCommissionReferral = referralLink && (hasRules || hasSplits);

  if (isCommissionReferral && referralLink) {
    const merchantSettings = referralLink.organizations.merchant_settings[0];
    const branding = resolveMerchantBranding({
      merchantName: merchantSettings?.display_name ?? 'Merchant',
      logoSource: merchantSettings?.organization_logo_url ?? null,
      runtimeOrigin: getBrandedAppOrigin(),
    });

    const paymentRails = resolveCustomerPaymentRails({
      checkoutConfig: referralLink.checkout_config,
      merchant: {
        stripe: !!merchantSettings?.stripe_account_id,
        wise: !!merchantSettings?.wise_enabled && !!merchantSettings?.wise_profile_id,
        hedera: !!merchantSettings?.hedera_account_id,
        manual: true,
      },
    });

    const allowCustomAmount = isCustomAmountAllowedOnCheckoutConfig(referralLink.checkout_config);

    const allServices = await prisma.organization_services.findMany({
      where: { organization_id: referralLink.organization_id, active: true },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
      },
    });

    const services = filterServicesForReferralConfig(allServices, referralLink.checkout_config);

    if (services.length > 0) {
      return (
        <ReferralCommissionLanding
          referralCode={referralCode}
          checkoutConfig={(referralLink.checkout_config ?? null) as Record<string, unknown> | null}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            price: Number(s.price),
            currency: s.currency,
          }))}
          merchantDisplayName={branding.merchantName}
          merchantLogoUrl={branding.logoUrl}
          paymentRails={paymentRails.length > 0 ? paymentRails : ['stripe']}
          allowCustomAmount={allowCustomAmount}
        />
      );
    }

    return (
      <ReferralPayPageClient
        referralCode={referralCode}
        checkoutConfig={referralLink.checkout_config as Record<string, unknown> | null}
        merchantDisplayName={branding.displayName}
        merchantLogoUrl={branding.logoUrl}
        paymentRails={paymentRails.length > 0 ? paymentRails : ['stripe']}
      />
    );
  }

  let supabase;
  try {
    supabase = await createUserClient();
  } catch (error) {
    console.error('Supabase configuration error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Configuration Error</h1>
          <p className="text-gray-600">
            Referral system is not properly configured. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  const { data: participant, error: participantError } = await supabase
    .from('referral_participants')
    .select(`
      *,
      referral_programs!referral_participants_program_id_fkey (
        id,
        name,
        slug,
        description,
        hero_image_url,
        status,
        cta_config
      )
    `)
    .eq('referral_code', referralCode)
    .single();

  if (participantError) {
    console.error('Participant lookup error:', participantError);
  }

  if (!participant || participant.status !== 'active') {
    notFound();
  }

  if (participant.referral_programs.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Program Unavailable</h1>
          <p className="mt-2 text-gray-600">This program is currently paused.</p>
        </div>
      </div>
    );
  }

  const { data: reviews } = await supabase
    .from('referral_reviews')
    .select('id, rating, testimonial, reviewer_name, photo_url, created_at')
    .eq('program_id', participant.program_id)
    .eq('status', 'published')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <ReferralLandingClient
      program={participant.referral_programs}
      participant={participant}
      referralCode={referralCode}
      reviews={reviews || []}
    />
  );
}
