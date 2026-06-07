import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingSetupChecklistItem } from '@/lib/onboarding/onboarding-setup-checklist.server';

type OnboardingContinuationBannerProps = {
  checklist: OnboardingSetupChecklistItem[];
  projectName?: string;
};

export function OnboardingContinuationBanner({
  checklist,
  projectName,
}: OnboardingContinuationBannerProps) {
  const workspaceHref = projectName
    ? `/dashboard?workspace=ready&project=${encodeURIComponent(projectName)}`
    : '/dashboard?workspace=ready';

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">Onboarding setup</Badge>
            <h2 className="text-lg font-semibold">Finish configuring settlement infrastructure</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Configure settlement infrastructure to coordinate revenue collection and obligations
              across your agreements.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding">Continue setup</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={workspaceHref}>Return to workspace</Link>
            </Button>
          </div>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm',
                item.complete && 'border-green-200/80 bg-green-50/50'
              )}
            >
              {item.complete ? (
                <Check className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={item.complete ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
