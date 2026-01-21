'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AlertTriangle, CheckCircle2, AlertCircle, Info, TrendingDown, TrendingUp, Package } from 'lucide-react';
import { inventorySkus, skuTimelineEvents } from '@/lib/data/mock-platform-preview';

export default function PlatformPreviewInventoryPage() {
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OK':
        return { variant: 'default' as const, icon: CheckCircle2, className: 'text-green-500' };
      case 'Low':
        return { variant: 'secondary' as const, icon: AlertTriangle, className: 'text-yellow-500' };
      case 'Drift':
        return { variant: 'outline' as const, icon: AlertCircle, className: 'text-orange-500' };
      default:
        return { variant: 'outline' as const, icon: CheckCircle2, className: 'text-gray-500' };
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'Sale Burn':
        return TrendingDown;
      case 'Delivery':
        return TrendingUp;
      case 'Waste':
        return AlertCircle;
      case 'Adjustment':
        return Info;
      case 'Stocktake':
        return Package;
      default:
        return Info;
    }
  };

  const selectedSku = inventorySkus.find(sku => sku.skuId === selectedSkuId);
  const skuTimeline = selectedSkuId ? skuTimelineEvents[selectedSkuId] || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <Badge variant="secondary">Preview</Badge>
          </div>
          <p className="text-muted-foreground">
            SKU-level inventory visibility derived from economic events. (Preview)
          </p>
        </div>
      </div>

      {/* Mapping Info Banner */}
      <Card className="border-dashed bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Info className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Mapping Improves Accuracy</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Connect your inventory items across POS, marketplaces, and accounting systems for unified
                tracking. Better mapping = more accurate stock levels.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowMappingDialog(true)}>
                Map Items (Preview)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>SKU Overview</CardTitle>
          <CardDescription>
            Estimated on-hand quantities and reorder suggestions based on velocity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU Name</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Velocity/Day</TableHead>
                <TableHead className="text-right">Days Cover</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reorder Suggestion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventorySkus.map((sku) => {
                const statusInfo = getStatusBadge(sku.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <TableRow
                    key={sku.skuId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedSkuId(sku.skuId)}
                  >
                    <TableCell className="font-medium">{sku.skuName}</TableCell>
                    <TableCell className="text-right">{sku.estimatedOnHand}</TableCell>
                    <TableCell className="text-right">{sku.velocityPerDay.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          sku.daysOfCover < 3
                            ? 'text-red-600 font-semibold'
                            : sku.daysOfCover < 5
                            ? 'text-yellow-600 font-medium'
                            : ''
                        }
                      >
                        {sku.daysOfCover.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                        <StatusIcon className={`h-3 w-3 ${statusInfo.className}`} />
                        {sku.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sku.reorderSuggestion}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SKU Detail Drawer */}
      <Sheet open={!!selectedSkuId} onOpenChange={(open) => !open && setSelectedSkuId(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedSku?.skuName}
            </SheetTitle>
            <SheetDescription>Inventory timeline and event history</SheetDescription>
          </SheetHeader>

          {selectedSku && (
            <div className="space-y-6 py-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">On Hand</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{selectedSku.estimatedOnHand}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Days Cover</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{selectedSku.daysOfCover.toFixed(1)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Velocity/Day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{selectedSku.velocityPerDay.toFixed(1)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={getStatusBadge(selectedSku.status).variant} className="text-sm">
                      {selectedSku.status}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Reorder Suggestion */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Reorder Suggestion</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selectedSku.reorderSuggestion}</p>
                </CardContent>
              </Card>

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Inventory Timeline</h4>
                {skuTimeline.length > 0 ? (
                  <div className="space-y-3">
                    {skuTimeline.map((event, index) => {
                      const EventIcon = getEventIcon(event.eventType);
                      const isPositive = event.qtyDelta > 0;
                      const isNegative = event.qtyDelta < 0;

                      return (
                        <div key={index} className="flex gap-3 p-3 border rounded-lg bg-muted/30">
                          <div
                            className={`p-2 rounded-lg h-fit ${
                              isPositive
                                ? 'bg-green-500/10'
                                : isNegative
                                ? 'bg-red-500/10'
                                : 'bg-blue-500/10'
                            }`}
                          >
                            <EventIcon
                              className={`h-4 w-4 ${
                                isPositive
                                  ? 'text-green-500'
                                  : isNegative
                                  ? 'text-red-500'
                                  : 'text-blue-500'
                              }`}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{event.eventType}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(event.timestamp).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={
                                  isPositive
                                    ? 'text-green-600 border-green-600'
                                    : isNegative
                                    ? 'text-red-600 border-red-600'
                                    : ''
                                }
                              >
                                {event.qtyDelta > 0 ? '+' : ''}
                                {event.qtyDelta}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{event.note}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No timeline events for this SKU</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Mapping (Preview)</DialogTitle>
            <DialogDescription>
              Connect inventory items across your connected systems for unified tracking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">How Mapping Works</h4>
              <p className="text-sm text-muted-foreground">
                Provvypay automatically matches items across your POS, marketplaces (like Grab), and accounting
                systems using SKU codes, names, and barcodes.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">What Gets Better</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>More accurate on-hand quantities by reconciling all sales channels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Earlier drift detection when discrepancies appear across systems</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Smarter reorder suggestions based on true multi-channel velocity</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Preview Status</h4>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  The mapping interface will be available when Platform Preview launches. For now, this demonstrates
                  the concept of unified inventory tracking.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

