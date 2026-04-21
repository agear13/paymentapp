/**
 * Create Payment Link Dialog
 * Form for creating new payment links with validation
 */

'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, FileText, Loader2, Paperclip, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CurrencySelect } from './currency-select';
import { cn } from '@/lib/utils';
import {
  computePaymentLinkRailSetup,
  pickAlternativePaymentMethod,
  toPaymentLinkRailSnapshot,
  type PaymentLinkRailSetupStatus,
} from '@/lib/payment-links/setup-status';
import { PaymentLinksGuardrailModal } from '@/components/payment-links-onboarding/payment-links-guardrail-modal';
import type { PaymentLinksGuardrailKind } from '@/components/payment-links-onboarding/payment-links-guardrail-modal';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  PAYMENT_LINK_ATTACHMENT_MAX_BYTES,
  isAllowedPaymentLinkAttachmentMime,
} from '@/lib/payment-links/payment-link-attachment';

interface PaymentMethodOption {
  value: 'STRIPE' | 'HEDERA' | 'WISE' | 'CRYPTO' | 'MANUAL_BANK';
  label: string;
  available: boolean;
  unavailableReason?: string;
}

interface MerchantSettings {
  stripeAccountId?: string;
  hederaAccountId?: string;
  wiseEnabled?: boolean;
  wiseProfileId?: string;
}

// Form validation schema - SMB-friendly (customer contact details optional)
const createPaymentLinkFormSchema = z
  .object({
  collectionMode: z.enum(['payment_request', 'invoice_only']),
  paymentMethod: z.enum(['STRIPE', 'HEDERA', 'WISE', 'CRYPTO', 'MANUAL_BANK']).optional(),
  hederaCheckoutMode: z.enum(['INTERACTIVE', 'MANUAL']).optional(),
  cryptoNetwork: z.string().optional(),
  cryptoAddress: z.string().optional(),
  cryptoCurrency: z.string().optional(),
  cryptoMemo: z.string().optional(),
  cryptoInstructions: z.string().optional(),
  manualBankRecipientName: z.string().optional(),
  manualBankCurrency: z.string().optional(),
  manualBankDestinationType: z.string().optional(),
  manualBankBankName: z.string().optional(),
  manualBankAccountNumber: z.string().optional(),
  manualBankIban: z.string().optional(),
  manualBankSwiftBic: z.string().optional(),
  manualBankRoutingSortCode: z.string().optional(),
  manualBankWiseReference: z.string().optional(),
  manualBankRevolutHandle: z.string().optional(),
  manualBankInstructions: z.string().optional(),
  amount: z.coerce
    .number({
      invalid_type_error: 'Enter an amount to invoice.',
    })
    .positive('Amount must be greater than zero.')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places.'),
  currency: z.string().min(1, 'Select a currency.').length(3, 'Select a currency.'),
  description: z
    .string()
    .min(1, 'Add a short description so your customer knows what this invoice is for.')
    .max(200, 'Description must not exceed 200 characters.'),
  invoiceReference: z
    .string()
    .max(255, 'Invoice reference must not exceed 255 characters.')
    .transform((val) => val?.trim() || '')
    .optional(),
  customerEmail: z
    .string()
    .transform((val) => val?.trim() || '')
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Enter a valid email address.'
    )
    .optional(),
  customerName: z
    .string()
    .max(255, 'Customer name must not exceed 255 characters.')
    .transform((val) => val?.trim() || '')
    .optional(),
  customerPhone: z
    .string()
    .transform((val) => val?.trim() || '')
    .refine(
      (val) => !val || /^\+?[1-9]\d{1,14}$/.test(val),
      'Enter a valid phone number in international format (e.g., +61412345678).'
    )
    .optional(),
  invoiceDate: z.date().optional(),
  dueDate: z.date().optional(),
  expiresAt: z.date().optional(),
  attachment: z
    .object({
      storageKey: z.string().min(1),
      bucket: z.string().min(1),
      filename: z.string().min(1),
      mimeType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']),
      sizeBytes: z.number().int().positive(),
    })
    .optional(),
})
  .refine(
    (d) => {
      if (d.collectionMode === 'invoice_only') return true;
      return d.paymentMethod != null;
    },
    { message: 'Select a payment method', path: ['paymentMethod'] }
  )
  .refine(
    (d) => {
      if (d.collectionMode === 'invoice_only') return true;
      if (d.paymentMethod !== 'HEDERA') return true;
      return d.hederaCheckoutMode === 'INTERACTIVE' || d.hederaCheckoutMode === 'MANUAL';
    },
    { message: 'Select crypto checkout style', path: ['hederaCheckoutMode'] }
  )
  .refine(
    (d) => {
      if (d.collectionMode === 'invoice_only' || d.paymentMethod !== 'CRYPTO') return true;
      return (
        !!d.cryptoNetwork?.trim() &&
        !!d.cryptoAddress?.trim() &&
        !!d.cryptoCurrency?.trim()
      );
    },
    {
      message: 'Network, wallet address, and asset are required for crypto payment requests',
      path: ['cryptoNetwork'],
    }
  )
  .refine(
    (d) => {
      if (d.collectionMode === 'invoice_only' || d.paymentMethod !== 'MANUAL_BANK') return true;
      return (
        !!d.manualBankRecipientName?.trim() &&
        !!d.manualBankCurrency?.trim() &&
        !!d.manualBankDestinationType?.trim()
      );
    },
    {
      message: 'Recipient name, destination type, and payment currency are required for manual bank transfer',
      path: ['manualBankRecipientName'],
    }
  );

type CreatePaymentLinkFormValues = z.infer<typeof createPaymentLinkFormSchema>;

/** Values needed to prefill edit mode (same record as list/detail API). */
export interface EditPaymentLinkSeed {
  id: string;
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoiceDate: Date | string | null;
  dueDate: Date | string | null;
  expiresAt: Date | string | null;
  invoiceOnlyMode?: boolean;
  paymentMethod?: string | null;
  hederaCheckoutMode?: string | null;
  wiseTransferId?: string | null;
  cryptoNetwork?: string | null;
  cryptoAddress?: string | null;
  cryptoCurrency?: string | null;
  cryptoMemo?: string | null;
  cryptoInstructions?: string | null;
  manualBankRecipientName?: string | null;
  manualBankCurrency?: string | null;
  manualBankDestinationType?: string | null;
  manualBankBankName?: string | null;
  manualBankAccountNumber?: string | null;
  manualBankIban?: string | null;
  manualBankSwiftBic?: string | null;
  manualBankRoutingSortCode?: string | null;
  manualBankWiseReference?: string | null;
  manualBankRevolutHandle?: string | null;
  manualBankInstructions?: string | null;
  attachmentUrl?: string | null;
  attachmentStorageKey?: string | null;
  attachmentBucket?: string | null;
  attachmentFilename?: string | null;
  attachmentMimeType?: string | null;
  attachmentSizeBytes?: number | null;
}

export type PaymentLinkAttachmentDraft = {
  storageKey: string;
  bucket: string;
  filename: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/jpg' | 'application/pdf';
  sizeBytes: number;
};

export interface CreatePaymentLinkDialogProps {
  organizationId: string;
  defaultCurrency?: string;
  defaultValues?: Partial<CreatePaymentLinkFormValues>;
  /** Deal Network Strait: stored on payment_links.pilot_deal_id when creating from a project. */
  pilotDealId?: string | null;
  onSuccess?: (paymentLink: any) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: 'create' | 'edit';
  editPaymentLink?: EditPaymentLinkSeed | null;
}

export const CreatePaymentLinkDialog: React.FC<CreatePaymentLinkDialogProps> = ({
  organizationId,
  defaultCurrency = 'USD',
  defaultValues,
  pilotDealId = null,
  onSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  mode = 'create',
  editPaymentLink = null,
}) => {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [descriptionLength, setDescriptionLength] = React.useState(0);
  const [merchantSettings, setMerchantSettings] = React.useState<MerchantSettings | null>(null);
  const [merchantSettingsLoaded, setMerchantSettingsLoaded] = React.useState(false);
  const [guardrail, setGuardrail] = React.useState<{
    kind: PaymentLinksGuardrailKind;
    setup: PaymentLinkRailSetupStatus;
  } | null>(null);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const isOpenControlled = controlledOpen !== undefined;
  const showTrigger = !isOpenControlled || trigger != null;
  const wiseTransferLocked =
    mode === 'edit' && Boolean(editPaymentLink?.wiseTransferId);

  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);
  const [attachmentUploading, setAttachmentUploading] = React.useState(false);
  const initialAttachmentRef = React.useRef<PaymentLinkAttachmentDraft | null>(null);
  const wasOpenRef = React.useRef(false);

  // Fetch merchant settings when dialog opens
  React.useEffect(() => {
    async function fetchMerchantSettings() {
      if (!organizationId || !open) return;
      setMerchantSettingsLoaded(false);
      try {
        const response = await fetch(`/api/merchant-settings?organizationId=${organizationId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const settings = data[0];
            setMerchantSettings({
              stripeAccountId: settings.stripe_account_id,
              hederaAccountId: settings.hedera_account_id,
              wiseEnabled: settings.wise_enabled,
              wiseProfileId: settings.wise_profile_id,
            });
          } else {
            setMerchantSettings(null);
          }
        } else {
          setMerchantSettings(null);
        }
      } catch (error) {
        console.error('Failed to fetch merchant settings:', error);
        setMerchantSettings(null);
      } finally {
        setMerchantSettingsLoaded(true);
      }
    }

    fetchMerchantSettings();
  }, [organizationId, open]);

  React.useEffect(() => {
    if (!open) setGuardrail(null);
  }, [open]);

  const railSetup = React.useMemo(
    () => computePaymentLinkRailSetup(toPaymentLinkRailSnapshot(merchantSettings)),
    [merchantSettings]
  );

  // Compute available payment methods — Wise availability follows shared rail setup only
  const paymentMethodOptions = React.useMemo((): PaymentMethodOption[] => {
    return [
      {
        value: 'STRIPE',
        label: 'Credit / Debit card (Stripe)',
        available: true,
      },
      {
        value: 'HEDERA',
        label: 'Crypto (Hashpack)',
        available: true,
      },
      {
        value: 'WISE',
        label: 'Bank transfer (Wise)',
        available: railSetup.wiseConfigured,
        unavailableReason: !merchantSettings?.wiseEnabled
          ? 'Wise payments not enabled'
          : railSetup.wiseIncomplete
            ? 'Wise Profile ID not configured'
            : !railSetup.wiseConfigured
              ? 'Wise not fully configured'
              : undefined,
      },
      {
        value: 'CRYPTO',
        label: 'Crypto (any wallet — manual instructions)',
        available: true,
      },
      {
        value: 'MANUAL_BANK',
        label: 'Manual bank transfer (bank / Wise / Revolut / other)',
        available: true,
      },
    ];
  }, [merchantSettings?.wiseEnabled, railSetup.wiseConfigured, railSetup.wiseIncomplete]);

  const form = useForm<CreatePaymentLinkFormValues>({
    resolver: zodResolver(createPaymentLinkFormSchema),
    defaultValues: {
      collectionMode: 'payment_request',
      paymentMethod: 'STRIPE',
      hederaCheckoutMode: 'INTERACTIVE',
      cryptoNetwork: '',
      cryptoAddress: '',
      cryptoCurrency: '',
      cryptoMemo: '',
      cryptoInstructions: '',
      manualBankRecipientName: '',
      manualBankCurrency: '',
      manualBankDestinationType: '',
      manualBankBankName: '',
      manualBankAccountNumber: '',
      manualBankIban: '',
      manualBankSwiftBic: '',
      manualBankRoutingSortCode: '',
      manualBankWiseReference: '',
      manualBankRevolutHandle: '',
      manualBankInstructions: '',
      amount: undefined,
      currency: defaultCurrency,
      description: '',
      invoiceReference: '',
      customerEmail: '',
      customerName: '',
      customerPhone: '',
      invoiceDate: new Date(),
      dueDate: undefined,
      expiresAt: undefined,
      attachment: undefined,
      ...defaultValues,
    },
  });

  const collectionMode = form.watch('collectionMode');
  const invoiceAttachment = form.watch('attachment');

  React.useEffect(() => {
    if (collectionMode === 'invoice_only') {
      form.clearErrors('paymentMethod');
      form.clearErrors('hederaCheckoutMode');
      form.clearErrors('cryptoNetwork');
      form.clearErrors('manualBankRecipientName');
      form.setValue('paymentMethod', undefined);
    } else if (collectionMode === 'payment_request') {
      const pm = form.getValues('paymentMethod');
      if (!pm) {
        form.setValue('paymentMethod', 'STRIPE');
      }
    }
  }, [collectionMode, form]);

  // Initialize form only when dialog opens (avoid wiping in-progress edits/attachment while user is typing).
  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || !justOpened) return;

    if (mode === 'edit' && editPaymentLink) {
      const due = editPaymentLink.dueDate ? new Date(editPaymentLink.dueDate) : undefined;
      const exp = editPaymentLink.expiresAt ? new Date(editPaymentLink.expiresAt) : undefined;
      const invDate = editPaymentLink.invoiceDate
        ? new Date(editPaymentLink.invoiceDate)
        : new Date();
      const invoiceOnly = Boolean(editPaymentLink.invoiceOnlyMode);
      const initialAttachment =
        editPaymentLink.attachmentStorageKey &&
        editPaymentLink.attachmentFilename &&
        editPaymentLink.attachmentMimeType &&
        isAllowedPaymentLinkAttachmentMime(editPaymentLink.attachmentMimeType) &&
        editPaymentLink.attachmentSizeBytes != null
          ? {
              storageKey: editPaymentLink.attachmentStorageKey,
              bucket: editPaymentLink.attachmentBucket || 'payment-link-attachments',
              filename: editPaymentLink.attachmentFilename,
              mimeType: editPaymentLink.attachmentMimeType,
              sizeBytes: editPaymentLink.attachmentSizeBytes,
            }
          : undefined;
      form.reset({
        collectionMode: invoiceOnly ? 'invoice_only' : 'payment_request',
        paymentMethod: invoiceOnly
          ? undefined
          : ((editPaymentLink.paymentMethod as 'STRIPE' | 'HEDERA' | 'WISE' | 'CRYPTO' | 'MANUAL_BANK') || 'STRIPE'),
        hederaCheckoutMode:
          (editPaymentLink.hederaCheckoutMode as 'INTERACTIVE' | 'MANUAL') || 'INTERACTIVE',
        cryptoNetwork: editPaymentLink.cryptoNetwork ?? '',
        cryptoAddress: editPaymentLink.cryptoAddress ?? '',
        cryptoCurrency: editPaymentLink.cryptoCurrency ?? '',
        cryptoMemo: editPaymentLink.cryptoMemo ?? '',
        cryptoInstructions: editPaymentLink.cryptoInstructions ?? '',
        manualBankRecipientName: editPaymentLink.manualBankRecipientName ?? '',
        manualBankCurrency: editPaymentLink.manualBankCurrency ?? '',
        manualBankDestinationType: editPaymentLink.manualBankDestinationType ?? '',
        manualBankBankName: editPaymentLink.manualBankBankName ?? '',
        manualBankAccountNumber: editPaymentLink.manualBankAccountNumber ?? '',
        manualBankIban: editPaymentLink.manualBankIban ?? '',
        manualBankSwiftBic: editPaymentLink.manualBankSwiftBic ?? '',
        manualBankRoutingSortCode: editPaymentLink.manualBankRoutingSortCode ?? '',
        manualBankWiseReference: editPaymentLink.manualBankWiseReference ?? '',
        manualBankRevolutHandle: editPaymentLink.manualBankRevolutHandle ?? '',
        manualBankInstructions: editPaymentLink.manualBankInstructions ?? '',
        amount: editPaymentLink.amount,
        currency: editPaymentLink.currency,
        description: editPaymentLink.description,
        invoiceReference: editPaymentLink.invoiceReference || '',
        customerEmail: editPaymentLink.customerEmail || '',
        customerName: editPaymentLink.customerName || '',
        customerPhone: editPaymentLink.customerPhone || '',
        invoiceDate: !Number.isNaN(invDate.getTime()) ? invDate : new Date(),
        dueDate: due && !Number.isNaN(due.getTime()) ? due : undefined,
        expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp : undefined,
        attachment: initialAttachment,
      });
      initialAttachmentRef.current = initialAttachment ?? null;
      setDescriptionLength(editPaymentLink.description?.length || 0);
      return;
    }

    form.reset({
      collectionMode: 'payment_request',
      paymentMethod: 'STRIPE',
      hederaCheckoutMode: 'INTERACTIVE',
      cryptoNetwork: '',
      cryptoAddress: '',
      cryptoCurrency: '',
      cryptoMemo: '',
      cryptoInstructions: '',
      manualBankRecipientName: '',
      manualBankCurrency: '',
      manualBankDestinationType: '',
      manualBankBankName: '',
      manualBankAccountNumber: '',
      manualBankIban: '',
      manualBankSwiftBic: '',
      manualBankRoutingSortCode: '',
      manualBankWiseReference: '',
      manualBankRevolutHandle: '',
      manualBankInstructions: '',
      amount: undefined,
      currency: defaultCurrency,
      description: '',
      invoiceReference: '',
      customerEmail: '',
      customerName: '',
      customerPhone: '',
      invoiceDate: new Date(),
      dueDate: undefined,
      expiresAt: undefined,
      attachment: undefined,
      ...defaultValues,
    });
    initialAttachmentRef.current = null;
    setDescriptionLength(defaultValues?.description?.length || 0);
  }, [open, mode, editPaymentLink, defaultValues, defaultCurrency, form]);

  const validateAttachmentFileClient = (file: File): string | null => {
    if (!isAllowedPaymentLinkAttachmentMime(file.type)) {
      return 'Use a PNG, JPG, JPEG, or PDF file.';
    }
    if (file.size > PAYMENT_LINK_ATTACHMENT_MAX_BYTES) {
      return `File is too large. Maximum size is ${PAYMENT_LINK_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB.`;
    }
    return null;
  };

  const handleInvoiceAttachmentInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (attachmentFileInputRef.current) attachmentFileInputRef.current.value = '';
    if (!file) return;

    const err = validateAttachmentFileClient(file);
    if (err) {
      toast({ title: 'Invalid file', description: err, variant: 'destructive' });
      return;
    }

    setAttachmentUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('organizationId', organizationId);
      if (mode === 'edit' && editPaymentLink?.id) {
        fd.append('paymentLinkId', editPaymentLink.id);
      }

      const res = await fetch('/api/payment-links/upload-attachment', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Upload failed');
      }
      const a = json.attachment;
      if (!a?.storageKey || !a?.bucket || !a.filename || !a.mimeType || a.sizeBytes == null) {
        throw new Error('Invalid upload response');
      }
      if (!isAllowedPaymentLinkAttachmentMime(a.mimeType)) {
        throw new Error('Invalid file type from server');
      }
      form.setValue('attachment', {
        storageKey: a.storageKey,
        bucket: a.bucket,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      }, { shouldDirty: true, shouldTouch: true });
      toast({
        title: 'Attachment ready',
        description:
          mode === 'edit'
            ? 'Save the invoice to apply this attachment to the public link.'
            : 'Create the invoice to attach this file to the public link.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setAttachmentUploading(false);
    }
  };

  const clearInvoiceAttachment = () => {
    form.setValue('attachment', undefined, { shouldDirty: true, shouldTouch: true });
  };

  const performUpdate = async (data: CreatePaymentLinkFormValues) => {
    if (!editPaymentLink) return;
    const invoiceOnly = data.collectionMode === 'invoice_only';
    const effectivePaymentMethod = invoiceOnly ? undefined : data.paymentMethod;

    setIsSubmitting(true);
    form.clearErrors('root');

    try {
      const currentAttachment = data.attachment ?? null;
      const initialAttachment = initialAttachmentRef.current;
      const attachmentChanged =
        JSON.stringify(currentAttachment) !== JSON.stringify(initialAttachment);
      const attachmentPayload = attachmentChanged
        ? currentAttachment
          ? { attachment: currentAttachment }
          : { attachment: null as null }
        : {};

      const response = await fetch(`/api/payment-links/${editPaymentLink.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          invoiceReference: data.invoiceReference || null,
          customerEmail: data.customerEmail || null,
          customerName: data.customerName || null,
          customerPhone: data.customerPhone || null,
          invoiceDate: data.invoiceDate?.toISOString() ?? null,
          dueDate: data.dueDate?.toISOString() ?? null,
          expiresAt: data.expiresAt?.toISOString() ?? null,
          invoiceOnlyMode: invoiceOnly,
          ...attachmentPayload,
          ...(invoiceOnly
            ? {
                paymentMethod: null,
                hederaCheckoutMode: null,
                cryptoNetwork: null,
                cryptoAddress: null,
                cryptoCurrency: null,
                cryptoMemo: null,
                cryptoInstructions: null,
              }
            : {
                paymentMethod: effectivePaymentMethod,
                ...(data.paymentMethod === 'HEDERA'
                  ? { hederaCheckoutMode: data.hederaCheckoutMode }
                  : { hederaCheckoutMode: null }),
                ...(data.paymentMethod === 'CRYPTO'
                  ? {
                      cryptoNetwork: data.cryptoNetwork?.trim(),
                      cryptoAddress: data.cryptoAddress?.trim(),
                      cryptoCurrency: data.cryptoCurrency?.trim(),
                      cryptoMemo: data.cryptoMemo?.trim() || null,
                      cryptoInstructions: data.cryptoInstructions?.trim() || null,
                    }
                  : {
                      cryptoNetwork: null,
                      cryptoAddress: null,
                      cryptoCurrency: null,
                      cryptoMemo: null,
                      cryptoInstructions: null,
                    }),
                ...(data.paymentMethod === 'MANUAL_BANK'
                  ? {
                      manualBankRecipientName: data.manualBankRecipientName?.trim(),
                      manualBankCurrency: data.manualBankCurrency?.trim(),
                      manualBankDestinationType: data.manualBankDestinationType?.trim(),
                      manualBankBankName: data.manualBankBankName?.trim() || null,
                      manualBankAccountNumber: data.manualBankAccountNumber?.trim() || null,
                      manualBankIban: data.manualBankIban?.trim() || null,
                      manualBankSwiftBic: data.manualBankSwiftBic?.trim() || null,
                      manualBankRoutingSortCode: data.manualBankRoutingSortCode?.trim() || null,
                      manualBankWiseReference: data.manualBankWiseReference?.trim() || null,
                      manualBankRevolutHandle: data.manualBankRevolutHandle?.trim() || null,
                      manualBankInstructions: data.manualBankInstructions?.trim() || null,
                    }
                  : {
                      manualBankRecipientName: null,
                      manualBankCurrency: null,
                      manualBankDestinationType: null,
                      manualBankBankName: null,
                      manualBankAccountNumber: null,
                      manualBankIban: null,
                      manualBankSwiftBic: null,
                      manualBankRoutingSortCode: null,
                      manualBankWiseReference: null,
                      manualBankRevolutHandle: null,
                      manualBankInstructions: null,
                    }),
              }),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update invoice. Please try again.');
      }

      const result = await response.json();

      toast({
        title: 'Invoice updated',
        description:
          'Your changes were saved. The same pay link URL still works for this invoice.',
      });
      initialAttachmentRef.current = data.attachment ?? null;
      setOpen(false);

      if (onSuccess) {
        onSuccess(result.data);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update invoice. Please try again.';
      form.setError('root', {
        type: 'manual',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const performCreate = async (data: CreatePaymentLinkFormValues) => {
    const invoiceOnly = data.collectionMode === 'invoice_only';
    const effectivePaymentMethod = invoiceOnly ? undefined : data.paymentMethod;

    setIsSubmitting(true);
    form.clearErrors('root');

    try {
      const response = await fetch('/api/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          invoiceReference: data.invoiceReference || undefined,
          customerEmail: data.customerEmail || undefined,
          customerName: data.customerName || undefined,
          customerPhone: data.customerPhone || undefined,
          invoiceDate: data.invoiceDate?.toISOString(),
          dueDate: data.dueDate?.toISOString(),
          expiresAt: data.expiresAt?.toISOString(),
          ...(pilotDealId ? { pilotDealId } : {}),
          ...(data.attachment
            ? {
                attachment: data.attachment,
              }
            : {}),
          ...(invoiceOnly
            ? { invoiceOnlyMode: true }
            : {
                invoiceOnlyMode: false,
                paymentMethod: effectivePaymentMethod,
                ...(data.paymentMethod === 'HEDERA'
                  ? { hederaCheckoutMode: data.hederaCheckoutMode }
                  : {}),
                ...(data.paymentMethod === 'CRYPTO'
                  ? {
                      cryptoNetwork: data.cryptoNetwork?.trim(),
                      cryptoAddress: data.cryptoAddress?.trim(),
                      cryptoCurrency: data.cryptoCurrency?.trim(),
                      cryptoMemo: data.cryptoMemo?.trim() || undefined,
                      cryptoInstructions: data.cryptoInstructions?.trim() || undefined,
                    }
                  : {}),
                ...(data.paymentMethod === 'MANUAL_BANK'
                  ? {
                      manualBankRecipientName: data.manualBankRecipientName?.trim(),
                      manualBankCurrency: data.manualBankCurrency?.trim(),
                      manualBankDestinationType: data.manualBankDestinationType?.trim(),
                      manualBankBankName: data.manualBankBankName?.trim() || undefined,
                      manualBankAccountNumber: data.manualBankAccountNumber?.trim() || undefined,
                      manualBankIban: data.manualBankIban?.trim() || undefined,
                      manualBankSwiftBic: data.manualBankSwiftBic?.trim() || undefined,
                      manualBankRoutingSortCode: data.manualBankRoutingSortCode?.trim() || undefined,
                      manualBankWiseReference: data.manualBankWiseReference?.trim() || undefined,
                      manualBankRevolutHandle: data.manualBankRevolutHandle?.trim() || undefined,
                      manualBankInstructions: data.manualBankInstructions?.trim() || undefined,
                    }
                  : {}),
              }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice. Please try again.');
      }

      const result = await response.json();

      form.reset({
        collectionMode: 'payment_request',
        paymentMethod: 'STRIPE',
        hederaCheckoutMode: 'INTERACTIVE',
        cryptoNetwork: '',
        cryptoAddress: '',
        cryptoCurrency: '',
        cryptoMemo: '',
        cryptoInstructions: '',
        manualBankRecipientName: '',
        manualBankCurrency: '',
        manualBankDestinationType: '',
        manualBankBankName: '',
        manualBankAccountNumber: '',
        manualBankIban: '',
        manualBankSwiftBic: '',
        manualBankRoutingSortCode: '',
        manualBankWiseReference: '',
        manualBankRevolutHandle: '',
        manualBankInstructions: '',
        amount: undefined,
        currency: defaultCurrency,
        description: '',
        invoiceReference: '',
        customerEmail: '',
        customerName: '',
        customerPhone: '',
        invoiceDate: new Date(),
        dueDate: undefined,
        expiresAt: undefined,
        attachment: undefined,
      });
      initialAttachmentRef.current = null;
      setDescriptionLength(0);
      setOpen(false);

      if (onSuccess) {
        onSuccess(result.data);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create invoice. Please try again.';
      form.setError('root', {
        type: 'manual',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (data: CreatePaymentLinkFormValues) => {
    form.clearErrors('root');
    const invoiceOnly = data.collectionMode === 'invoice_only';

    const runPaymentRequestGuardrails = async (): Promise<boolean> => {
      if (!merchantSettingsLoaded) {
        form.setError('root', {
          type: 'manual',
          message: 'Merchant settings are still loading. Please wait a moment and try again.',
        });
        return false;
      }

      const setup = computePaymentLinkRailSetup(toPaymentLinkRailSnapshot(merchantSettings));

      const pm = data.paymentMethod;
      if (pm === 'CRYPTO' || pm === 'MANUAL_BANK') {
        return true;
      }

      if (!setup.anyRailConfigured) {
        setGuardrail({ kind: 'no_rails', setup });
        return false;
      }

      if (pm === 'STRIPE' && !setup.stripeConfigured) {
        setGuardrail({ kind: 'stripe', setup });
        return false;
      }
      if (pm === 'WISE' && (!setup.wiseConfigured || setup.wiseIncomplete)) {
        setGuardrail({ kind: 'wise', setup });
        return false;
      }
      if (pm === 'HEDERA' && !setup.hederaConfigured) {
        setGuardrail({ kind: 'hedera', setup });
        return false;
      }

      return true;
    };

    if (mode === 'edit') {
      if (invoiceOnly) {
        await performUpdate(data);
        return;
      }
      if (!(await runPaymentRequestGuardrails())) return;
      await performUpdate(data);
      return;
    }

    if (invoiceOnly) {
      await performCreate(data);
      return;
    }

    if (!(await runPaymentRequestGuardrails())) return;

    await performCreate(data);
  };

  const handleGuardrailSwitchToInvoiceOnly = React.useCallback(() => {
    form.setValue('collectionMode', 'invoice_only');
    form.clearErrors('paymentMethod');
    form.clearErrors('hederaCheckoutMode');
    form.clearErrors('cryptoNetwork');
    form.clearErrors('root');
    form.setValue('paymentMethod', undefined);
    form.setValue('cryptoNetwork', '');
    form.setValue('cryptoAddress', '');
    form.setValue('cryptoCurrency', '');
    form.setValue('cryptoMemo', '');
    form.setValue('cryptoInstructions', '');
    form.setValue('manualBankRecipientName', '');
    form.setValue('manualBankCurrency', '');
    form.setValue('manualBankDestinationType', '');
    form.setValue('manualBankBankName', '');
    form.setValue('manualBankAccountNumber', '');
    form.setValue('manualBankIban', '');
    form.setValue('manualBankSwiftBic', '');
    form.setValue('manualBankRoutingSortCode', '');
    form.setValue('manualBankWiseReference', '');
    form.setValue('manualBankRevolutHandle', '');
    form.setValue('manualBankInstructions', '');
    setGuardrail(null);
  }, [form]);

  const handleGuardrailChooseAnother = React.useCallback(() => {
    const pm = form.getValues('paymentMethod');
    if (!pm) return;
    const snapshot = toPaymentLinkRailSnapshot(merchantSettings);
    const setup = computePaymentLinkRailSetup(snapshot);
    const alt = pickAlternativePaymentMethod(setup, pm);
    if (alt) {
      form.setValue('paymentMethod', alt);
      if (alt === 'HEDERA') {
        const mode = form.getValues('hederaCheckoutMode');
        if (!mode) form.setValue('hederaCheckoutMode', 'INTERACTIVE');
      }
    }
    form.clearErrors('root');
    setGuardrail(null);
  }, [form, merchantSettings]);

  // Handle validation errors - focus first invalid field
  const onInvalidSubmit = (errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError && firstError !== 'root') {
      form.setFocus(firstError as any);
    }
  };

  const selectedPaymentMethod = form.watch('paymentMethod');

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          {trigger || <Button>Create Payment Link</Button>}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit invoice' : 'Create Invoice'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update this invoice on the same record. The public short link and URL do not change; customers see your updated details.'
              : 'Create a new invoice to send to your customers. Fill in the required information below.'}
          </DialogDescription>
        </DialogHeader>

        {wiseTransferLocked ? (
          <Alert>
            <AlertTitle>Bank transfer in progress</AlertTitle>
            <AlertDescription>
              A Wise transfer is already linked to this invoice. Amount, currency, invoice type, and payment method
              are locked until that transfer completes or is cleared. You can still edit description and customer
              details.
            </AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, onInvalidSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="collectionMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={wiseTransferLocked}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-2 rounded-md border p-3">
                        <RadioGroupItem value="payment_request" id="mode-pay" disabled={wiseTransferLocked} />
                        <label htmlFor="mode-pay" className="text-sm cursor-pointer leading-snug">
                          <span className="font-medium">Invoice with payment request</span>
                          <span className="block text-muted-foreground">
                            Customer gets a normal pay page (card, crypto, or Wise as configured).
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border p-3">
                        <RadioGroupItem value="invoice_only" id="mode-invoice" disabled={wiseTransferLocked} />
                        <label htmlFor="mode-invoice" className="text-sm cursor-pointer leading-snug">
                          <span className="font-medium">Invoice only / no payment request</span>
                          <span className="block text-muted-foreground">
                            Share amount and details only; no checkout on the public link. You can record payment
                            manually later.
                          </span>
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            {collectionMode === 'payment_request' ? (
            <FormField
              shouldUnregister
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment method</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={field.value ?? 'STRIPE'}
                      disabled={wiseTransferLocked}
                      onChange={(e) => {
                        const selectedValue = e.target.value as 'STRIPE' | 'HEDERA' | 'WISE' | 'CRYPTO' | 'MANUAL_BANK';
                        const option = paymentMethodOptions.find((opt) => opt.value === selectedValue);
                        if (option?.available) {
                          field.onChange(selectedValue);
                        }
                      }}
                    >
                      {paymentMethodOptions.map((opt) => (
                        <option 
                          key={opt.value} 
                          value={opt.value}
                          disabled={!opt.available}
                        >
                          {opt.label}{!opt.available ? ' (Not configured)' : ''}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    How your customer will pay this invoice
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            ) : null}

            {collectionMode === 'payment_request' &&
            form.watch('paymentMethod') === 'HEDERA' ? (
              <FormField
                shouldUnregister
                control={form.control}
                name="hederaCheckoutMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Crypto checkout style</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={wiseTransferLocked}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-center space-x-2 rounded-md border p-3">
                          <RadioGroupItem value="INTERACTIVE" id="hedera-int" disabled={wiseTransferLocked} />
                          <label htmlFor="hedera-int" className="text-sm cursor-pointer leading-snug">
                            <span className="font-medium">Interactive wallet payment (HashPack)</span>
                            <span className="block text-muted-foreground">
                              Customer connects a wallet on the pay page.
                            </span>
                          </label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-md border p-3">
                          <RadioGroupItem value="MANUAL" id="hedera-manual" disabled={wiseTransferLocked} />
                          <label htmlFor="hedera-manual" className="text-sm cursor-pointer leading-snug">
                            <span className="font-medium">Manual wallet instructions</span>
                            <span className="block text-muted-foreground">
                              Show wallet address and copy-paste instructions; you confirm payment manually when funds
                              arrive.
                            </span>
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {collectionMode === 'payment_request' && form.watch('paymentMethod') === 'CRYPTO' ? (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Enter the wallet your customer should pay. Nothing is auto-filled; you specify network, address, and
                  asset.
                </p>
                <FormField
                  control={form.control}
                  name="cryptoNetwork"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Network *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Ethereum, Arbitrum One"
                          list="merchant-crypto-networks"
                          disabled={wiseTransferLocked}
                        />
                      </FormControl>
                      <datalist id="merchant-crypto-networks">
                        <option value="Bitcoin" />
                        <option value="Ethereum" />
                        <option value="Solana" />
                        <option value="Polygon" />
                        <option value="Arbitrum" />
                        <option value="Base" />
                        <option value="BSC / BNB Chain" />
                        <option value="Hedera" />
                      </datalist>
                      <FormDescription>Chain or network name (customers must match this exactly)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cryptoAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet address *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Receiving address" disabled={wiseTransferLocked} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cryptoCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset / currency *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. USDC, ETH, BTC" disabled={wiseTransferLocked} />
                      </FormControl>
                      <FormDescription>Token or asset the customer should send</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cryptoMemo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Memo / tag (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Destination tag, memo, etc." disabled={wiseTransferLocked} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cryptoInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional instructions (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Any extra steps for your customer"
                          disabled={wiseTransferLocked}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {collectionMode === 'payment_request' && form.watch('paymentMethod') === 'MANUAL_BANK' ? (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Provide recipient and transfer details for manual bank / Wise / Revolut / international transfers.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="manualBankRecipientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Account holder / recipient" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankCurrency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transfer currency *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. USD, EUR, GBP" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankDestinationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination type *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="bank / Wise / Revolut / other" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="manualBankBankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankIban"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankSwiftBic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SWIFT / BIC</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankRoutingSortCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Routing / sort code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankWiseReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wise email / profile reference</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manualBankRevolutHandle"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Revolut tag / handle</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="manualBankInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional transfer instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Any extra payer guidance (beneficiary address, intermediary bank, etc.)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {/* Amount and Currency */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value || ''}
                        disabled={wiseTransferLocked}
                      />
                    </FormControl>
                    <FormDescription>Payment amount</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <FormControl>
                      <CurrencySelect
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={wiseTransferLocked}
                      />
                    </FormControl>
                    <FormDescription>ISO 4217 code</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description for customer *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description that customer will see..."
                      className="resize-none"
                      rows={3}
                      maxLength={200}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setDescriptionLength(e.target.value.length);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    This appears on the invoice and payment page. {descriptionLength}/200 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Invoice Reference */}
            <FormField
              control={form.control}
              name="invoiceReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice reference (internal, optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="INV-001"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    For your internal tracking. Not shown to customers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Name */}
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Customer name"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>Optional</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Email and Phone */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="customer@example.com"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>Optional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1234567890"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>International format</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Invoice Date, Due Date and Expiry Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'PPP') : <span>Pick invoice date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Issue date for accounting records (can be backdated)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a due date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Customer-facing due date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiry Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick an expiry date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Link expiration (system)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Expiry Warning */}
            {form.watch('expiresAt') && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                ⚠️ Please note this invoice will expire on {format(form.watch('expiresAt')!, 'PPP')}. 
                To extend the life of this invoice, please edit this invoice & resend to customer.
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium">Payment instructions attachment</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional PNG, JPG, or PDF (max {PAYMENT_LINK_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB). Shown on the
                public invoice — useful for QR codes or bank transfer details.
              </p>
              <input
                ref={attachmentFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                className="sr-only"
                onChange={handleInvoiceAttachmentInputChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={attachmentUploading}
                  onClick={() => attachmentFileInputRef.current?.click()}
                >
                  {attachmentUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Uploading…
                    </>
                  ) : invoiceAttachment ? (
                    'Replace file'
                  ) : (
                    'Upload file'
                  )}
                </Button>
                {invoiceAttachment ? (
                  <>
                    <div className="flex items-center gap-1.5 text-sm text-slate-700 min-w-0 max-w-full">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate" title={invoiceAttachment.filename}>
                        {invoiceAttachment.filename}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={clearInvoiceAttachment}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Form-level Error Message */}
            {form.formState.errors.root && (
              <div className="rounded-md bg-destructive/15 border border-destructive/20 p-4 text-sm">
                <p className="font-medium text-destructive mb-1">
                  {mode === 'edit' ? 'Unable to save changes' : 'Unable to create invoice'}
                </p>
                <p className="text-destructive/90">{form.formState.errors.root.message}</p>
              </div>
            )}
            
            {/* Validation Error Summary (omit hidden payment fields in invoice-only mode) */}
            {(() => {
              const err = form.formState.errors;
              const keys = Object.keys(err).filter((k) => k !== 'root');
              const visibleKeys =
                collectionMode === 'invoice_only'
                  ? keys.filter((k) => k !== 'paymentMethod' && k !== 'hederaCheckoutMode')
                  : keys;
              return (
                visibleKeys.length > 0 &&
                !err.root && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
                    <p className="font-medium text-amber-900 mb-1">Please fix the highlighted fields</p>
                    <p className="text-amber-700">
                      {mode === 'edit'
                        ? 'Review the fields above and correct any errors to save this invoice.'
                        : 'Review the fields above and correct any errors to create this invoice.'}
                    </p>
                  </div>
                )
              );
            })()}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (collectionMode === 'payment_request' && !merchantSettingsLoaded)
                }
                title={
                  collectionMode === 'payment_request' && !merchantSettingsLoaded
                    ? 'Loading merchant settings…'
                    : undefined
                }
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'edit' ? 'Save changes' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <PaymentLinksGuardrailModal
      open={!!guardrail}
      onOpenChange={(o) => {
        if (!o) setGuardrail(null);
      }}
      kind={guardrail?.kind ?? null}
      setup={guardrail?.setup ?? railSetup}
      onSwitchToInvoiceOnly={handleGuardrailSwitchToInvoiceOnly}
      onChooseAnotherPaymentMethod={handleGuardrailChooseAnother}
      alternativeAvailable={
        guardrail && selectedPaymentMethod
          ? pickAlternativePaymentMethod(guardrail.setup, selectedPaymentMethod) !== null
          : false
      }
    />
    </>
  );
};

