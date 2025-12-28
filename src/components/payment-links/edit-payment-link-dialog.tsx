/**
 * Edit Payment Link Dialog
 * Edit existing payment link in DRAFT state
 */

'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast';

const editPaymentLinkSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().min(3, 'Currency is required'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  invoiceReference: z.string().optional(),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  expiresAt: z.date().optional(),
});

type EditPaymentLinkFormValues = z.infer<typeof editPaymentLinkSchema>;

export interface PaymentLinkToEdit {
  id: string;
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  expiresAt: Date | null;
}

export interface EditPaymentLinkDialogProps {
  paymentLink: PaymentLinkToEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updatedLink: any) => void;
}

export const EditPaymentLinkDialog: React.FC<EditPaymentLinkDialogProps> = ({
  paymentLink,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EditPaymentLinkFormValues>({
    resolver: zodResolver(editPaymentLinkSchema),
    defaultValues: {
      amount: '',
      currency: 'USD',
      description: '',
      invoiceReference: '',
      customerEmail: '',
      customerPhone: '',
    },
  });

  // Update form when payment link changes
  React.useEffect(() => {
    if (paymentLink) {
      form.reset({
        amount: String(paymentLink.amount),
        currency: paymentLink.currency,
        description: paymentLink.description,
        invoiceReference: paymentLink.invoiceReference || '',
        customerEmail: paymentLink.customerEmail || '',
        customerPhone: paymentLink.customerPhone || '',
        expiresAt: paymentLink.expiresAt ? new Date(paymentLink.expiresAt) : undefined,
      });
    }
  }, [paymentLink, form]);

  const onSubmit = async (data: EditPaymentLinkFormValues) => {
    if (!paymentLink) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/payment-links/${paymentLink.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(data.amount),
          currency: data.currency,
          description: data.description,
          invoiceReference: data.invoiceReference || null,
          customerEmail: data.customerEmail || null,
          customerPhone: data.customerPhone || null,
          expiresAt: data.expiresAt ? data.expiresAt.toISOString() : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update payment link');
      }

      const result = await response.json();
      
      toast({
        title: 'Success',
        description: 'Payment link updated successfully',
      });

      form.reset();
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess(result.data);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment link',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!paymentLink) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payment Link</DialogTitle>
          <DialogDescription>
            Update the details of your payment link. Only DRAFT links can be edited.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
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
                      placeholder="Enter payment description"
                      className="resize-none"
                      rows={3}
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/200 characters
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
                    <Input placeholder="INV-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Customer Email */}
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer Phone */}
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1234567890" {...field} />
                    </FormControl>
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
                            'pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
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
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Optional expiry date for this payment link
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Payment Link'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};













