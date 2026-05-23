'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

type Props = {
  participantId?: string;
  participantName?: string;
  onRetry?: () => void;
  children: React.ReactNode;
};

type State = { error: Error | null };

export class SafeParticipantBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[SafeParticipantBoundary]',
        this.props.participantId ?? 'unknown',
        error
      );
    }
  }

  render() {
    if (this.state.error) {
      const label = this.props.participantName?.trim() || 'Participant';
      return (
        <TableRow>
          <TableCell colSpan={7} className="py-4">
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                We couldn&apos;t load {label} yet.
              </div>
              <p className="text-muted-foreground text-xs">
                Other participants remain available. This row can be retried without affecting the
                workspace.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onRetry?.();
                }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry participant
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }
    return this.props.children;
  }
}
