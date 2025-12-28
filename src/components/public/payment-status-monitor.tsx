/**
 * Payment Status Monitor Component
 * Displays real-time payment status with animations and transitions
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Loader2,
  CreditCard,
  Wallet,
  RefreshCw
} from 'lucide-react';
import { usePaymentStatusPolling } from '@/hooks/use-payment-status-polling';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PaymentStatusMonitorProps {
  paymentLinkId: string;
  shortCode: string;
  initialStatus?: 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  onStatusChange?: (status: string) => void;
}

const statusConfig = {
  OPEN: {
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Awaiting Payment',
  },
  PAID: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Payment Successful',
  },
  EXPIRED: {
    icon: XCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Payment Link Expired',
  },
  CANCELED: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Payment Canceled',
  },
};

export const PaymentStatusMonitor: React.FC<PaymentStatusMonitorProps> = ({
  paymentLinkId,
  shortCode,
  initialStatus,
  onStatusChange,
}) => {
  const router = useRouter();
  const [showMonitor, setShowMonitor] = useState(false);
  const [hasShownSuccess, setHasShownSuccess] = useState(false);

  const {
    status,
    isLoading,
    error,
    hasTimedOut,
    isPolling,
    refetch,
  } = usePaymentStatusPolling({
    paymentLinkId,
    enabled: !hasShownSuccess,
    onStatusChange: (newStatus) => {
      onStatusChange?.(newStatus.currentStatus);

      // Redirect on final states
      if (newStatus.currentStatus === 'PAID' && !hasShownSuccess) {
        setHasShownSuccess(true);
        setTimeout(() => {
          router.push(`/pay/${shortCode}/success`);
        }, 2000);
      } else if (newStatus.currentStatus === 'EXPIRED') {
        setTimeout(() => {
          router.push(`/pay/${shortCode}/expired`);
        }, 2000);
      } else if (newStatus.currentStatus === 'CANCELED') {
        setTimeout(() => {
          router.push(`/pay/${shortCode}/canceled`);
        }, 2000);
      }
    },
    onTimeout: () => {
      // Redirect to expired page on timeout
      setTimeout(() => {
        router.push(`/pay/${shortCode}/expired`);
      }, 3000);
    },
  });

  // Show monitor when payment is being processed
  useEffect(() => {
    if (status && (status.currentStatus !== 'OPEN' || status.lastEventType !== null)) {
      setShowMonitor(true);
    }
  }, [status]);

  if (!showMonitor && !isLoading) {
    return null;
  }

  const currentConfig = status?.currentStatus 
    ? statusConfig[status.currentStatus as keyof typeof statusConfig]
    : null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className={`shadow-lg border-2 ${currentConfig?.borderColor || 'border-slate-200'}`}>
          <CardContent className="p-4">
            {/* Status Display */}
            {status && currentConfig && (
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${currentConfig.bgColor}`}>
                  {isPolling ? (
                    <Loader2 className={`w-5 h-5 ${currentConfig.color} animate-spin`} />
                  ) : (
                    <currentConfig.icon className={`w-5 h-5 ${currentConfig.color}`} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {currentConfig.label}
                    </h4>
                    {isPolling && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-1">
                    {status.statusMessage}
                  </p>

                  {/* Transaction Info */}
                  {status.transactionInfo && (
                    <div className="mt-3 pt-3 border-t border-slate-200 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        {status.transactionInfo.paymentMethod === 'STRIPE' ? (
                          <CreditCard className="w-3.5 h-3.5" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5" />
                        )}
                        <span className="font-mono truncate">
                          {status.transactionInfo.transactionId.slice(0, 20)}...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last Update Time */}
                  {status.lastEventTimestamp && (
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(status.lastEventTimestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && !status && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-sm text-slate-600">Checking payment status...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {error.message}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refetch}
                    className="ml-2 h-6 px-2"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Timeout Alert */}
            {hasTimedOut && (
              <Alert className="mt-3">
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Payment timeout. Redirecting to expired page...
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
  );
};






