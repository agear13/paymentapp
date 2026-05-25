'use client';

import * as React from 'react';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Development-only operational graph diagnostics — equivalent to Redux DevTools for ops. */
export function OperationalGraphDiagnostics() {
  if (process.env.NODE_ENV !== 'development') return null;

  const { graph, auditTimeline, loading } = useOperationalGuidance();
  const [open, setOpen] = React.useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-violet-700"
      >
        Ops Graph
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[420px] max-h-[70vh] overflow-auto shadow-2xl border-violet-500/30">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Operational Graph Diagnostics</CardTitle>
        <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>
          Close
        </button>
      </CardHeader>
      <CardContent className="space-y-3 text-xs font-mono">
        {loading ? <p className="text-muted-foreground">Loading graph…</p> : null}
        <section>
          <p className="font-semibold text-foreground mb-1">Summary</p>
          <pre className="whitespace-pre-wrap break-all text-[10px] bg-muted/40 p-2 rounded">
            {JSON.stringify(graph.summary, null, 2)}
          </pre>
        </section>
        <section>
          <p className="font-semibold text-foreground mb-1">Funding</p>
          <pre className="whitespace-pre-wrap break-all text-[10px] bg-muted/40 p-2 rounded">
            {JSON.stringify(graph.funding, null, 2)}
          </pre>
        </section>
        <section>
          <p className="font-semibold text-foreground mb-1">
            Participants ({graph.participants.length})
          </p>
          <pre className="whitespace-pre-wrap break-all text-[10px] bg-muted/40 p-2 rounded max-h-40 overflow-auto">
            {JSON.stringify(
              graph.participants.map((p) => ({
                id: p.participant.id,
                name: p.participant.name,
                releaseReady: p.releaseReadiness.releaseReady,
                payoutReady: p.payoutReadiness.payoutReady,
                hierarchy: p.readinessHierarchy,
                blockers: p.blockers.length,
              })),
              null,
              2
            )}
          </pre>
        </section>
        <section>
          <p className="font-semibold text-foreground mb-1">Audit ({auditTimeline.length})</p>
          <pre className="whitespace-pre-wrap break-all text-[10px] bg-muted/40 p-2 rounded max-h-32 overflow-auto">
            {JSON.stringify(auditTimeline.slice(0, 8), null, 2)}
          </pre>
        </section>
      </CardContent>
    </Card>
  );
}
