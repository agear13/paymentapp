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
import { CurrencySelect } from './currency-select';
import { cn } from '@/lib/utils';

// Form validation schema
const createPaymentLinkFormSchema = z.object({
  amount: z.coerce
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  currency: z.string().length(3, 'Currency code must be 3 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description must not exceed 200 characters'),
  invoiceReference: z
    .string()
    .max(255, 'Invoice reference must not exceed 255 characters')
    .optional(),
  customerEmail: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
  customerPhone: z
    .string()
    .max(50, 'Phone number must not exceed 50 characters')
    .regex(/^\+?[1-9]\d{1,14}$/, 'Phone number must be in valid international format')
    .optional()
    .or(z.literal('')),
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

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const form = useForm<CreatePaymentLinkFormValues>({
    resolver: zodResolver(createPaymentLinkFormSchema),
    defaultValues: {
      amount: undefined,
      currency: defaultCurrency,
      description: '',
      invoiceReference: '',
      customerEmail: '',
      customerPhone: '',
      expiresAt: undefined,
      ...defaultValues,
    },
  });

  // Update form when defaultValues change
  React.useEffect(() => {
    if (defaultValues && open) {
      form.reset({
        amount: undefined,
        currency: defaultCurrency,
        description: '',
        invoiceReference: '',
        customerEmail: '',
        customerPhone: '',
        expiresAt: undefined,
        ...defaultValues,
      });
      setDescriptionLength(defaultValues.description?.length || 0);
    }
  }, [defaultValues, open, form, defaultCurrency]);

  const handleSubmit = async (data: CreatePaymentLinkFormValues) => {
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
          customerEmail: data.customerEmail || undefined,
          customerPhone: data.customerPhone || undefined,
          invoiceReference: data.invoiceReference || undefined,
          expiresAt: data.expiresAt?.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment link');
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
        message: error.message || 'Failed to create payment link',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Create Payment Link</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Payment Link</DialogTitle>
          <DialogDescription>
            Create a new payment link to send to your customers. Fill in the required
            information below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter payment description..."
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
                    {descriptionLength}/200 characters
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
                  <FormLabel>Invoice Reference</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="INV-001"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional invoice or order number for tracking
                  </FormDescription>
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

            {/* Expiry Date */}
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
                    Optional expiration date for the payment link
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Message */}
            {form.formState.errors.root && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {form.formState.errors.root.message}
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
                Create Payment Link
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

