'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, ExternalLink, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Conversion {
  id: string;
  team_id: string;
  conversion_type: string;
  tx_hash?: string;
  screenshot_url?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  sponsors: {
    name: string;
    payout_per_conversion: number;
  };
  teams: {
    name: string;
  };
}

export default function HuntPayAdminPage() {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadConversions();
  }, []);

  const loadConversions = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('conversions')
        .select(`
          *,
          sponsors (name, payout_per_conversion),
          teams (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversions(data || []);
    } catch (error) {
      console.error('Failed to load conversions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (conversionId: string) => {
    setProcessing(conversionId);
    try {
      const response = await fetch(`/api/huntpay/admin/conversions/${conversionId}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to approve');
      }

      await loadConversions();
      alert('Conversion approved! Partner ledger entry created.');
    } catch (error) {
      console.error('Approve error:', error);
      alert('Failed to approve conversion');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (conversionId: string) => {
    setProcessing(conversionId);
    try {
      const response = await fetch(`/api/huntpay/admin/conversions/${conversionId}/reject`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reject');
      }

      await loadConversions();
    } catch (error) {
      console.error('Reject error:', error);
      alert('Failed to reject conversion');
    } finally {
      setProcessing(null);
    }
  };

  const pending = conversions.filter(c => c.status === 'pending');
  const approved = conversions.filter(c => c.status === 'approved');
  const rejected = conversions.filter(c => c.status === 'rejected');

  const totalPayout = approved.reduce((sum, c) => sum + c.sponsors.payout_per_conversion, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">HuntPay Admin</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">HuntPay Admin</h1>
        <p className="text-muted-foreground">
          Review and approve conversions to create partner ledger entries
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Integration Active:</strong> When you approve a conversion, a real ledger entry is created in Partners → Ledger.
          The sponsor earnings will appear in the Partners Dashboard automatically.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approved.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejected.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPayout.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversion Review</CardTitle>
          <CardDescription>
            Approve conversions to generate affiliate payouts in the Partners system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pending.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Sponsor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Proof</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((conversion) => (
                      <TableRow key={conversion.id}>
                        <TableCell className="font-medium">{conversion.teams.name}</TableCell>
                        <TableCell>{conversion.sponsors.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{conversion.conversion_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {conversion.tx_hash && (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${conversion.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <span className="truncate">{conversion.tx_hash.substring(0, 10)}...</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {conversion.screenshot_url && (
                            <a
                              href={conversion.screenshot_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              View Screenshot
                            </a>
                          )}
                          {conversion.note && (
                            <span className="text-sm text-muted-foreground">{conversion.note}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${conversion.sponsors.payout_per_conversion.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {new Date(conversion.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(conversion.id)}
                              disabled={processing === conversion.id}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(conversion.id)}
                              disabled={processing === conversion.id}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No pending conversions
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              {approved.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Sponsor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approved.map((conversion) => (
                      <TableRow key={conversion.id}>
                        <TableCell>{conversion.teams.name}</TableCell>
                        <TableCell>{conversion.sponsors.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{conversion.conversion_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${conversion.sponsors.payout_per_conversion.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {new Date(conversion.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">Approved</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No approved conversions
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {rejected.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Sponsor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejected.map((conversion) => (
                      <TableRow key={conversion.id}>
                        <TableCell>{conversion.teams.name}</TableCell>
                        <TableCell>{conversion.sponsors.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{conversion.conversion_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(conversion.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">Rejected</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No rejected conversions
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
