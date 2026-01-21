'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Calendar, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';
import { mockPayouts, type Payout } from '@/lib/data/mock-partners';

export default function PartnerPayoutsPage() {
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRowClick = (payout: Payout) => {
    setSelectedPayout(payout);
    setDialogOpen(true);
  };

  const scheduledPayouts = mockPayouts.filter((p) => p.status === 'Scheduled');
  const completedPayouts = mockPayouts.filter((p) => p.status === 'Completed');

  const totalScheduled = scheduledPayouts.reduce((sum, p) => sum + p.amount, 0);
  const totalCompleted = completedPayouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          View scheduled and completed payouts for your revenue share earnings
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockPayouts.length}</div>
            <p className="text-xs text-muted-foreground">All time transfers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalScheduled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{scheduledPayouts.length} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalCompleted.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{completedPayouts.length} successful</p>
          </CardContent>
        </Card>
      </div>

      {/* Payouts Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            Click on any payout to view detailed breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="scheduled">
            <TabsList>
              <TabsTrigger value="scheduled">
                Scheduled ({scheduledPayouts.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedPayouts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scheduled" className="space-y-4">
              {scheduledPayouts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledPayouts.map((payout) => (
                      <TableRow
                        key={payout.id}
                        className="cursor-pointer"
                        onClick={() => handleRowClick(payout)}
                      >
                        <TableCell className="font-medium">
                          {new Date(payout.periodStart).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          -{' '}
                          {new Date(payout.periodEnd).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {payout.scheduledDate &&
                            new Date(payout.scheduledDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${payout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.method}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{payout.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{payout.referenceId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No scheduled payouts
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedPayouts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Completed Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedPayouts.map((payout) => (
                      <TableRow
                        key={payout.id}
                        className="cursor-pointer"
                        onClick={() => handleRowClick(payout)}
                      >
                        <TableCell className="font-medium">
                          {new Date(payout.periodStart).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          -{' '}
                          {new Date(payout.periodEnd).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {payout.completedDate &&
                            new Date(payout.completedDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${payout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.method}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">{payout.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{payout.referenceId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No completed payouts
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Payout Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
            <DialogDescription>
              Complete information for this payout transfer
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reference ID</p>
                  <p className="text-sm font-mono">{selectedPayout.referenceId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      selectedPayout.status === 'Completed'
                        ? 'success'
                        : selectedPayout.status === 'Scheduled'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="mt-1"
                  >
                    {selectedPayout.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Payout Period</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm">
                    {new Date(selectedPayout.periodStart).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">to</p>
                  <p className="text-sm">
                    {new Date(selectedPayout.periodEnd).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Payment Details</p>

                <div className="flex items-center justify-between">
                  <p className="text-sm">Payout Amount</p>
                  <p className="text-lg font-bold text-primary">
                    ${selectedPayout.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm">Payment Method</p>
                  <Badge variant="outline">{selectedPayout.method}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm">Ledger Entries Included</p>
                  <p className="text-sm font-medium">{selectedPayout.ledgerEntries.length}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                {selectedPayout.scheduledDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Scheduled Date</p>
                    <p className="text-sm mt-1">
                      {new Date(selectedPayout.scheduledDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                {selectedPayout.completedDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed Date</p>
                    <p className="text-sm mt-1">
                      {new Date(selectedPayout.completedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {selectedPayout.status === 'Completed' && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Payout successfully completed</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

