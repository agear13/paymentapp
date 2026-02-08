import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReviewsTable } from '@/components/referrals/reviews-table';

export default async function ReviewsPage() {
  const supabase = await createClient();

  // Fetch all referral reviews with program data
  const { data: reviews, error } = await supabase
    .from('referral_reviews')
    .select(`
      *,
      referral_programs!referral_reviews_program_id_fkey (id, name),
      referral_participants!referral_reviews_participant_id_fkey (name, referral_code)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch reviews:', error);
  }

  const pendingCount = reviews?.filter(r => r.status === 'pending').length || 0;
  const publishedCount = reviews?.filter(r => r.status === 'published').length || 0;
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-gray-600">Moderate and publish client testimonials</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-3xl text-green-600">{publishedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Rating</CardDescription>
            <CardTitle className="text-3xl">{avgRating} ⭐</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
          <CardDescription>
            Publish high-quality reviews to appear on referral pages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewsTable reviews={reviews || []} />
        </CardContent>
      </Card>
    </div>
  );
}
