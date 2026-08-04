'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentLink } from '@/components/payment-links/payment-links-table';
import { useToast } from '@/hooks/use-toast';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  cancelPaymentLink,
  canCancelPaymentLink,
  canDeletePaymentLink,
  canEditPaymentLink,
  canMarkAsPaid,
  canResendPaymentLink,
  deletePaymentLink,
  downloadPaymentLinkQrCode,
  postPaymentLinkManualSettlement,
  resendPaymentLinkInvoice,
  sendPaymentLinkInvoice,
} from '@/lib/payment-links/payment-link-merchant-actions';
import { invoicePublicReference } from '@/lib/payment-links/invoice-display-status';
import { getPaymentLinkUrl } from '@/lib/runtime/customer-facing-url';
import { useCustomerFacingOrigin } from '@/components/operational/customer-facing-origin-provider';
import { isValidShortCode } from '@/lib/short-code';

export type InvoiceActionDialog = 'cancel' | 'delete' | 'markPaid' | 'send' | null;

export function useWorkspaceInvoiceActions(options: {
  onRefresh?: () => void | Promise<void>;
}) {
  const { onRefresh } = options;
  const router = useRouter();
  const { toast } = useToast();
  const { origin: customerFacingOrigin, configured: customerFacingConfigured, infrastructureOverride } =
    useCustomerFacingOrigin();

  const [activeLink, setActiveLink] = useState<PaymentLink | null>(null);
  const [dialog, setDialog] = useState<InvoiceActionDialog>(null);
  const [loading, setLoading] = useState(false);
  const [editLink, setEditLink] = useState<PaymentLink | null>(null);
  const [duplicateLink, setDuplicateLink] = useState<PaymentLink | null>(null);
  const [sendEmail, setSendEmail] = useState('');

  const refresh = useCallback(async () => {
    await onRefresh?.();
  }, [onRefresh]);

  const buildPaymentUrl = useCallback(
    (shortCode: string) => {
      try {
        return getPaymentLinkUrl(shortCode, {
          origin: customerFacingConfigured ? customerFacingOrigin : undefined,
          runtimeOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
          infrastructureOverride: infrastructureOverride || undefined,
        });
      } catch {
        return '';
      }
    },
    [customerFacingConfigured, customerFacingOrigin, infrastructureOverride]
  );

  const openInvoice = useCallback(
    (link: PaymentLink) => {
      router.push(
        COMMERCIAL_OS_ROUTES.invoiceDetail(invoicePublicReference(link), { id: link.id })
      );
    },
    [router]
  );

  const copyPaymentLink = useCallback(
    async (link: PaymentLink) => {
      const code = link.shortCode?.trim() ?? '';
      if (!isValidShortCode(code)) {
        toast({
          title: 'Link unavailable',
          description: 'This invoice does not have a valid pay code.',
          variant: 'destructive',
        });
        return;
      }
      const url = buildPaymentUrl(code);
      if (!url) {
        toast({
          title: 'Customer link unavailable',
          description: 'Customer-facing domain is not configured correctly.',
          variant: 'destructive',
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Payment link copied' });
      } catch {
        toast({ title: 'Could not copy', variant: 'destructive' });
      }
    },
    [buildPaymentUrl, toast]
  );

  const openPaymentLink = useCallback(
    (link: PaymentLink) => {
      const code = link.shortCode?.trim() ?? '';
      if (!isValidShortCode(code)) {
        toast({
          title: 'Link unavailable',
          description: 'This invoice does not have a valid pay code.',
          variant: 'destructive',
        });
        return;
      }
      const url = buildPaymentUrl(code);
      if (!url) {
        toast({
          title: 'Customer link unavailable',
          variant: 'destructive',
        });
        return;
      }
      window.open(url, '_blank');
    },
    [buildPaymentUrl, toast]
  );

  const downloadQr = useCallback(
    async (link: PaymentLink) => {
      const code = link.shortCode?.trim() ?? '';
      if (!isValidShortCode(code)) {
        toast({
          title: 'QR unavailable',
          description: 'This invoice does not have a valid pay code.',
          variant: 'destructive',
        });
        return;
      }
      try {
        await downloadPaymentLinkQrCode(link.id, code);
        toast({ title: 'QR code downloaded' });
      } catch (error: unknown) {
        toast({
          title: 'Download failed',
          description: error instanceof Error ? error.message : 'Could not download QR code',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const startEdit = useCallback((link: PaymentLink) => setEditLink(link), []);
  const startDuplicate = useCallback((link: PaymentLink) => setDuplicateLink(link), []);

  const startSend = useCallback((link: PaymentLink) => {
    setActiveLink(link);
    setSendEmail(link.customerEmail?.trim() || '');
    setDialog('send');
  }, []);

  const startMarkPaid = useCallback((link: PaymentLink) => {
    setActiveLink(link);
    setDialog('markPaid');
  }, []);

  const startCancel = useCallback((link: PaymentLink) => {
    setActiveLink(link);
    setDialog('cancel');
  }, []);

  const startDelete = useCallback((link: PaymentLink) => {
    setActiveLink(link);
    setDialog('delete');
  }, []);

  const confirmSend = useCallback(async () => {
    if (!activeLink) return;
    const email = sendEmail.trim();
    if (!email) {
      toast({
        title: 'Could not send invoice',
        description: 'Enter a client email first.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      await sendPaymentLinkInvoice(activeLink.id, email);
      toast({ title: 'Invoice sent', description: `Invoice sent to ${email}.` });
      setDialog(null);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not send invoice',
        description: error instanceof Error ? error.message : 'Send failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeLink, sendEmail, toast, refresh]);

  const resendInvoice = useCallback(
    async (link: PaymentLink) => {
      setLoading(true);
      try {
        await resendPaymentLinkInvoice(link.id);
        toast({ title: 'Invoice resent' });
        await refresh();
      } catch (error: unknown) {
        toast({
          title: 'Could not resend invoice',
          description: error instanceof Error ? error.message : 'Resend failed',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast, refresh]
  );

  const confirmMarkPaid = useCallback(async () => {
    if (!activeLink) return;
    setLoading(true);
    try {
      await postPaymentLinkManualSettlement(activeLink.id, 'mark_paid');
      toast({ title: 'Payment recorded' });
      setDialog(null);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not mark as paid',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeLink, toast, refresh]);

  const confirmCancel = useCallback(async () => {
    if (!activeLink) return;
    setLoading(true);
    try {
      await cancelPaymentLink(activeLink.id);
      toast({ title: 'Invoice canceled' });
      setDialog(null);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not cancel invoice',
        description: error instanceof Error ? error.message : 'Cancel failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeLink, toast, refresh]);

  const confirmDelete = useCallback(async () => {
    if (!activeLink) return;
    setLoading(true);
    try {
      await deletePaymentLink(activeLink.id);
      toast({ title: 'Invoice deleted' });
      setDialog(null);
      await refresh();
    } catch (error: unknown) {
      toast({
        title: 'Could not delete invoice',
        description: error instanceof Error ? error.message : 'Delete failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeLink, toast, refresh]);

  const createRecurringHref = useCallback((link: PaymentLink) => {
    const params = new URLSearchParams();
    if (link.amount) params.set('amount', String(link.amount));
    if (link.currency) params.set('currency', link.currency);
    if (link.description) params.set('description', link.description);
    if (link.customerEmail) params.set('customerEmail', link.customerEmail);
    const query = params.toString();
    return query ? `/dashboard/recurring-templates?${query}` : '/dashboard/recurring-templates';
  }, []);

  const actionAvailability = useCallback(
    (link: PaymentLink) => ({
      canEdit: canEditPaymentLink(link.status),
      canSend: canResendPaymentLink(link.status),
      canMarkPaid: canMarkAsPaid(link.status),
      canCancel: canCancelPaymentLink(link.status),
      canDelete: canDeletePaymentLink(link.status),
    }),
    []
  );

  return {
    activeLink,
    dialog,
    setDialog,
    loading,
    sendEmail,
    setSendEmail,
    editLink,
    setEditLink,
    duplicateLink,
    setDuplicateLink,
    openInvoice,
    copyPaymentLink,
    openPaymentLink,
    downloadQr,
    startEdit,
    startDuplicate,
    startSend,
    startMarkPaid,
    startCancel,
    startDelete,
    confirmSend,
    resendInvoice,
    confirmMarkPaid,
    confirmCancel,
    confirmDelete,
    createRecurringHref,
    actionAvailability,
    refresh,
  };
}
