import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ReviewFormClient } from '@/components/referrals/review-form-client';

export default async function ReviewPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createClient();
  const token = params.token;

  // Verify token exists and is valid
  const { data: reviewToken, error: tokenError } = await supabase
    .from('review_tokens')
    .select(`
      *,
      programs (
        id,
        name,
        description
      )
    `)
    .eq('token', token)
    .single();

  if (tokenError || !reviewToken) {
    notFound();
  }

  // Check if already used
  if (reviewToken.used_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Review Already Submitted
          </h1>
          <p className="text-gray-600">
            This review link has already been used. Thank you for your feedback!
          </p>
        </div>
      </div>
    );
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(reviewToken.expires_at);
  if (now > expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Review Link Expired
          </h1>
          <p className="text-gray-600">
            This review link has expired. Please contact us if you'd still like to leave a review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReviewFormClient
      token={token}
      program={reviewToken.programs}
    />
  );
}
