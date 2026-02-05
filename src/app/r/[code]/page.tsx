import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ReferralLandingClient } from '@/components/referrals/referral-landing-client';

export default async function ReferralLandingPage({
  params,
}: {
  params: { code: string };
}) {
  const supabase = await createClient();
  const referralCode = params.code.toUpperCase();

  // Find participant and program
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select(`
      *,
      programs (
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

  if (participantError || !participant || participant.status !== 'active') {
    notFound();
  }

  if (participant.programs.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Program Unavailable</h1>
          <p className="mt-2 text-gray-600">This program is currently paused.</p>
        </div>
      </div>
    );
  }

  // Fetch published reviews for this program
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, testimonial, reviewer_name, photo_url, created_at')
    .eq('program_id', participant.program_id)
    .eq('status', 'published')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <ReferralLandingClient
      program={participant.programs}
      participant={participant}
      referralCode={referralCode}
      reviews={reviews || []}
    />
  );
}
