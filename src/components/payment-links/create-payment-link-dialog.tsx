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
import { CalendarIcon, Loader2 } from 'lucide-react';

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

interface PaymentMethodOption {
  value: 'STRIPE' | 'HEDERA' | 'WISE';
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
  paymentMethod: z.enum(['STRIPE', 'HEDERA', 'WISE']).optional(),
  hederaCheckoutMode: z.enum(['INTERACTIVE', 'MANUAL']).optional(),
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
  dueDate: z.date().optional(),
  expiresAt: z.date().optional(),
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
  );

type CreatePaymentLinkFormValues = z.infer<typeof createPaymentLinkFormSchema>;

export interface CreatePaymentLinkDialogProps {
  organizationId: string;
  defaultCurrency?: string;
  defaultValues?: Partial<CreatePaymentLinkFormValues>;
  onSuccess?: (paymentLink: any) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CreatePaymentLinkDialog: React.FC<CreatePaymentLinkDialogProps> = ({
  organizationId,
  defaultCurrency = 'USD',
  defaultValues,
  onSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) => {
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
    ];
  }, [merchantSettings?.wiseEnabled, railSetup.wiseConfigured, railSetup.wiseIncomplete]);

  const form = useForm<CreatePaymentLinkFormValues>({
    resolver: zodResolver(createPaymentLinkFormSchema),
    defaultValues: {
      collectionMode: 'payment_request',
      paymentMethod: 'STRIPE',
      hederaCheckoutMode: 'INTERACTIVE',
      amount: undefined,
      currency: defaultCurrency,
      description: '',
      invoiceReference: '',
      customerEmail: '',
      customerName: '',
      customerPhone: '',
      dueDate: undefined,
      expiresAt: undefined,
      ...defaultValues,
    },
  });

  const collectionMode = form.watch('collectionMode');

  React.useEffect(() => {
    if (collectionMode === 'invoice_only') {
      form.clearErrors('paymentMethod');
      form.clearErrors('hederaCheckoutMode');
      form.setValue('paymentMethod', undefined);
    } else if (collectionMode === 'payment_request') {
      const pm = form.getValues('paymentMethod');
      if (!pm) {
        form.setValue('paymentMethod', 'STRIPE');
      }
    }
  }, [collectionMode, form]);

  // Update form when defaultValues change
  React.useEffect(() => {
    if (defaultValues && open) {
      form.reset({
        collectionMode: 'payment_request',
        paymentMethod: 'STRIPE',
        hederaCheckoutMode: 'INTERACTIVE',
        amount: undefined,
        currency: defaultCurrency,
        description: '',
        invoiceReference: '',
        customerEmail: '',
        customerName: '',
        customerPhone: '',
        dueDate: undefined,
        expiresAt: undefined,
        ...defaultValues,
      });
      setDescriptionLength(defaultValues.description?.length || 0);
    }
  }, [defaultValues, open, form, defaultCurrency]);

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
          dueDate: data.dueDate?.toISOString(),
          expiresAt: data.expiresAt?.toISOString(),
          ...(invoiceOnly
            ? { invoiceOnlyMode: true }
            : {
                invoiceOnlyMode: false,
                paymentMethod: effectivePaymentMethod,
                ...(data.paymentMethod === 'HEDERA'
                  ? { hederaCheckoutMode: data.hederaCheckoutMode }
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
        amount: undefined,
        currency: defaultCurrency,
        description: '',
        invoiceReference: '',
        customerEmail: '',
        customerName: '',
        customerPhone: '',
        dueDate: undefined,
        expiresAt: undefined,
      });
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

    if (invoiceOnly) {
      await performCreate(data);
      return;
    }

    if (!merchantSettingsLoaded) {
      form.setError('root', {
        type: 'manual',
        message: 'Merchant settings are still loading. Please wait a moment and try again.',
      });
      return;
    }

    const setup = computePaymentLinkRailSetup(toPaymentLinkRailSnapshot(merchantSettings));

    if (!setup.anyRailConfigured) {
      setGuardrail({ kind: 'no_rails', setup });
      return;
    }

    const pm = data.paymentMethod;
    if (pm === 'STRIPE' && !setup.stripeConfigured) {
      setGuardrail({ kind: 'stripe', setup });
      return;
    }
    if (pm === 'WISE' && (!setup.wiseConfigured || setup.wiseIncomplete)) {
      setGuardrail({ kind: 'wise', setup });
      return;
    }
    if (pm === 'HEDERA' && !setup.hederaConfigured) {
      setGuardrail({ kind: 'hedera', setup });
      return;
    }

    await performCreate(data);
  };

  const handleGuardrailSwitchToInvoiceOnly = React.useCallback(() => {
    form.setValue('collectionMode', 'invoice_only');
    form.clearErrors('paymentMethod');
    form.clearErrors('hederaCheckoutMode');
    form.clearErrors('root');
    form.setValue('paymentMethod', undefined);
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
      <DialogTrigger asChild>
        {trigger || <Button>Create Payment Link</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice to send to your customers. Fill in the required
            information below.
          </DialogDescription>
        </DialogHeader>

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
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center space-x-2 rounded-md border p-3">
                        <RadioGroupItem value="payment_request" id="mode-pay" />
                        <label htmlFor="mode-pay" className="text-sm cursor-pointer leading-snug">
                          <span className="font-medium">Invoice with payment request</span>
                          <span className="block text-muted-foreground">
                            Customer gets a normal pay page (card, crypto, or Wise as configured).
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border p-3">
                        <RadioGroupItem value="invoice_only" id="mode-invoice" />
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
                      onChange={(e) => {
                        const selectedValue = e.target.value as 'STRIPE' | 'HEDERA' | 'WISE';
                        const option = paymentMethodOptions.find(opt => opt.value === selectedValue);
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
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-center space-x-2 rounded-md border p-3">
                          <RadioGroupItem value="INTERACTIVE" id="hedera-int" />
                          <label htmlFor="hedera-int" className="text-sm cursor-pointer leading-snug">
                            <span className="font-medium">Interactive wallet payment (HashPack)</span>
                            <span className="block text-muted-foreground">
                              Customer connects a wallet on the pay page.
                            </span>
                          </label>
                        </div>
                        <div className="flex items-center space-x-2 rounded-md border p-3">
                          <RadioGroupItem value="MANUAL" id="hedera-manual" />
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

            {/* Due Date and Expiry Date */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Form-level Error Message */}
            {form.formState.errors.root && (
              <div className="rounded-md bg-destructive/15 border border-destructive/20 p-4 text-sm">
                <p className="font-medium text-destructive mb-1">Unable to create invoice</p>
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
                      Review the fields above and correct any errors to create this invoice.
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
                Create Invoice
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

