import { AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AccountingHealthStatus } from '@/lib/accounting/accounting-profile';

export function AccountingReadinessBadge({ status }: { status: AccountingHealthStatus }) {
  if (status === 'healthy') {
    return (
      <Badge className="gap-1 bg-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Ready for Xero
      </Badge>
    );
  }

  if (status === 'ready_with_recommendations') {
    return (
      <Badge variant="outline" className="gap-1">
        <TriangleAlert className="h-3 w-3" />
        Recommendation
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" />
      Needs Attention
    </Badge>
  );
}
