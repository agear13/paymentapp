import { AdminOperationsNav } from '@/components/dashboard/admin/admin-operations-nav';
import { SyncQueueDashboard } from '@/components/dashboard/admin/sync-queue-dashboard';

export default function SyncQueuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sync Queue</h1>
        <p className="text-muted-foreground">
          Monitor and manage Xero sync operations
        </p>
      </div>

      <AdminOperationsNav />

      <SyncQueueDashboard />
    </div>
  );
}







