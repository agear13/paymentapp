import { createUserClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ReferralLandingClient } from '@/components/referrals/referral-landing-client';
import { ReferralPayPageClient } from '@/components/referrals/referral-pay-page-client';
import { prisma } from '@/lib/server/prisma';

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

  // Option B: Commission-enabled referral links (Prisma) - show Pay Now page
  const referralLink = await prisma.referral_links.findFirst({
    where: { code: referralCode, status: 'ACTIVE' },
    include: { referral_rules: { take: 1 } },
  });

  if (referralLink && referralLink.referral_rules.length > 0) {
    return (
      <ReferralPayPageClient
        referralCode={referralCode}
        checkoutConfig={referralLink.checkout_config}
      />
    );
  }

  // Legacy: Supabase referral participants (landing page with enquiry)
  let supabase;
  try {
    supabase = await createUserClient();
  } catch (error) {
    console.error('Supabase configuration error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Configuration Error
          </h1>
          <p className="text-gray-600">
            Referral system is not properly configured. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  // Find participant and program (using referral_ namespaced tables)
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

  // Fetch published reviews for this program (using referral_reviews)
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
