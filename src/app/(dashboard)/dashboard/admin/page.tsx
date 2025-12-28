import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminOperationsNav } from '@/components/dashboard/admin/admin-operations-nav';

export default function AdminOperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Operations</h1>
        <p className="text-muted-foreground">
          Monitor and manage system operations, sync queue, and troubleshoot issues.
        </p>
      </div>

      <AdminOperationsNav />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sync Queue</CardTitle>
            <CardDescription>
              Monitor and manage Xero sync jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View pending, successful, and failed sync operations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Logs</CardTitle>
            <CardDescription>
              View and filter error logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Troubleshoot failed operations and view detailed error messages.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>
              Monitor system status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Check sync success rates, queue backlog, and system health.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}







