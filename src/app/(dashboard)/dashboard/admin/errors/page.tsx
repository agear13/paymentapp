import { AdminOperationsNav } from '@/components/dashboard/admin/admin-operations-nav';
import { ErrorLogsViewer } from '@/components/dashboard/admin/error-logs-viewer';

export default function ErrorLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Error Logs</h1>
        <p className="text-muted-foreground">
          View and troubleshoot failed sync operations
        </p>
      </div>

      <AdminOperationsNav />

      <ErrorLogsViewer />
    </div>
  );
}







