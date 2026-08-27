'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';

type Fixture = {
  participantId: string;
  name: string;
  invitedEmail: string | null;
  projectName: string;
  portalPath: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
  labels: string[];
};

export function ParticipantPortalTestClient() {
  const [fixtures, setFixtures] = React.useState<Fixture[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/internal/participant-test-context', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = (await res.json()) as { fixtures?: Fixture[] };
      if (!cancelled) {
        setFixtures(data.fixtures ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openAsTestParticipant = async (fixture: Fixture) => {
    setBusyId(fixture.participantId);
    try {
      const res = await csrfAwareFetch('/api/internal/participant-test-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: fixture.participantId }),
      });
      const data = (await res.json().catch(() => ({}))) as { portalPath?: string; error?: string };
      if (!res.ok || !data.portalPath) {
        toast.error(data.error || 'Could not open test participant');
        return;
      }
      window.location.assign(data.portalPath);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <CsrfBootstrap />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            <Link href="/dashboard/admin/developer" className="underline underline-offset-2">
              Developer Control Centre
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Test Participant Portal</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Open a real participant portal using a short-lived server test identity. You stay signed
            in as yourself. Organiser preview remains read-only and does not mint a test cookie.
            Conversion, attribution, and invoice provenance still use your real user and organisation.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading eligible invitations…</p>
        ) : fixtures.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No tester-owned invitations</CardTitle>
              <CardDescription>
                Create QA participant invitations on deals you own. Rows bound to another user cannot
                be opened as a test participant.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {fixtures.map((fixture) => (
              <Card key={fixture.participantId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{fixture.name}</CardTitle>
                  <CardDescription>
                    {fixture.projectName}
                    {fixture.invitedEmail ? ` · ${fixture.invitedEmail}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {fixture.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="font-normal">
                        {label}
                      </Badge>
                    ))}
                    {!fixture.eligible && fixture.ineligibleReason ? (
                      <Badge variant="outline">{fixture.ineligibleReason}</Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!fixture.eligible || busyId === fixture.participantId}
                      onClick={() => void openAsTestParticipant(fixture)}
                    >
                      {busyId === fixture.participantId ? 'Opening…' : 'Open as test participant'}
                    </Button>
                    {fixture.portalPath ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`${fixture.portalPath}?mode=preview`}>Open organiser preview</a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
