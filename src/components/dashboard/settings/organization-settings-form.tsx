'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOrganization } from '@/hooks/use-organization';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const organizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
});

type OrganizationFormValues = z.infer<typeof organizationSchema>;

export function OrganizationSettingsForm() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
    },
  });

  // Fetch organization data
  React.useEffect(() => {
    async function fetchOrganization() {
      if (!organizationId) {
        return;
      }

      try {
        const response = await fetch('/api/organizations');
        
        if (!response.ok) {
          throw new Error('Failed to fetch organization');
        }

        const orgs = await response.json();
        
        if (orgs && orgs.length > 0) {
          form.reset({
            name: orgs[0].name || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
        toast.error('Failed to load organization details');
      } finally {
        setIsLoading(false);
      }
    }

    if (!isOrgLoading) {
      fetchOrganization();
    }
  }, [organizationId, isOrgLoading, form]);

  async function onSubmit(data: OrganizationFormValues) {
    if (!organizationId) {
      toast.error('No organization found');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }),
      });

      if (!response.ok) {
        throw new Error('Failed to update organization');
      }

      toast.success('Organization settings updated successfully');
    } catch (error) {
      toast.error('Failed to update organization settings');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corp" {...field} />
              </FormControl>
              <FormDescription>
                This is your organization's visible name within the platform.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}













