'use client';

/**
 * Xero Connection Component
 * Manages Xero OAuth connection and tenant selection
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface XeroConnectionProps {
  organizationId: string;
}

interface ConnectionStatus {
  connected: boolean;
  tenantId?: string;
  expiresAt?: string;
  connectedAt?: string;
  tenants?: Array<{
    tenantId: string;
    tenantName: string;
    tenantType: string;
  }>;
}

export function XeroConnection({ organizationId }: XeroConnectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [changingTenant, setChangingTenant] = React.useState(false);

  // Fetch connection status
  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch(
        `/api/xero/status?organization_id=${organizationId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching Xero status:', error);
      toast.error('Failed to load Xero connection status');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  // Handle OAuth callback results
  React.useEffect(() => {
    const success = searchParams.get('xero_success');
    const error = searchParams.get('xero_error');

    if (success === 'connected') {
      toast.success('Successfully connected to Xero!');
      fetchStatus();
      
      // Clean up URL
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        missing_parameters: 'Missing required parameters',
        invalid_state: 'Invalid connection state',
        no_tenants: 'No Xero organizations found',
        connection_failed: 'Failed to establish connection',
      };
      
      toast.error(errorMessages[error] || 'Failed to connect to Xero');
      
      // Clean up URL
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, fetchStatus]);

  // Fetch status on mount
  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle connect
  const handleConnect = async () => {
    setConnecting(true);
    try {
      window.location.href = `/api/xero/connect?organization_id=${organizationId}`;
    } catch (error) {
      console.error('Error connecting to Xero:', error);
      toast.error('Failed to initiate Xero connection');
      setConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/xero/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success('Disconnected from Xero');
      await fetchStatus();
    } catch (error) {
      console.error('Error disconnecting from Xero:', error);
      toast.error('Failed to disconnect from Xero');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle tenant change
  const handleTenantChange = async (tenantId: string) => {
    setChangingTenant(true);
    try {
      const response = await fetch('/api/xero/tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId, tenantId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tenant');
      }

      toast.success('Xero organization updated');
      await fetchStatus();
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('Failed to update Xero organization');
    } finally {
      setChangingTenant(false);
    }
  };

  // Handle reconnect
  const handleReconnect = async () => {
    await handleConnect();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          {status?.connected ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" />
              Not Connected
            </Badge>
          )}
        </div>

        {status?.connected ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove your Xero connection. You&apos;ll need to reconnect
                  to sync invoices and payments again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect to Xero'
            )}
          </Button>
        )}
      </div>

      {/* Tenant Selector (when connected) */}
      {status?.connected && status.tenants && status.tenants.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Xero Organization</label>
          <div className="flex items-center gap-2">
            <Select
              value={status.tenantId}
              onValueChange={handleTenantChange}
              disabled={changingTenant}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {status.tenants.map((tenant) => (
                  <SelectItem key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.tenantName} ({tenant.tenantType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {changingTenant && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Select which Xero organization to sync with
          </p>
        </div>
      )}

      {/* Connection Details */}
      {status?.connected && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Connected</span>
            <span className="font-mono text-xs">
              {status.connectedAt
                ? new Date(status.connectedAt).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Token Expires</span>
            <span className="font-mono text-xs">
              {status.expiresAt
                ? new Date(status.expiresAt).toLocaleString()
                : 'Unknown'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReconnect}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconnect
          </Button>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        {status?.connected
          ? 'Your Xero account is connected. Invoices and payments will be automatically synced.'
          : 'Connect your Xero account to automatically sync invoices and payments.'}
      </p>
    </div>
  );
}






