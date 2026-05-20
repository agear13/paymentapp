'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type DeleteOrganizationDialogProps = {
  organizationId: string;
  organizationName: string;
};

export function DeleteOrganizationDialog({
  organizationId,
  organizationName,
}: DeleteOrganizationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  const nameMatches =
    confirmName.trim().length > 0 &&
    confirmName.trim().toLowerCase() === organizationName.trim().toLowerCase();

  const reset = () => {
    setConfirmName('');
    setDeleting(false);
  };

  const handleDelete = async () => {
    if (!nameMatches) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Could not delete organization');
      }
      toast.success('Organization removed');
      setOpen(false);
      reset();
      router.push('/onboarding');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete organization');
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete organization
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete organization?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This action permanently removes the organization and associated operational
                records.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Invoices and payment links</li>
                <li>Payout records and settlement history</li>
                <li>Participant obligations</li>
                <li>Connected integrations</li>
                <li>Reconciliation history</li>
              </ul>
              <p>
                Type <span className="font-medium text-foreground">{organizationName}</span> to
                confirm.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-org-name">Organization name</Label>
          <Input
            id="confirm-org-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={organizationName}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!nameMatches || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete organization'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
