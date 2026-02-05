'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Review {
  id: string;
  rating: number;
  testimonial: string;
  reviewer_name: string;
  photo_url: string | null;
  is_public: boolean;
  status: string;
  created_at: string;
  programs: { name: string };
  participants: { name: string; referral_code: string } | null;
}

export function ReviewsTable({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [viewMode, setViewMode] = useState(false);

  const handlePublish = async (reviewId: string) => {
    // TODO: Create API endpoint for publishing reviews
    console.log('Publishing review:', reviewId);
    alert('Publishing feature coming soon');
  };

  const handleHide = async (reviewId: string) => {
    // TODO: Create API endpoint for hiding reviews
    console.log('Hiding review:', reviewId);
    alert('Hide feature coming soon');
  };

  const openViewDialog = (review: Review) => {
    setSelectedReview(review);
    setViewMode(true);
  };

  const closeDialog = () => {
    setSelectedReview(null);
    setViewMode(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      published: 'default',
      hidden: 'outline',
      private: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Reviewer</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500">
                No reviews found
              </TableCell>
            </TableRow>
          )}
          {reviews.map((review) => (
            <TableRow key={review.id}>
              <TableCell>
                {new Date(review.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="font-medium">{review.reviewer_name}</TableCell>
              <TableCell>{review.programs.name}</TableCell>
              <TableCell>{renderStars(review.rating)}</TableCell>
              <TableCell>
                {review.participants ? (
                  <span className="text-sm text-gray-600">
                    {review.participants.name}
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>{getStatusBadge(review.status)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openViewDialog(review)}
                    title="View review"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {review.status === 'pending' && review.rating >= 4 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePublish(review.id)}
                      title="Publish review"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  {review.status === 'published' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleHide(review.id)}
                      title="Hide review"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={viewMode} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              Full review information
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Reviewer</p>
                <p className="text-sm text-gray-600">{selectedReview.reviewer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Rating</p>
                <div className="mt-1">{renderStars(selectedReview.rating)}</div>
              </div>
              <div>
                <p className="text-sm font-medium">Testimonial</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {selectedReview.testimonial}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Program</p>
                <p className="text-sm text-gray-600">{selectedReview.programs.name}</p>
              </div>
              {selectedReview.participants && (
                <div>
                  <p className="text-sm font-medium">Participant</p>
                  <p className="text-sm text-gray-600">
                    {selectedReview.participants.name} ({selectedReview.participants.referral_code})
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Status</p>
                <div className="mt-1">{getStatusBadge(selectedReview.status)}</div>
              </div>
              <div>
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedReview.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
            {selectedReview?.status === 'pending' && selectedReview.rating >= 4 && (
              <Button onClick={() => handlePublish(selectedReview.id)}>
                Publish Review
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
