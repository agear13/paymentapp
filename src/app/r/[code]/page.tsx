import { createUserClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ReferralLandingClient } from '@/components/referrals/referral-landing-client';
import { ReferralPayPageClient } from '@/components/referrals/referral-pay-page-client';
import { ReferralCommissionLanding } from '@/components/referrals/referral-commission-landing';
import { ReferralCheckoutUnavailable } from '@/components/referrals/referral-checkout-unavailable';
import { ReferralCheckoutNoPaymentMethods } from '@/components/referrals/referral-checkout-no-payment-methods';
import { loadReferralCommissionCheckoutPage } from '@/lib/referrals/referral-checkout-page.server';

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

  const checkout = await loadReferralCommissionCheckoutPage(referralCode);

  if (checkout.ok) {
    if (checkout.paymentRails.length === 0) {
      return (
        <ReferralCheckoutNoPaymentMethods
          merchantDisplayName={checkout.merchantDisplayName}
          merchantLogoUrl={checkout.merchantLogoUrl}
        />
      );
    }

    if (checkout.services.length > 0) {
      return (
        <ReferralCommissionLanding
          referralCode={checkout.referralCode}
          checkoutConfig={checkout.checkoutConfig}
          services={checkout.services}
          merchantDisplayName={checkout.merchantDisplayName}
          merchantLogoUrl={checkout.merchantLogoUrl}
          paymentRails={checkout.paymentRails}
          allowCustomAmount={checkout.allowCustomAmount}
        />
      );
    }

    if (checkout.allowCustomAmount) {
      return (
        <ReferralPayPageClient
          referralCode={checkout.referralCode}
          checkoutConfig={checkout.checkoutConfig}
          merchantDisplayName={checkout.merchantDisplayName}
          merchantLogoUrl={checkout.merchantLogoUrl}
          paymentRails={checkout.paymentRails}
        />
      );
    }

    return (
      <ReferralCheckoutUnavailable
        merchantDisplayName={checkout.merchantDisplayName}
        merchantLogoUrl={checkout.merchantLogoUrl}
        title="No services available"
        message="There are no services available on this checkout link right now."
      />
    );
  }

  if (checkout.reason === 'not_found') {
    return loadLegacyProgramReferral(referralCode);
  }

  return (
    <ReferralCheckoutUnavailable
      merchantDisplayName={checkout.merchantDisplayName}
      merchantLogoUrl={checkout.merchantLogoUrl}
      title={
        checkout.reason === 'inactive'
          ? 'Link unavailable'
          : checkout.reason === 'misconfigured'
            ? 'Checkout not ready'
            : 'Checkout unavailable'
      }
      message={checkout.message}
    />
  );
}

async function loadLegacyProgramReferral(referralCode: string) {
  let supabase;
  try {
    supabase = await createUserClient();
  } catch (error) {
    console.error('[ReferralCheckout] Supabase configuration error:', error);
    return (
      <ReferralCheckoutUnavailable
        merchantDisplayName="Merchant checkout"
        title="Configuration error"
        message="This referral program is not available right now. Please contact support."
        showRetry={false}
      />
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
    console.error('[ReferralCheckout] Participant lookup error:', participantError);
  }

  if (!participant || participant.status !== 'active') {
    notFound();
  }

  if (participant.referral_programs.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold">Program unavailable</h1>
          <p className="mt-2 text-muted-foreground">This program is currently paused.</p>
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
