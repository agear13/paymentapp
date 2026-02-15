'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function normalizePctInput(val: string | number): number {
  const n = typeof val === 'string' ? parseFloat(val) || 0 : val;
  return n > 1 ? n / 100 : n;
}

interface CreateReferralLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  userType: 'BD_PARTNER' | 'CONSULTANT';
  /** For BD: list of consultants to optionally assign. For Consultant: list of BD partners. */
  consultantOptions?: { id: string; name: string }[];
  bdPartnerOptions?: { id: string; name: string }[];
  defaultConsultantPct?: number;
  defaultBdPartnerPct?: number;
  onSuccess?: () => void;
}

export function CreateReferralLinkModal({
  open,
  onOpenChange,
  organizationId,
  userType,
  consultantOptions = [],
  bdPartnerOptions = [],
  defaultConsultantPct = 10,
  defaultBdPartnerPct = 5,
  onSuccess,
}: CreateReferralLinkModalProps) {
  const [code, setCode] = useState(() => generateReferralCode());
  const [consultantPct, setConsultantPct] = useState(String(defaultConsultantPct));
  const [bdPartnerPct, setBdPartnerPct] = useState(String(defaultBdPartnerPct));
  const [consultantId, setConsultantId] = useState<string | null>(null);
  const [bdPartnerId, setBdPartnerId] = useState<string | null>(null);
  const [bdReferralCode, setBdReferralCode] = useState('');
  const [basis, setBasis] = useState<'GROSS' | 'NET'>('GROSS');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [checkoutAmount, setCheckoutAmount] = useState('100');
  const [checkoutCurrency, setCheckoutCurrency] = useState('AUD');
  const [loading, setLoading] = useState(false);

  const regenCode = () => setCode(generateReferralCode());

  const handleSubmit = async () => {
    const cp = normalizePctInput(consultantPct);
    const bp = normalizePctInput(bdPartnerPct);
    if (cp + bp > 1) {
      toast.error('Consultant + BD Partner percentages cannot exceed 100%');
      return;
    }
    if (!code.trim()) {
      toast.error('Referral code is required');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        organizationId,
        code: code.trim().toUpperCase(),
        userType,
        consultantPct: cp * 100,
        bdPartnerPct: bp * 100,
        basis,
        status,
        checkoutConfig: {
          amount: parseFloat(checkoutAmount) || 100,
          currency: checkoutCurrency || 'AUD',
        },
      };

      if (userType === 'BD_PARTNER') {
        if (consultantId) body.consultantId = consultantId;
      } else {
        if (bdReferralCode.trim()) {
          body.bdReferralCode = bdReferralCode.trim().toUpperCase();
        } else if (bdPartnerId) {
          body.bdPartnerId = bdPartnerId;
        }
      }

      const res = await fetch('/api/referral-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create referral link');
      }

      toast.success('Referral link created');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Referral Link (Pay Now)</DialogTitle>
          <DialogDescription>
            Generate a commission-enabled link. Customers who pay via this link will trigger revenue splits.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="code">Referral code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="ABC123"
              />
            </div>
            <Button variant="outline" size="icon" onClick={regenCode} title="Generate new code">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="consultantPct">Consultant % (e.g. 10 or 0.10)</Label>
              <Input
                id="consultantPct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={consultantPct}
                onChange={(e) => setConsultantPct(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bdPartnerPct">BD Partner % (e.g. 5 or 0.05)</Label>
              <Input
                id="bdPartnerPct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={bdPartnerPct}
                onChange={(e) => setBdPartnerPct(e.target.value)}
              />
            </div>
          </div>

          {userType === 'BD_PARTNER' && consultantOptions.length > 0 && (
            <div>
              <Label>Assign to consultant (optional)</Label>
              <Select value={consultantId ?? 'any'} onValueChange={(v) => setConsultantId(v === 'any' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any consultant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any consultant</SelectItem>
                  {consultantOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {userType === 'CONSULTANT' && (
            <div className="space-y-2">
              <Label>BD Partner (optional)</Label>
              <Input
                placeholder="Paste BD referral code to inherit"
                value={bdReferralCode}
                onChange={(e) => setBdReferralCode(e.target.value)}
              />
              {bdPartnerOptions.length > 0 && (
                <Select value={bdPartnerId ?? 'none'} onValueChange={(v) => setBdPartnerId(v === 'none' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Or select BD partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {bdPartnerOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Commission basis</Label>
              <Select value={basis} onValueChange={(v: 'GROSS' | 'NET') => setBasis(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GROSS">GROSS</SelectItem>
                  <SelectItem value="NET">NET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: 'ACTIVE' | 'INACTIVE') => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={checkoutAmount}
                onChange={(e) => setCheckoutAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Input
                value={checkoutCurrency}
                onChange={(e) => setCheckoutCurrency(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Create link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
