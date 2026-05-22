'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type OperationalBoundaryScope =
  | 'default'
  | 'onboarding'
  | 'configuration'
  | 'payouts'
  | 'release';

type Props = {
  sectionTitle: string;
  children: React.ReactNode;
  onRetry?: () => void;
  fallbackMessage?: string;
  boundaryScope?: OperationalBoundaryScope;
};

type State = { error: Error | null };

export class ProjectSectionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[ProjectWorkspace] section error (${this.props.sectionTitle})`, error);
    }
  }

  render() {
    if (this.state.error) {
      const scope = this.props.boundaryScope ?? 'default';
      const defaultMessage =
        scope === 'configuration' || scope === 'onboarding'
          ? "We couldn't load this setup step yet. Your project information is still safe."
          : scope === 'payouts'
            ? "We couldn't load payout details right now. Your project data is unchanged."
            : scope === 'release'
              ? "We couldn't load the release preview. Try again when ready."
              : this.props.sectionTitle === 'Participants'
                ? "We couldn't load participant payout configuration. Try refreshing or reopen participant management."
                : 'This section failed to load. The rest of the project workspace remains available.';

      const title =
        scope === 'configuration' || scope === 'onboarding'
          ? 'Setup step temporarily unavailable'
          : `${this.props.sectionTitle} unavailable`;

      return (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              {title}
            </CardTitle>
            <CardDescription>
              {this.props.fallbackMessage ?? defaultMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                this.setState({ error: null });
                this.props.onRetry?.();
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
