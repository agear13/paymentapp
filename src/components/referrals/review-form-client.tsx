'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Star, CheckCircle2, Share2 } from 'lucide-react';

interface Program {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  token: string;
  program: Program;
}

export function ReviewFormClient({ token, program }: Props) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [formData, setFormData] = useState({
    testimonial: '',
    reviewerName: '',
    consent: false,
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (!formData.testimonial || !formData.reviewerName) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.consent) {
      setError('Please consent to having your review published');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/referrals/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          testimonial: formData.testimonial,
          reviewerName: formData.reviewerName,
          photoUrl: null, // Could add photo upload later
          consent: formData.consent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      const data = await response.json();
      setSubmitted(true);
      setShareData(data.shareData);
    } catch (err: any) {
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferralLink = () => {
    if (shareData?.referralCode) {
      const url = `${window.location.origin}/r/${shareData.referralCode}`;
      navigator.clipboard.writeText(url);
      alert('Referral link copied to clipboard!');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">Thank You!</CardTitle>
            <CardDescription className="text-center">
              Your review has been submitted successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {shareData && (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>{shareData.message}</AlertDescription>
                </Alert>
                <Button
                  onClick={handleCopyReferralLink}
                  className="w-full"
                  variant="outline"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Copy Your Referral Link
                </Button>
                <p className="text-sm text-gray-500 text-center">
                  Share your link and earn rewards when people sign up through it!
                </p>
              </div>
            )}
            {!shareData && rating < 4 && (
              <p className="text-sm text-gray-600 text-center">
                We appreciate your honest feedback and will use it to improve our services.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Share Your Experience</CardTitle>
          <CardDescription>
            Tell us about your experience with {program.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div>
              <Label className="mb-3 block">How would you rate your experience? *</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoveredRating(value)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-10 w-10 ${
                        value <= (hoveredRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {rating === 5 && 'Excellent! We're thrilled you had such a great experience.'}
                  {rating === 4 && 'Great! We're glad you enjoyed it.'}
                  {rating === 3 && 'Good. Thank you for your feedback.'}
                  {rating === 2 && 'We're sorry to hear that. We'll work on improving.'}
                  {rating === 1 && 'We apologize for your experience. Your feedback helps us improve.'}
                </p>
              )}
            </div>

            {/* Testimonial */}
            <div>
              <Label htmlFor="testimonial">Your Review *</Label>
              <Textarea
                id="testimonial"
                value={formData.testimonial}
                onChange={(e) => setFormData({ ...formData, testimonial: e.target.value })}
                placeholder="Tell us about your experience..."
                rows={6}
                required
                className="mt-2"
              />
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="reviewerName">Your Name *</Label>
              <Input
                id="reviewerName"
                value={formData.reviewerName}
                onChange={(e) => setFormData({ ...formData, reviewerName: e.target.value })}
                placeholder="John Doe"
                required
                className="mt-2"
              />
              <p className="mt-1 text-sm text-gray-500">
                This will be displayed with your review
              </p>
            </div>

            {/* Consent */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="consent"
                checked={formData.consent}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, consent: checked as boolean })
                }
              />
              <label
                htmlFor="consent"
                className="text-sm text-gray-700 leading-tight cursor-pointer"
              >
                I consent to having my review published on the referral page and promotional materials.
                {rating >= 4 && ' High ratings may unlock referral rewards!'}
              </label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Review'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
