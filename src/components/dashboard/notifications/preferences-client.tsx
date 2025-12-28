'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationPreferences {
  payment_confirmed_email: boolean;
  payment_failed_email: boolean;
  xero_sync_failed_email: boolean;
  reconciliation_issue_email: boolean;
  weekly_summary_email: boolean;
  security_alert_email: boolean;
  payment_confirmed_inapp: boolean;
  payment_failed_inapp: boolean;
  xero_sync_failed_inapp: boolean;
}

export function NotificationPreferencesClient() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification preferences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        toast({
          title: 'Saved',
          description: 'Notification preferences updated successfully',
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Preferences</h1>
          <p className="text-muted-foreground">
            Manage how you receive notifications
          </p>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Preferences</h1>
          <p className="text-muted-foreground">Failed to load preferences</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Manage how you receive notifications about payments, syncs, and system alerts
        </p>
      </div>

      <div className="grid gap-6">
        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Receive notifications via email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="payment-confirmed-email">Payment Confirmed</Label>
                <p className="text-sm text-muted-foreground">
                  Receive emails when payments are successfully processed
                </p>
              </div>
              <Switch
                id="payment-confirmed-email"
                checked={preferences.payment_confirmed_email}
                onCheckedChange={(checked) =>
                  updatePreference('payment_confirmed_email', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="payment-failed-email">Payment Failed</Label>
                <p className="text-sm text-muted-foreground">
                  Receive emails when payment attempts fail
                </p>
              </div>
              <Switch
                id="payment-failed-email"
                checked={preferences.payment_failed_email}
                onCheckedChange={(checked) =>
                  updatePreference('payment_failed_email', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="xero-sync-failed-email">Xero Sync Failed</Label>
                <p className="text-sm text-muted-foreground">
                  Receive emails when Xero synchronization fails
                </p>
              </div>
              <Switch
                id="xero-sync-failed-email"
                checked={preferences.xero_sync_failed_email}
                onCheckedChange={(checked) =>
                  updatePreference('xero_sync_failed_email', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reconciliation-issue-email">Reconciliation Issues</Label>
                <p className="text-sm text-muted-foreground">
                  Receive emails when reconciliation discrepancies are detected
                </p>
              </div>
              <Switch
                id="reconciliation-issue-email"
                checked={preferences.reconciliation_issue_email}
                onCheckedChange={(checked) =>
                  updatePreference('reconciliation_issue_email', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly-summary-email">Weekly Summary</Label>
                <p className="text-sm text-muted-foreground">
                  Receive weekly summaries of your payment activity
                </p>
              </div>
              <Switch
                id="weekly-summary-email"
                checked={preferences.weekly_summary_email}
                onCheckedChange={(checked) =>
                  updatePreference('weekly_summary_email', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="security-alert-email">Security Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive emails about security-related events
                </p>
              </div>
              <Switch
                id="security-alert-email"
                checked={preferences.security_alert_email}
                onCheckedChange={(checked) =>
                  updatePreference('security_alert_email', checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* In-App Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>In-App Notifications</CardTitle>
            <CardDescription>
              Receive notifications in the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="payment-confirmed-inapp">Payment Confirmed</Label>
                <p className="text-sm text-muted-foreground">
                  Show in-app notifications for successful payments
                </p>
              </div>
              <Switch
                id="payment-confirmed-inapp"
                checked={preferences.payment_confirmed_inapp}
                onCheckedChange={(checked) =>
                  updatePreference('payment_confirmed_inapp', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="payment-failed-inapp">Payment Failed</Label>
                <p className="text-sm text-muted-foreground">
                  Show in-app notifications for failed payments
                </p>
              </div>
              <Switch
                id="payment-failed-inapp"
                checked={preferences.payment_failed_inapp}
                onCheckedChange={(checked) =>
                  updatePreference('payment_failed_inapp', checked)
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="xero-sync-failed-inapp">Xero Sync Failed</Label>
                <p className="text-sm text-muted-foreground">
                  Show in-app notifications for Xero sync failures
                </p>
              </div>
              <Switch
                id="xero-sync-failed-inapp"
                checked={preferences.xero_sync_failed_inapp}
                onCheckedChange={(checked) =>
                  updatePreference('xero_sync_failed_inapp', checked)
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}







