'use client';

import * as React from 'react';
import Link from 'next/link';
import { Paperclip, Sparkles } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import { MARKETING_DEMO_BRAND } from '@/lib/marketing-jobs/demo-brand';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';
import {
  CAMPAIGN_MEMBERSHIP_PLANS,
  CAMPAIGN_TYPE_OPTIONS,
  THIRSTY_TURTL_CAMPAIGN_HISTORY,
} from '@/lib/marketing-labs/placeholder-data';
import { MarketingActionButton } from '@/components/marketing-labs/marketing-action-button';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';
import { MARKETING_EMPTY_STATES } from '@/lib/marketing-labs/empty-states';

type CampaignsSectionProps = {
  engine: MarketingJobEngine;
};

export function CampaignsSection({ engine }: CampaignsSectionProps) {
  const [campaignType, setCampaignType] = React.useState('');
  const [businessGoal, setBusinessGoal] = React.useState('');
  const [targetAudience, setTargetAudience] = React.useState('');
  const [relatedProducts, setRelatedProducts] = React.useState('');
  const [preferredDeadline, setPreferredDeadline] = React.useState('');
  const [additionalNotes, setAdditionalNotes] = React.useState('');

  const handleGenerate = async () => {
    engine.createVisualGenerationJob();
    marketingToasts.teamStarted(() => {
      document.querySelector('#marketing-command-centre')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await new Promise((resolve) => setTimeout(resolve, 400));
    marketingToasts.campaignGenerated();
    setCampaignType('');
    setBusinessGoal('');
    setTargetAudience('');
    setRelatedProducts('');
    setPreferredDeadline('');
    setAdditionalNotes('');
  };

  return (
    <section id="campaigns" className="scroll-mt-6 space-y-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaign History</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Past and active campaigns for {MARKETING_DEMO_BRAND} — planned by the AI Marketing Team.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>Education-led campaigns across blog, social, and email.</CardDescription>
          </CardHeader>
          <CardContent>
            {THIRSTY_TURTL_CAMPAIGN_HISTORY.length === 0 ? (
              <MarketingEmptyState content={MARKETING_EMPTY_STATES.campaigns} onCta={handleGenerate} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Creative Assets</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {THIRSTY_TURTL_CAMPAIGN_HISTORY.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                      <TableCell>{row.assets}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter>
            <MarketingActionButton
              idleLabel="Generate Campaign"
              loadingLabel="Generating…"
              successLabel="Campaign created ✓"
              onAction={handleGenerate}
            />
          </CardFooter>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaign Requests</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Request a complete campaign powered by your Company Brain and the AI Marketing Team.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New campaign request</CardTitle>
            <CardDescription>Share your goals — the AI Marketing Team produces the full Campaign Package.</CardDescription>
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
                    placeholder="e.g. Increase educational traffic for Gentle Cleanser"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Input
                    id="target-audience"
                    value={targetAudience}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    placeholder="e.g. Adults with sensitive skin"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="related-products">Related Products</Label>
                  <Input
                    id="related-products"
                    value={relatedProducts}
                    onChange={(event) => setRelatedProducts(event.target.value)}
                    placeholder="e.g. Gentle Cleanser, Daily SPF"
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
                    placeholder="Brand constraints, seasonal angles, or competitor context."
                    rows={4}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Attachment Upload</Label>
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Upload briefs, brand assets, or reference materials for {MARKETING_DEMO_BRAND}.
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
              <MarketingActionButton
                idleLabel="Submit Campaign Request"
                loadingLabel="Submitting…"
                successLabel="Request submitted ✓"
                onAction={async () => {
                  await handleSubmit({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>);
                }}
              />
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaign Membership</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Monthly campaign credits for continuous {MARKETING_DEMO_BRAND} marketing.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {CAMPAIGN_MEMBERSHIP_PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'relative gap-4 py-6 transition-shadow duration-300',
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
