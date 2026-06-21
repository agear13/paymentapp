'use client';

import * as React from 'react';
import Link from 'next/link';
import { Paperclip, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CAMPAIGN_MEMBERSHIP_PLANS,
  CAMPAIGN_TYPE_OPTIONS,
} from '@/lib/marketing-labs/placeholder-data';

export function CampaignsSection() {
  const [campaignType, setCampaignType] = React.useState('');
  const [businessGoal, setBusinessGoal] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [relatedProducts, setRelatedProducts] = React.useState('');
  const [preferredDeadline, setPreferredDeadline] = React.useState('');
  const [additionalNotes, setAdditionalNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      toast.success('Campaign request submitted. Our AI Marketing Team will review it shortly.');
      setCampaignType('');
      setBusinessGoal('');
      setTargetAudience('');
      setRelatedProducts('');
      setPreferredDeadline('');
      setAdditionalNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="campaigns" className="scroll-mt-6 space-y-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaign Requests</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Request a complete AI-generated marketing campaign powered by your Company Brain.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New campaign request</CardTitle>
            <CardDescription>
              Share your goals and we&apos;ll produce a full campaign package.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="campaign-type">Campaign Type</Label>
                  <Select value={campaignType} onValueChange={setCampaignType}>
                    <SelectTrigger id="campaign-type" className="w-full">
                      <SelectValue placeholder="Select campaign type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-goal">Business Goal</Label>
                  <Input
                    id="business-goal"
                    value={businessGoal}
                    onChange={(event) => setBusinessGoal(event.target.value)}
                    placeholder="e.g. Increase sign-ups for summer events"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Input
                    id="target-audience"
                    value={targetAudience}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    placeholder="e.g. Event promoters aged 25–45"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="related-products">Related Products</Label>
                  <Input
                    id="related-products"
                    value={relatedProducts}
                    onChange={(event) => setRelatedProducts(event.target.value)}
                    placeholder="e.g. VIP packages, early-bird tickets"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferred-deadline">Preferred Deadline</Label>
                  <Input
                    id="preferred-deadline"
                    type="date"
                    value={preferredDeadline}
                    onChange={(event) => setPreferredDeadline(event.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="additional-notes">Additional Notes</Label>
                  <Textarea
                    id="additional-notes"
                    value={additionalNotes}
                    onChange={(event) => setAdditionalNotes(event.target.value)}
                    placeholder="Share context, references, or constraints for the campaign."
                    rows={4}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Attachment Upload</Label>
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Upload briefs, brand assets, or reference materials.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Campaign Request'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaign Membership</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Choose how many AI-generated marketing campaigns you&apos;d like each month.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {CAMPAIGN_MEMBERSHIP_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'relative gap-4 py-6',
                plan.featured && 'border-primary shadow-md ring-1 ring-primary/20'
              )}
            >
              {plan.featured ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    <Sparkles className="size-3" />
                    Featured
                  </span>
                </div>
              ) : null}
              <CardHeader className="gap-2 px-6 pb-0 text-center">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription className="text-base font-medium text-foreground">
                  {plan.creditsLabel}
                </CardDescription>
                {plan.description ? (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                ) : null}
                <p className="pt-2 text-sm font-medium text-muted-foreground">Coming Soon</p>
              </CardHeader>
              <CardContent className="px-6">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="px-6">
                <Button asChild className="w-full" variant={plan.featured ? 'default' : 'outline'}>
                  <Link href={plan.stripeCheckoutUrl} target="_blank" rel="noopener noreferrer">
                    {plan.ctaLabel}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
