'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

/**
 * Diagnostic Panel
 * 
 * Temporary component to help diagnose organization ID and data loading issues.
 * Add this to your dashboard page to quickly check what's wrong.
 * 
 * Usage:
 * import { DiagnosticPanel } from '@/components/dashboard/diagnostic-panel';
 * 
 * Then in your page:
 * <DiagnosticPanel />
 */
export function DiagnosticPanel() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnostics: any = {
      organizationId: null,
      merchantSettings: null,
      paymentLinks: null,
      userOrganization: null,
      issues: [],
    };

    try {
      // 1. Check localStorage org ID
      diagnostics.organizationId = localStorage.getItem('provvypay.organizationId');
      
      if (!diagnostics.organizationId) {
        diagnostics.issues.push({
          severity: 'error',
          message: 'No organization ID in localStorage. Log out and back in.',
        });
        setResults(diagnostics);
        setLoading(false);
        return;
      }

      // 2. Check merchant settings
      const settingsRes = await fetch(`/api/merchant-settings?organizationId=${diagnostics.organizationId}`);
      const settingsData = await settingsRes.json();
      diagnostics.merchantSettings = settingsData.data || [];

      if (diagnostics.merchantSettings.length === 0) {
        diagnostics.issues.push({
          severity: 'error',
          message: 'No merchant settings found. Go to Settings → Merchant and configure.',
        });
      } else {
        const settings = diagnostics.merchantSettings[0];
        if (!settings.stripe_account_id && !settings.hedera_account_id) {
          diagnostics.issues.push({
            severity: 'warning',
            message: 'No payment methods configured. Add Stripe or Hedera account ID.',
          });
        }
      }

      // 3. Check payment links
      const linksRes = await fetch(`/api/payment-links?organizationId=${diagnostics.organizationId}`);
      const linksData = await linksRes.json();
      diagnostics.paymentLinks = linksData.data || [];

      if (diagnostics.paymentLinks.length === 0) {
        diagnostics.issues.push({
          severity: 'info',
          message: 'No payment links found. This may be normal if you haven\'t created any yet.',
        });
      }

      // 4. Check user organization endpoint
      const userOrgRes = await fetch('/api/user/organization');
      const userOrgData = await userOrgRes.json();
      diagnostics.userOrganization = userOrgData.organizationId;

      if (diagnostics.userOrganization !== diagnostics.organizationId) {
        diagnostics.issues.push({
          severity: 'error',
          message: 'Organization ID mismatch! Cached ID differs from API.',
        });
      }

      // Summary
      if (diagnostics.issues.length === 0) {
        diagnostics.issues.push({
          severity: 'success',
          message: 'All checks passed! Your platform is configured correctly.',
        });
      }

      setResults(diagnostics);
    } catch (error) {
      diagnostics.issues.push({
        severity: 'error',
        message: `Diagnostic failed: ${error}`,
      });
      setResults(diagnostics);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, any> = {
      success: 'default',
      warning: 'secondary',
      error: 'destructive',
      info: 'outline',
    };
    return variants[severity] || 'outline';
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg">🔍 Platform Diagnostics</CardTitle>
        <CardDescription>
          Check if your organization ID, merchant settings, and payment links are configured correctly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </Button>

        {results && (
          <div className="space-y-4 mt-4">
            {/* Issues */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Issues Found</h4>
              {results.issues.map((issue: any, index: number) => (
                <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1">
                    <Badge variant={getSeverityBadge(issue.severity)} className="mb-1">
                      {issue.severity}
                    </Badge>
                    <p className="text-sm">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-semibold text-sm">Details</h4>
              
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization ID:</span>
                  <span className="font-mono text-xs">{results.organizationId || 'None'}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Org ID:</span>
                  <span className="font-mono text-xs">{results.userOrganization || 'None'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merchant Settings:</span>
                  <span>{results.merchantSettings?.length || 0} found</span>
                </div>

                {results.merchantSettings && results.merchantSettings.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stripe ID:</span>
                      <span>{results.merchantSettings[0].stripe_account_id || '❌ Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hedera ID:</span>
                      <span>{results.merchantSettings[0].hedera_account_id || '❌ Not set'}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Links:</span>
                  <span>{results.paymentLinks?.length || 0} found</span>
                </div>
              </div>
            </div>

            {/* Quick Fixes */}
            {results.issues.some((i: any) => i.severity === 'error' || i.severity === 'warning') && (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm">Quick Fixes</h4>
                <div className="space-y-2 text-sm">
                  {!results.merchantSettings || results.merchantSettings.length === 0 ? (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard/settings/merchant'}>
                      Configure Merchant Settings
                    </Button>
                  ) : null}
                  
                  {results.userOrganization !== results.organizationId ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        localStorage.removeItem('provvypay.organizationId');
                        alert('Cache cleared. Please log out and back in.');
                      }}
                    >
                      Clear Cache & Re-login
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-4 border-t">
          <p>💡 Tip: Remove this component after resolving issues</p>
        </div>
      </CardContent>
    </Card>
  );
}

