'use client';

import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ProjectActivityView() {
  const { deal, summary } = useProjectWorkspace();
  if (!deal || !summary) return null;

  const entries = deal.activityLog ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Recent activity for this project.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Operational timeline for this project container.</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity logged yet. Updates from funding, participants, and payouts will appear
              here as the project progresses.
            </p>
          ) : (
            <ul className="space-y-4">
              {entries.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="border-l-2 pl-4">
                  <p className="text-sm font-medium">{entry.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.at}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
