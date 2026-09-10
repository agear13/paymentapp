'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MFA_ENROLL_PATH,
  STEP_UP_CONFIRM_BODY,
  STEP_UP_CONFIRM_TITLE,
} from '@/lib/auth/mfa-assurance';
import { completeTotpStepUp, isSixDigitTotp } from '@/lib/auth/step-up-totp.client';

type SensitiveActionTotpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void | Promise<void>;
};

export function SensitiveActionTotpDialog({
  open,
  onOpenChange,
  onVerified,
}: SensitiveActionTotpDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [missingEnrollment, setMissingEnrollment] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setCode('');
    setError(null);
    setMissingEnrollment(false);
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSixDigitTotp(code)) {
      setError(STEP_UP_CONFIRM_BODY);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await completeTotpStepUp({ code });
      if (!result.ok) {
        setMissingEnrollment(Boolean(result.missingEnrollment));
        setError(result.error);
        return;
      }
      reset();
      await onVerified();
      onOpenChange(false);
    } catch {
      setError('Could not confirm this action. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="sensitive-action-totp-copy">
        <DialogHeader>
          <DialogTitle>{STEP_UP_CONFIRM_TITLE}</DialogTitle>
          <DialogDescription id="sensitive-action-totp-copy">
            {STEP_UP_CONFIRM_BODY}
          </DialogDescription>
        </DialogHeader>
        {missingEnrollment ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground" role="alert">
              {error}
            </p>
            <Button type="button" onClick={() => window.location.assign(MFA_ENROLL_PATH)}>
              Set up authenticator
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sensitive-action-totp">6-digit verification code</Label>
              <Input
                id="sensitive-action-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                aria-invalid={Boolean(error)}
                disabled={loading}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !isSixDigitTotp(code)}>
                {loading ? 'Confirming…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
