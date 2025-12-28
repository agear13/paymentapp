'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RefreshCw, Eye, AlertCircle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ErrorLog {
  id: string;
  payment_link_id: string;
  status: string;
  retry_count: number;
  error_message: string | null;
  request_payload: any;
  response_payload: any;
  updated_at: string;
  payment_links: {
    id: string;
    amount: string;
    currency: string;
    invoice_reference: string | null;
  };
}

export function ErrorLogsViewer() {
  const { organization } = useOrganization();
  const [errors, setErrors] = React.useState<ErrorLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedError, setSelectedError] = React.useState<ErrorLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (organization?.id) {
      loadErrors();
    }
  }, [organization?.id]);

  async function loadErrors() {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/xero/sync/failed?organization_id=${organization.id}&limit=100`
      );
      
      if (response.ok) {
        const { data } = await response.json();
        setErrors(data);
      }
    } catch (error) {
      console.error('Error loading error logs:', error);
      toast.error('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }

  function openDetailDialog(error: ErrorLog) {
    setSelectedError(error);
    setDetailDialogOpen(true);
  }

  function categorizeError(errorMessage: string | null): { type: string; color: string } {
    if (!errorMessage) return { type: 'UNKNOWN', color: 'gray' };

    const lower = errorMessage.toLowerCase();
    
    if (lower.includes('not found') || lower.includes('invalid')) {
      return { type: 'PERMANENT', color: 'red' };
    }
    if (lower.includes('rate limit') || lower.includes('429')) {
      return { type: 'RATE_LIMIT', color: 'yellow' };
    }
    if (lower.includes('timeout') || lower.includes('network')) {
      return { type: 'NETWORK', color: 'orange' };
    }
    if (lower.includes('token') || lower.includes('expired')) {
      return { type: 'AUTH', color: 'blue' };
    }
    
    return { type: 'API_ERROR', color: 'purple' };
  }

  const filteredErrors = errors.filter((error) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      error.error_message?.toLowerCase().includes(search) ||
      error.payment_links.invoice_reference?.toLowerCase().includes(search) ||
      error.payment_link_id.toLowerCase().includes(search)
    );
  });

  if (!organization) {
    return <div>Please select an organization</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Error Logs</CardTitle>
              <CardDescription>
                Failed sync operations and error details
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search errors..."
                  className="pl-8 w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadErrors} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredErrors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No matching errors found' : 'No error logs found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error Type</TableHead>
                  <TableHead>Payment Link</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead>Retry Count</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredErrors.map((error) => {
                  const errorType = categorizeError(error.error_message);
                  return (
                    <TableRow key={error.id}>
                      <TableCell>
                        <Badge variant="outline" className={`text-${errorType.color}-600`}>
                          {errorType.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {error.payment_links.invoice_reference || error.payment_link_id.slice(0, 8)}
                        <div className="text-xs text-muted-foreground">
                          {error.payment_links.amount} {error.payment_links.currency}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <span className="text-sm text-destructive">
                            {error.error_message?.slice(0, 80) || 'Unknown error'}
                            {error.error_message && error.error_message.length > 80 && '...'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{error.retry_count}/5</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(error.updated_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDialog(error)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Error Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>
              Detailed error information and stack trace
            </DialogDescription>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Error Type</div>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {categorizeError(selectedError.error_message).type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Retry Count</div>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedError.retry_count}/5</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payment Link ID</div>
                  <div className="mt-1 font-mono text-sm">{selectedError.payment_link_id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Invoice Reference</div>
                  <div className="mt-1">
                    {selectedError.payment_links.invoice_reference || 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Full Error Message</div>
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                  <pre className="whitespace-pre-wrap break-words">
                    {selectedError.error_message || 'No error message available'}
                  </pre>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Request Payload</div>
                <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  {JSON.stringify(selectedError.request_payload, null, 2)}
                </pre>
              </div>

              {selectedError.response_payload && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Response Payload</div>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedError.response_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}







