import { AdminOperationsNav } from '@/components/dashboard/admin/admin-operations-nav';
import { OrphanDetection } from '@/components/dashboard/admin/orphan-detection';

export default function OrphanDetectionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orphan Detection</h1>
        <p className="text-muted-foreground">
          Detect and resolve payment links with incomplete sync operations
        </p>
      </div>

      <AdminOperationsNav />

      <OrphanDetection />
    </div>
  );
}







