'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ReportSection } from '@/components/agreement-analyzer/report-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgreementAnalyzerLeadDetail } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';

type AgreementAnalyzerLeadDetailProps = {
  lead: AgreementAnalyzerLeadDetail;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AgreementAnalyzerLeadDetailView({ lead }: AgreementAnalyzerLeadDetailProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLifecycleAction(action: 'QUALIFIED' | 'DEMO_BOOKED' | 'CUSTOMER') {
    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch(
        `/api/agreement-analyzer/admin/leads/${lead.id}/lifecycle`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to update lifecycle stage');
      }

      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update lifecycle stage');
    } finally {
      setPendingAction(null);
    }
  }

  const revenueSplitCount = lead.report?.revenueSplits.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/agreement-analyzer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to leads
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="text-muted-foreground">{lead.email}</p>
        </div>
        <Badge variant="outline">{lead.lifecycleStage}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">First Name:</span> {lead.firstName}
            </p>
            <p>
              <span className="font-medium">Last Name:</span> {lead.lastName}
            </p>
            <p>
              <span className="font-medium">Email:</span> {lead.email}
            </p>
            <p>
              <span className="font-medium">Company:</span> {lead.companyName ?? '—'}
            </p>
            <p>
              <span className="font-medium">Business Type:</span> {lead.businessType ?? '—'}
            </p>
          </CardContent>
        </Card>

        {lead.processing ? (
          <Card>
            <CardHeader>
              <CardTitle>Extraction Processing</CardTitle>
              <CardDescription>Admin-only job queue status for this lead.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Extraction Status:</span>{' '}
                {lead.processing.extractionStatus}
              </p>
              <p>
                <span className="font-medium">Job Status:</span>{' '}
                {lead.processing.jobStatus ?? '—'}
              </p>
              <p>
                <span className="font-medium">Processing Attempts:</span>{' '}
                {lead.processing.processingAttempts}
              </p>
              <p>
                <span className="font-medium">Last Error:</span>{' '}
                {lead.processing.lastError ?? '—'}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Lead Qualification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Lead Score:</span> {lead.score?.overallScore ?? '—'}
            </p>
            <p>
              <span className="font-medium">Priority Band:</span> {lead.score?.priorityBand ?? '—'}
            </p>
            <p>
              <span className="font-medium">Recommended Use Case:</span>{' '}
              {lead.score?.recommendedUseCase ?? '—'}
            </p>
            <p>
              <span className="font-medium">Complexity Score:</span>{' '}
              {lead.score?.complexityScore ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Qualification Actions</CardTitle>
          <CardDescription>Progress this lead through the sales funnel.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleLifecycleAction('QUALIFIED')}
            disabled={pendingAction != null}
          >
            {pendingAction === 'QUALIFIED' ? 'Updating…' : 'Mark Qualified'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleLifecycleAction('DEMO_BOOKED')}
            disabled={pendingAction != null}
          >
            {pendingAction === 'DEMO_BOOKED' ? 'Updating…' : 'Mark Demo Booked'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleLifecycleAction('CUSTOMER')}
            disabled={pendingAction != null}
          >
            {pendingAction === 'CUSTOMER' ? 'Updating…' : 'Mark Customer'}
          </Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {lead.score?.revenueShareDetected ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Revenue Share Opportunity</CardTitle>
            <CardDescription>
              This agreement includes revenue-share or settlement patterns that align with
              Provvypay.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <p>
              <span className="font-medium">Parties identified:</span> {lead.score.partyCount ?? 0}
            </p>
            <p>
              <span className="font-medium">Revenue splits identified:</span> {revenueSplitCount}
            </p>
            <p>
              <span className="font-medium">Settlement complexity:</span>{' '}
              {lead.score.complexityScore ?? '—'}
            </p>
            <p>
              <span className="font-medium">Why Provvypay is relevant:</span> Automated settlement,
              revenue-share tracking, and multi-party payout coordination reduce manual reconciliation
              for this agreement type.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Demo Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {lead.demoBookings.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming demo bookings.</p>
            ) : (
              <ul className="space-y-4">
                {lead.demoBookings.upcoming.map((booking) => (
                  <li key={booking.id} className="rounded-lg border p-4 text-sm">
                    <p className="font-medium">{formatDateTime(booking.meetingTime)}</p>
                    <p className="text-muted-foreground">{booking.inviteeName}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Calendly Event ID: {booking.calendlyEventId}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Past Demo Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {lead.demoBookings.past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past demo bookings.</p>
            ) : (
              <ul className="space-y-4">
                {lead.demoBookings.past.map((booking) => (
                  <li key={booking.id} className="rounded-lg border p-4 text-sm">
                    <p className="font-medium">{formatDateTime(booking.meetingTime)}</p>
                    <p className="text-muted-foreground">{booking.inviteeName}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Calendly Event ID: {booking.calendlyEventId}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agreement Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.report ? (
              <>
                <ReportSection
                  title="Parties"
                  items={lead.report.parties}
                  emptyMessage="No parties identified."
                />
                <ReportSection
                  title="Revenue Splits"
                  items={lead.report.revenueSplits}
                  emptyMessage="No revenue splits identified."
                />
                <ReportSection
                  title="Payment Conditions"
                  items={lead.report.paymentConditions}
                  emptyMessage="No payment conditions identified."
                />
                <ReportSection
                  title="Risks"
                  items={lead.report.risks}
                  emptyMessage="No risks identified."
                  variant="risk"
                />
                <ReportSection
                  title="Missing Clauses"
                  items={lead.report.missingInformation}
                  emptyMessage="No missing clauses flagged."
                  variant="missing"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No completed report available yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {lead.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-4">
                {lead.activity.map((event) => (
                  <li key={`${event.type}-${event.occurredAt}`} className="border-l-2 border-muted pl-4">
                    <p className="font-medium">{event.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(event.occurredAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
