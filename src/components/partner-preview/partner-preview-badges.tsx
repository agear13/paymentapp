import { Badge } from '@/components/ui/badge';
import type {
  AccountingConnectionStatus,
  AccountingPlatformType,
  AttentionSeverity,
  RecommendationCategory,
} from '@/lib/data/mock-partner-preview';

export function AccountingPlatformBadge({
  platform,
  status,
}: {
  platform: AccountingPlatformType;
  status: AccountingConnectionStatus;
}) {
  const statusVariant =
    status === 'Connected'
      ? 'default'
      : status === 'Expired' || status === 'Missing'
        ? 'destructive'
        : 'secondary';

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className="w-fit text-xs">
        {platform === 'None' ? 'No platform' : platform}
      </Badge>
      <Badge variant={statusVariant} className="w-fit text-[10px]">
        {status}
      </Badge>
    </div>
  );
}

export function AttentionSeverityBadge({ severity }: { severity: AttentionSeverity }) {
  const className =
    severity === 'Critical'
      ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300'
      : severity === 'High'
        ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/50 dark:text-red-400'
        : severity === 'Medium'
          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
          : 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300';

  return (
    <Badge variant="outline" className={className}>
      {severity}
    </Badge>
  );
}

export function RecommendationCategoryBadge({
  category,
}: {
  category: RecommendationCategory;
}) {
  const className =
    category === 'Revenue'
      ? 'bg-green-50 text-green-700 border-green-200'
      : category === 'Automation'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : category === 'Marketing'
          ? 'bg-purple-50 text-purple-700 border-purple-200'
          : category === 'Accounting'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-red-50 text-red-700 border-red-200';

  return (
    <Badge variant="outline" className={className}>
      {category}
    </Badge>
  );
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function getPaymentStatusVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'Active':
      return 'default';
    case 'Attention Needed':
      return 'secondary';
    case 'Setup Incomplete':
      return 'destructive';
    default:
      return 'outline';
  }
}
