'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  TrendingUp,
  Clock,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface HealthCheck {
  status: string;
  timestamp: string;
  responseTime: string;
  checks: {
    database: { status: string; message: string };
    syncActivity: { status: string; message: string; recentSyncs: number };
    queue: { status: string; pending: number; retrying: number; backlog: number };
    alerts: { status: string; critical: number; warning: number; triggered: number };
  };
}

interface AlertResult {
  rule: string;
  result: {
    triggered: boolean;
    message: string;
    details?: any;
    timestamp: string;
  };
  ruleDefinition: {
    name: string;
    description: string;
    severity: string;
    enabled: boolean;
  } | null;
}

export function MonitoringDashboard() {
  const { organization } = useOrganization();
  const [health, setHealth] = React.useState<HealthCheck | null>(null);
  const [alerts, setAlerts] = React.useState<AlertResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [organization?.id]);

  async function loadData() {
    try {
      // Load health check
      const healthResponse = await fetch('/api/health');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealth(healthData);
      }

      // Load alerts if organization is selected
      if (organization?.id) {
        const alertsResponse = await fetch(
          `/api/monitoring/alerts?organization_id=${organization.id}`
        );
        if (alertsResponse.ok) {
          const { data } = await alertsResponse.json();
          setAlerts(data.alerts);
        }
      }
    } catch (error) {
      console.error('Error loading monitoring data:', error);
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Healthy</Badge>;
      case 'warning':
        return <Badge variant="outline" className="gap-1 text-yellow-600"><AlertTriangle className="h-3 w-3" /> Warning</Badge>;
      case 'critical':
      case 'error':
      case 'degraded':
      case 'unhealthy':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Critical</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-yellow-600">Warning</Badge>;
      case 'info':
        return <Badge variant="secondary">Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  }

  const triggeredAlerts = alerts.filter((a) => a.result.triggered);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Header */}
      {health && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6" />
                <div>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>
                    Last updated {formatDistanceToNow(new Date(health.timestamp), { addSuffix: true })}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(health.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Database</div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(health.checks.database.status)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Sync Activity</div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(health.checks.syncActivity.status)}
                    <span className="text-xs text-muted-foreground">
                      {health.checks.syncActivity.recentSyncs} recent
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Queue</div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(health.checks.queue.status)}
                    <span className="text-xs text-muted-foreground">
                      {health.checks.queue.backlog} backlog
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Alerts</div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(health.checks.alerts.status)}
                    <span className="text-xs text-muted-foreground">
                      {health.checks.alerts.triggered} active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Response Time: <span className="font-medium">{health.responseTime}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      {triggeredAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Alerts ({triggeredAlerts.length})</AlertTitle>
          <AlertDescription>
            There are {triggeredAlerts.length} active alert(s) requiring attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Alert Details */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
          <CardDescription>
            Monitoring rules and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {organization ? 'No alerts configured' : 'Select an organization to view alerts'}
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.rule}
                  className={`rounded-lg border p-4 ${
                    alert.result.triggered ? 'border-destructive bg-destructive/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          {alert.ruleDefinition?.name || alert.rule}
                        </h4>
                        {alert.ruleDefinition && getSeverityBadge(alert.ruleDefinition.severity)}
                        {alert.result.triggered && (
                          <Badge variant="destructive">Triggered</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.ruleDefinition?.description}
                      </p>
                      <p className="text-sm">
                        {alert.result.message}
                      </p>
                      {alert.result.details && (
                        <details className="mt-2">
                          <summary className="text-sm text-muted-foreground cursor-pointer">
                            View details
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(alert.result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              System performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">API Response Time</div>
                <div className="text-2xl font-bold">{health.responseTime}</div>
                <p className="text-xs text-muted-foreground mt-1">Health check endpoint</p>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Queue Backlog</div>
                <div className="text-2xl font-bold">{health.checks.queue.backlog}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.checks.queue.pending} pending, {health.checks.queue.retrying} retrying
                </p>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Recent Activity</div>
                <div className="text-2xl font-bold">{health.checks.syncActivity.recentSyncs}</div>
                <p className="text-xs text-muted-foreground mt-1">Syncs in last 5 minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}







