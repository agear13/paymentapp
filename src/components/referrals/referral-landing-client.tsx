'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Star, CheckCircle2, ExternalLink, MessageCircle } from 'lucide-react';

interface Program {
  id: string;
  name: string;
  slug: string;
  description: string;
  hero_image_url: string | null;
  status: string;
  cta_config: any;
}

interface Participant {
  id: string;
  name: string;
  role: string;
}

interface Review {
  id: string;
  rating: number;
  testimonial: string;
  reviewer_name: string;
  photo_url: string | null;
  created_at: string;
}

interface Props {
  program: Program;
  participant: Participant;
  referralCode: string;
  reviews: Review[];
}

export function ReferralLandingClient({ program, participant, referralCode, reviews }: Props) {
  const [attributionId, setAttributionId] = useState<string | null>(null);
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Track attribution on page load
  useEffect(() => {
    const trackAttribution = async () => {
      try {
        const response = await fetch('/api/referrals/track-attribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referralCode,
            landingPath: window.location.pathname,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setAttributionId(data.attributionId);
        }
      } catch (err) {
        console.error('Failed to track attribution:', err);
      }
    };

    trackAttribution();
  }, [referralCode]);

  const handleSubmitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/referrals/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode,
          attributionId,
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit enquiry');
      }

      setSuccess(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      setError('Failed to submit enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const ctaConfig = Array.isArray(program.cta_config) ? program.cta_config : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {program.hero_image_url && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img 
              src={program.hero_image_url} 
              alt={program.name}
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4">
            Referred by {participant.name}
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {program.name}
          </h1>
          {program.description && (
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {program.description}
            </p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          {ctaConfig.map((cta: any, index: number) => {
            if (cta.type === 'enquiry') {
              return (
                <Button
                  key={index}
                  size="lg"
                  onClick={() => setShowEnquiry(true)}
                >
                  {cta.label || 'Get Started'}
                </Button>
              );
            }

            if (cta.type === 'whatsapp' && cta.url) {
              return (
                <Button
                  key={index}
                  size="lg"
                  variant="outline"
                  onClick={() => window.open(cta.url, '_blank')}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {cta.label || 'WhatsApp'}
                </Button>
              );
            }

            if (cta.url) {
              return (
                <Button
                  key={index}
                  size="lg"
                  variant="outline"
                  onClick={() => window.open(cta.url, '_blank')}
                >
                  {cta.label || 'Learn More'}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              );
            }

            return null;
          })}
        </div>

        {/* Enquiry Form */}
        {showEnquiry && !success && (
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Fill in your details and we'll get back to you shortly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitEnquiry} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Enquiry'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {success && (
          <Alert className="mb-12">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Thank you! Your enquiry has been submitted successfully. We'll be in touch soon.
            </AlertDescription>
          </Alert>
        )}

        {/* Reviews / Social Proof */}
        {reviews.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-center mb-6">
              What Our Clients Say
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center mb-3">
                      <div className="flex gap-1 mr-3">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-medium">{review.reviewer_name}</span>
                    </div>
                    <p className="text-gray-600 text-sm">{review.testimonial}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
