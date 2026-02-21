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
import { CalendarIcon, Loader2, AlertCircle, Settings } from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencySelect } from './currency-select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
const createPaymentLinkFormSchema = z.object({
  paymentMethod: z.enum(['STRIPE', 'HEDERA', 'WISE']).default('STRIPE'),
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
});

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

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  // Fetch merchant settings when dialog opens
  React.useEffect(() => {
    async function fetchMerchantSettings() {
      if (!organizationId || !open) return;
      
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
          }
        }
      } catch (error) {
        console.error('Failed to fetch merchant settings:', error);
      }
    }

    fetchMerchantSettings();
  }, [organizationId, open]);

  // Compute available payment methods based on merchant settings
  const paymentMethodOptions = React.useMemo((): PaymentMethodOption[] => {
    const wiseConfigured = merchantSettings?.wiseEnabled && merchantSettings?.wiseProfileId;
    
    return [
      { 
        value: 'STRIPE', 
        label: 'Credit / Debit card (Stripe)', 
        available: true 
      },
      { 
        value: 'HEDERA', 
        label: 'Crypto (Hashpack)', 
        available: true 
      },
      { 
        value: 'WISE', 
        label: 'Bank transfer (Wise)', 
        available: !!wiseConfigured,
        unavailableReason: !merchantSettings?.wiseEnabled 
          ? 'Wise payments not enabled' 
          : !merchantSettings?.wiseProfileId 
            ? 'Wise Profile ID not configured'
            : undefined
      },
    ];
  }, [merchantSettings]);

  const wiseConfigured = merchantSettings?.wiseEnabled && merchantSettings?.wiseProfileId;

  const form = useForm<CreatePaymentLinkFormValues>({
    resolver: zodResolver(createPaymentLinkFormSchema),
    defaultValues: {
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

  // Update form when defaultValues change
  React.useEffect(() => {
    if (defaultValues && open) {
      form.reset({
        paymentMethod: 'STRIPE',
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

  const handleSubmit = async (data: CreatePaymentLinkFormValues) => {
    // Block submission if Wise is selected but not configured
    if (data.paymentMethod === 'WISE' && !wiseConfigured) {
      form.setError('root', {
        type: 'manual',
        message: 'Wise payments are not configured. Please set up Wise in Merchant Settings first.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          ...data,
          paymentMethod: data.paymentMethod || 'STRIPE',
          customerEmail: data.customerEmail || undefined,
          customerName: data.customerName || undefined,
          customerPhone: data.customerPhone || undefined,
          invoiceReference: data.invoiceReference || undefined,
          dueDate: data.dueDate?.toISOString(),
          expiresAt: data.expiresAt?.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice. Please try again.');
      }

      const result = await response.json();

      // Reset form and close dialog
      form.reset();
      setOpen(false);

      // Call success callback
      if (onSuccess) {
        onSuccess(result.data);
      }
    } catch (error: any) {
      form.setError('root', {
        type: 'manual',
        message: error.message || 'Failed to create invoice. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle validation errors - focus first invalid field
  const onInvalidSubmit = (errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError && firstError !== 'root') {
      form.setFocus(firstError as any);
    }
  };

  return (
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
            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment method</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={field.value}
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

            {/* Wise not configured warning */}
            {form.watch('paymentMethod') === 'WISE' && !wiseConfigured && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    Wise payments are not fully configured. Please set up Wise in Merchant Settings first.
                  </span>
                  <Link href="/dashboard/settings/merchant">
                    <Button variant="outline" size="sm" className="ml-2">
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            )}

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
            
            {/* Validation Error Summary */}
            {Object.keys(form.formState.errors).length > 0 && !form.formState.errors.root && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
                <p className="font-medium text-amber-900 mb-1">Please fix the highlighted fields</p>
                <p className="text-amber-700">Review the fields above and correct any errors to create this invoice.</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

