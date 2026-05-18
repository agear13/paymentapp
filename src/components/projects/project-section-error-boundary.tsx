'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  sectionTitle: string;
  children: React.ReactNode;
  onRetry?: () => void;
  fallbackMessage?: string;
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
      return (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {this.props.sectionTitle} unavailable
            </CardTitle>
            <CardDescription>
              {this.props.fallbackMessage ??
                'This section failed to load. The rest of the project workspace remains available.'}
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
