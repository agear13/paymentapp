'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ShoppingBag,
  CreditCard,
  Calculator,
  Settings,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Handshake,
} from 'lucide-react';
import { connections } from '@/lib/data/mock-platform-preview';

export default function PlatformPreviewConnectionsPage() {

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Connected':
        return { variant: 'default' as const, icon: CheckCircle2, className: 'text-green-500' };
      case 'Needs Attention':
        return { variant: 'secondary' as const, icon: AlertTriangle, className: 'text-yellow-500' };
      case 'Off':
        return { variant: 'outline' as const, icon: XCircle, className: 'text-gray-500' };
      case 'Coming Soon':
        return { variant: 'outline' as const, icon: Clock, className: 'text-blue-500' };
      default:
        return { variant: 'outline' as const, icon: XCircle, className: 'text-gray-500' };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'POS':
        return ShoppingBag;
      case 'Marketplace':
        return ShoppingBag;
      case 'Payments':
        return CreditCard;
      case 'Accounting':
        return Calculator;
      case 'Platform':
        return Handshake;
      default:
        return Settings;
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
            <Badge variant="secondary">Preview</Badge>
          </div>
          <p className="text-muted-foreground">
            Manage the systems that feed Provvypay&apos;s unified view. (Preview)
          </p>
        </div>
      </div>

      {/* Connections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => {
          const statusInfo = getStatusBadge(connection.status);
          const CategoryIcon = getCategoryIcon(connection.category);
          const StatusIcon = statusInfo.icon;

          return (
            <Card key={connection.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CategoryIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{connection.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{connection.category}</p>
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                    <StatusIcon className={`h-3 w-3 ${statusInfo.className}`} />
                    {connection.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{connection.helperText}</p>

                {connection.lastSync && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Last sync: </span>
                    <span className="font-medium">{formatLastSync(connection.lastSync)}</span>
                  </div>
                )}

                {/* Data Feeds */}
                {connection.dataFeedsEnabled.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Data Feeds</p>
                    <div className="flex flex-wrap gap-1.5">
                      {connection.dataFeedsEnabled.map((feed) => (
                        <Badge key={feed} variant="outline" className="text-xs">
                          {feed}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Switch disabled={true} checked={connection.status === 'Connected'} />
                            <span className="text-sm text-muted-foreground">
                              {connection.status === 'Connected' ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Coming soon</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        Manage
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <CategoryIcon className="h-5 w-5 text-primary" />
                          {connection.name}
                        </DialogTitle>
                        <DialogDescription>{connection.helperText}</DialogDescription>
                      </DialogHeader>

                      <div className="space-y-6 py-4">
                        {/* Connection Status */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Connection Status</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                              <StatusIcon className={`h-3 w-3 ${statusInfo.className}`} />
                              {connection.status}
                            </Badge>
                            {connection.lastSync && (
                              <span className="text-sm text-muted-foreground">
                                Last synced {formatLastSync(connection.lastSync)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* What Data We Ingest */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">What Data We Ingest</h4>
                          <div className="p-3 bg-muted rounded-lg">
                            {connection.dataFeedsEnabled.length > 0 ? (
                              <ul className="space-y-1.5">
                                {connection.dataFeedsEnabled.map((feed) => (
                                  <li key={feed} className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    {feed}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">No data feeds configured</p>
                            )}
                          </div>
                        </div>

                        {/* Mapping Status */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Mapping Status</h4>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Field mappings</span>
                              <Badge variant="outline">12 mapped, 3 unmapped</Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            (Static preview data - mapping interface coming soon)
                          </p>
                        </div>

                        {/* Health */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Health</h4>
                          <div className="p-3 bg-muted rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Last event received</span>
                              <span className="font-medium">
                                {connection.lastSync ? formatLastSync(connection.lastSync) : 'Never'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>Error rate</span>
                              <span className="font-medium text-green-600">0.02%</span>
                            </div>
                          </div>
                        </div>

                        {/* What You Get */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">What You Get</h4>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>
                                Real-time sync of {connection.category.toLowerCase()} data into your unified view
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>
                                Automatic reconciliation with other data sources for complete accuracy
                              </span>
                            </li>
                          </ul>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t">
                          <Button variant="outline" className="flex-1" disabled>
                            Configure Mapping
                          </Button>
                          <Button variant="outline" className="flex-1" disabled>
                            View Logs
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Banner */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Settings className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Connection Preview</h3>
              <p className="text-sm text-muted-foreground">
                This is a preview of how Provvypay unifies data from multiple sources. Toggle switches and
                configuration options will be functional when the platform launches.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

