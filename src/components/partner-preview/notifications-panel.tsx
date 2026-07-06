'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  notificationFeed,
  formatRelativeTime,
  type ActivityType,
} from '@/lib/data/mock-partner-preview';
import {
  Bell,
  CheckCircle2,
  DollarSign,
  Eye,
  RefreshCw,
  Upload,
  XCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function getNotificationIcon(type: ActivityType) {
  switch (type) {
    case 'invoice_paid':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'settlement_completed':
    case 'settlement_released':
      return <DollarSign className="h-4 w-4 text-green-500" />;
    case 'xero_synced':
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    case 'agreement_uploaded':
      return <Upload className="h-4 w-4 text-blue-500" />;
    case 'payment_failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'invoice_viewed':
      return <Eye className="h-4 w-4 text-muted-foreground" />;
    case 'reminder_sent':
      return <Bell className="h-4 w-4 text-amber-500" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  if (!open) return null;

  return (
    <aside
      className={cn(
        'hidden w-80 shrink-0 flex-col border-l bg-background xl:flex',
        'animate-in slide-in-from-right-4 duration-300'
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-semibold">Live Activity</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {notificationFeed.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'rounded-lg p-3 transition-colors hover:bg-muted/50',
                index === 0 && 'bg-primary/5'
              )}
            >
              <div className="flex gap-2">
                <div className="mt-0.5 shrink-0">{getNotificationIcon(item.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {item.businessName}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
