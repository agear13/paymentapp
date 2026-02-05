import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { token, rating, testimonial, reviewerName, photoUrl, consent } = body;

    if (!token || !rating || !testimonial || !reviewerName || !consent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Verify token
    const { data: reviewToken, error: tokenError } = await supabase
      .from('review_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !reviewToken) {
      return NextResponse.json(
        { error: 'Invalid review token' },
        { status: 404 }
      );
    }

    // Check if token is expired or already used
    if (reviewToken.used_at) {
      return NextResponse.json(
        { error: 'This review link has already been used' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(reviewToken.expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'This review link has expired' },
        { status: 400 }
      );
    }

    // Determine review status based on rating
    // High ratings (4-5) are publishable, low ratings (1-3) are private feedback
    const status = rating >= 4 ? 'pending' : 'private';
    const isPublic = false; // Admin must approve first

    // Create review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        program_id: reviewToken.program_id,
        participant_id: reviewToken.participant_id,
        rating,
        testimonial,
        reviewer_name: reviewerName,
        photo_url: photoUrl || null,
        is_public: isPublic,
        status,
      })
      .select()
      .single();

    if (reviewError) {
      console.error('Review creation failed:', reviewError);
      return NextResponse.json(
        { error: 'Failed to submit review' },
        { status: 500 }
      );
    }

    // Mark token as used
    await supabase
      .from('review_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', reviewToken.id);

    // If rating >= 4, return the participant's referral code for sharing
    let shareData = null;
    if (rating >= 4 && reviewToken.participant_id) {
      const { data: participant } = await supabase
        .from('participants')
        .select('referral_code')
        .eq('id', reviewToken.participant_id)
        .single();

      if (participant) {
        shareData = {
          referralCode: participant.referral_code,
          message: 'Thank you for your review! You can now share your referral link and earn rewards.',
        };
      }
    }

    return NextResponse.json({ 
      success: true, 
      reviewId: review.id,
      canShare: rating >= 4,
      shareData,
      message: rating >= 4 
        ? 'Thank you for your review! It will be published after moderation.'
        : 'Thank you for your feedback. We appreciate your honest input.'
    });
  } catch (error) {
    console.error('Submit review error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
