'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  BASE_PARTICIPANT_OPTIONS,
  COMMISSION_STRUCTURE_OPTIONS,
  type BaseParticipantSlot,
  type CommissionStructureKind,
  resolveCommissionWithValidation,
} from '@/lib/deal-network-demo/commission-structure';
import {
  rhCompanies,
  getCompanyById,
  getContactsForCompany,
  formatRhContactLine,
  type RhCompany,
  type RhContact,
} from '@/lib/data/mock-rabbit-hole-network';

const PAYOUT_TRIGGER_MANUAL = 'Manual' as const;

function norm(s: string) {
  return s.trim().toLowerCase();
}

function toInputNumber(v: number | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

/** Parse paid amount from user input; strips commas/spaces and avoids parseFloat partial matches. */
function parseUsdAmountInput(raw: string): number | undefined {
  const t = raw.trim().replace(/,/g, '').replace(/\s+/g, '');
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

interface RoleCommissionState {
  kind: CommissionStructureKind;
  value: string;
  baseParticipant: BaseParticipantSlot;
  formula: string;
}

export interface CreateDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (deal: RecentDeal) => void;
  editDeal?: RecentDeal | null;
}

export function CreateDealModal({ open, onOpenChange, onCreate, editDeal }: CreateDealModalProps) {
  const [dealName, setDealName] = React.useState('');
  const [companyId, setCompanyId] = React.useState<string>('');
  const [contactId, setContactId] = React.useState<string>('');
  const [dealValue, setDealValue] = React.useState('');
  const [introducer, setIntroducer] = React.useState('');
  const [graphIntroducer, setGraphIntroducer] = React.useState('');
  const [closer, setCloser] = React.useState('');
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);

  /** Session-local companies/contacts added via “Add new partner” (merged into pickers). */
  const [extraCompanies, setExtraCompanies] = React.useState<RhCompany[]>([]);
  const [extraContacts, setExtraContacts] = React.useState<RhContact[]>([]);
  const [manualPartnerMode, setManualPartnerMode] = React.useState(false);
  const [manualPartnerName, setManualPartnerName] = React.useState('');
  const [manualContactName, setManualContactName] = React.useState('');
  const [manualEmail, setManualEmail] = React.useState('');
  const [manualRole, setManualRole] = React.useState('');

  const [introducerCommission, setIntroducerCommission] = React.useState<RoleCommissionState>({
    kind: 'fixed_amount',
    value: '',
    baseParticipant: 'Closer',
    formula: '',
  });
  const [closerCommission, setCloserCommission] = React.useState<RoleCommissionState>({
    kind: 'fixed_amount',
    value: '',
    baseParticipant: 'Introducer',
    formula: '',
  });
  const [platformCommission, setPlatformCommission] = React.useState<RoleCommissionState>({
    kind: 'fixed_amount',
    value: '',
    baseParticipant: 'Closer',
    formula: '',
  });
  const [paymentLink, setPaymentLink] = React.useState('');
  const [paidAmount, setPaidAmount] = React.useState('');

  const mergedCompanies = React.useMemo(() => [...rhCompanies, ...extraCompanies], [extraCompanies]);

  const resolveCompany = React.useCallback(
    (id: string): RhCompany | undefined => getCompanyById(id) ?? extraCompanies.find((c) => c.id === id),
    [extraCompanies]
  );

  const resolveContacts = React.useCallback(
    (id: string): RhContact[] => [
      ...getContactsForCompany(id),
      ...extraContacts.filter((c) => c.companyId === id),
    ],
    [extraContacts]
  );

  const company = companyId ? resolveCompany(companyId) : undefined;
  const contacts = companyId ? resolveContacts(companyId) : [];
  const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined;

  const introducerMatchesGraph =
    !contactId || !graphIntroducer || norm(introducer) === norm(graphIntroducer);
  const showOverrideNotice = Boolean(contactId && graphIntroducer && !introducerMatchesGraph);

  const dealValueNum = parseFloat(dealValue.replace(/,/g, ''));
  const introResolved = resolveCommissionWithValidation(
    {
      commissionKind: introducerCommission.kind,
      commissionValue: parseFloat(introducerCommission.value) || 0,
      baseParticipant: introducerCommission.baseParticipant,
      formulaExpression: introducerCommission.formula,
    },
    { dealValue: dealValueNum, roleAmounts: {} }
  );
  const closerResolved = resolveCommissionWithValidation(
    {
      commissionKind: closerCommission.kind,
      commissionValue: parseFloat(closerCommission.value) || 0,
      baseParticipant: closerCommission.baseParticipant,
      formulaExpression: closerCommission.formula,
    },
    {
      dealValue: dealValueNum,
      roleAmounts: { Introducer: introResolved.valid ? introResolved.total : undefined },
    }
  );
  const platformResolved = resolveCommissionWithValidation(
    {
      commissionKind: platformCommission.kind,
      commissionValue: parseFloat(platformCommission.value) || 0,
      baseParticipant: platformCommission.baseParticipant,
      formulaExpression: platformCommission.formula,
    },
    {
      dealValue: dealValueNum,
      roleAmounts: {
        Introducer: introResolved.valid ? introResolved.total : undefined,
        Closer: closerResolved.valid ? closerResolved.total : undefined,
      },
    }
  );

  const totalCommission = introResolved.total + closerResolved.total + platformResolved.total;
  const commissionPct =
    !Number.isNaN(dealValueNum) && dealValueNum > 0 ? (totalCommission / dealValueNum) * 100 : null;
  const hasDefinedCommission = introResolved.valid && closerResolved.valid && platformResolved.valid;
  const overAllocated = !Number.isNaN(dealValueNum) && dealValueNum > 0 && totalCommission > dealValueNum;
  const remainingAmount =
    !Number.isNaN(dealValueNum) && dealValueNum > 0 ? Math.max(0, dealValueNum - totalCommission) : 0;

  const valueOk = !Number.isNaN(dealValueNum) && dealValueNum > 0;
  const hasPartner = Boolean(companyId && contactId && company && contact);
  const canSubmit =
    Boolean(dealName.trim()) &&
    hasPartner &&
    valueOk &&
    hasDefinedCommission &&
    totalCommission > 0 &&
    !overAllocated;

  const isDirty = React.useMemo(() => {
    if (!open) return false;
    if (!editDeal) {
      return (
        dealName.trim() !== '' ||
        companyId.trim() !== '' ||
        contactId.trim() !== '' ||
        dealValue.trim() !== '' ||
        introducer.trim() !== '' ||
        closer.trim() !== '' ||
        introducerCommission.value.trim() !== '' ||
        closerCommission.value.trim() !== '' ||
        platformCommission.value.trim() !== '' ||
        paymentLink.trim() !== '' ||
        paidAmount.trim() !== ''
      );
    }
    const base = editDeal;
    return (
      dealName.trim() !== (base?.dealName ?? '').trim() ||
      dealValue.trim() !== (base ? String(base.value) : '') ||
      introducer.trim() !== (base?.introducer ?? '').trim() ||
      closer.trim() !== (base?.closer ?? '').trim() ||
      introducerCommission.value.trim() !== (base ? toInputNumber(base.introducerAmount) : '') ||
      closerCommission.value.trim() !== (base ? toInputNumber(base.closerAmount) : '') ||
      platformCommission.value.trim() !== (base ? toInputNumber(base.platformFee) : '') ||
      paymentLink.trim() !== (base?.paymentLink ?? '').trim() ||
      paidAmount.trim() !== (base ? toInputNumber(base.paidAmount) : '')
    );
  }, [
    open,
    editDeal,
    dealName,
    dealValue,
    companyId,
    contactId,
    introducer,
    closer,
    introducerCommission,
    closerCommission,
    platformCommission,
    paymentLink,
    paidAmount,
  ]);

  React.useEffect(() => {
    if (!open) return;

    setCompanyOpen(false);
    setContactOpen(false);
    setManualPartnerMode(false);
    setManualPartnerName('');
    setManualContactName('');
    setManualEmail('');
    setManualRole('');

    if (!editDeal) {
      setDealName('');
      setCompanyId('');
      setContactId('');
      setDealValue('');
      setIntroducer('');
      setGraphIntroducer('');
      setCloser('');
      setIntroducerCommission({ kind: 'fixed_amount', value: '', baseParticipant: 'Closer', formula: '' });
      setCloserCommission({ kind: 'fixed_amount', value: '', baseParticipant: 'Introducer', formula: '' });
      setPlatformCommission({ kind: 'fixed_amount', value: '', baseParticipant: 'Closer', formula: '' });
      setPaymentLink('');
      setPaidAmount('');
      return;
    }

    setDealName(editDeal.dealName);
    setDealValue(String(editDeal.value));
    setIntroducer(editDeal.introducer);
    setCloser(editDeal.closer);
    setIntroducerCommission({
      kind: 'fixed_amount',
      value: toInputNumber(editDeal.introducerAmount),
      baseParticipant: 'Closer',
      formula: '',
    });
    setCloserCommission({
      kind: 'fixed_amount',
      value: toInputNumber(editDeal.closerAmount),
      baseParticipant: 'Introducer',
      formula: '',
    });
    setPlatformCommission({
      kind: 'fixed_amount',
      value: toInputNumber(editDeal.platformFee),
      baseParticipant: 'Closer',
      formula: '',
    });
    setPaymentLink(editDeal.paymentLink ?? '');
    setPaidAmount(toInputNumber(editDeal.paidAmount));

    const graphCo = rhCompanies.find((co) => co.name === editDeal.partner);
    if (graphCo) {
      setCompanyId(graphCo.id);
      if (editDeal.rhContactId) {
        setContactId(editDeal.rhContactId);
      } else {
        const graphContact = getContactsForCompany(graphCo.id).find(
          (c) => formatRhContactLine(c, graphCo.name) === editDeal.rhContactLine
        );
        setContactId(graphContact?.id ?? '');
      }
      setGraphIntroducer(editDeal.rhGraphIntroducer ?? '');
    } else {
      const coId = `co-edit-${Date.now()}`;
      const ctId = `ct-edit-${Date.now()}`;
      const co: RhCompany = { id: coId, name: editDeal.partner };
      const line = editDeal.rhContactLine?.split(' — ') ?? [];
      const contactName = line[0] || editDeal.partner;
      const contactRole = line[1] || 'Contact';
      const ct: RhContact = {
        id: ctId,
        companyId: coId,
        name: contactName,
        title: contactRole,
        specialty: 'Added partner',
        introducedBy: editDeal.rhGraphIntroducer ?? '',
      };
      setExtraCompanies((prev) => (prev.some((x) => x.name === co.name) ? prev : [...prev, co]));
      setExtraContacts((prev) => (prev.some((x) => x.id === ct.id) ? prev : [...prev, ct]));
      setCompanyId(coId);
      setContactId(ctId);
      setGraphIntroducer(editDeal.rhGraphIntroducer ?? '');
    }
  }, [open, editDeal]);

  function selectCompany(id: string) {
    setManualPartnerMode(false);
    setCompanyId(id);
    setContactId('');
    setIntroducer('');
    setGraphIntroducer('');
    setCompanyOpen(false);
  }

  function beginAddNewPartner() {
    setManualPartnerMode(true);
    setCompanyId('');
    setContactId('');
    setIntroducer('');
    setGraphIntroducer('');
    setCompanyOpen(false);
  }

  function cancelManualPartner() {
    setManualPartnerMode(false);
    setManualPartnerName('');
    setManualContactName('');
    setManualEmail('');
    setManualRole('');
  }

  function saveManualPartner() {
    const pn = manualPartnerName.trim();
    const cn = manualContactName.trim();
    if (!pn || !cn) return;
    const coId = `co-pilot-${Date.now()}`;
    const ctId = `ct-pilot-${Date.now()}`;
    const newCompany: RhCompany = { id: coId, name: pn };
    const title = manualRole.trim() || 'Contact';
    const specialty = manualEmail.trim() ? manualEmail.trim() : 'Added partner';
    const newContact: RhContact = {
      id: ctId,
      companyId: coId,
      name: cn,
      title,
      specialty,
      introducedBy: '',
    };
    setExtraCompanies((prev) => [...prev, newCompany]);
    setExtraContacts((prev) => [...prev, newContact]);
    setCompanyId(coId);
    setContactId(ctId);
    setIntroducer('');
    setGraphIntroducer('');
    setManualPartnerMode(false);
    setManualPartnerName('');
    setManualContactName('');
    setManualEmail('');
    setManualRole('');
  }

  function selectContact(c: RhContact) {
    setContactId(c.id);
    setIntroducer(c.introducedBy);
    setGraphIntroducer(c.introducedBy);
    setContactOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !company || !contact) return;
    const paidAmountNum = parseUsdAmountInput(paidAmount);

    const newDeal: RecentDeal = {
      id: editDeal?.id ?? `demo-${Date.now()}`,
      dealName: dealName.trim(),
      partner: company.name,
      value: dealValueNum,
      introducer: introducer.trim(),
      closer: closer.trim(),
      introducerAmount: introResolved.total,
      closerAmount: closerResolved.total,
      platformFee: platformResolved.total,
      status: editDeal?.status ?? 'Pending',
      lastUpdated: new Date().toISOString(),
      payoutTrigger: PAYOUT_TRIGGER_MANUAL,
      paymentLink: paymentLink.trim() || undefined,
      paymentStatus: editDeal?.paymentStatus ?? 'Not Paid',
      paidAmount: paidAmountNum != null && !Number.isNaN(paidAmountNum) ? paidAmountNum : undefined,
      paidAt: editDeal?.paidAt,
      rhContactId: contact.id,
      rhContactLine: formatRhContactLine(contact, company.name),
      rhGraphIntroducer: contact.introducedBy,
    };
    onCreate(newDeal);
    toast.success(editDeal ? 'Deal updated' : 'Deal created');
    onOpenChange(false);
  }

  function requestClose() {
    if (!isDirty) {
      onOpenChange(false);
      return;
    }
    if (window.confirm('Discard changes?')) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0 min-h-0"
        onInteractOutside={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          requestClose();
        }}
      >
        <DialogHeader className="px-6 pt-6 shrink-0">
          <DialogTitle>{editDeal ? 'Edit deal' : 'Create deal'}</DialogTitle>
          <DialogDescription>
            Set partner attribution and explicit commission amounts for this deal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col max-h-[min(90vh,calc(100vh-2rem))]">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="space-y-2">
            <Label htmlFor="dn-deal-name">Deal name</Label>
            <Input
              id="dn-deal-name"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder="e.g. Enterprise API Package"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Partner</Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  className="w-full justify-between font-normal"
                >
                  {manualPartnerMode && !companyId
                    ? '+ Add new partner'
                    : company
                      ? company.name
                      : 'Search Rabbit Hole companies…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search companies…" />
                  <CommandList>
                    <CommandEmpty>No company found.</CommandEmpty>
                    <CommandGroup heading="Rabbit Hole network">
                      {mergedCompanies.map((c) => (
                        <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => selectCompany(c.id)}>
                          <Check className={cn('mr-2 h-4 w-4', companyId === c.id ? 'opacity-100' : 'opacity-0')} />
                          {c.name}
                        </CommandItem>
                      ))}
                      <CommandItem value="__add_new_partner__" onSelect={beginAddNewPartner}>
                        <span className="font-medium text-primary">+ Add new partner</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Companies from the demo identity graph, plus any partners you add for this session.
            </p>
          </div>

          {manualPartnerMode && !companyId ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">New partner</p>
              <div className="space-y-2">
                <Label htmlFor="dn-man-co">Partner name</Label>
                <Input
                  id="dn-man-co"
                  value={manualPartnerName}
                  onChange={(e) => setManualPartnerName(e.target.value)}
                  placeholder="Company or organization"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dn-man-ct">Contact name</Label>
                <Input
                  id="dn-man-ct"
                  value={manualContactName}
                  onChange={(e) => setManualContactName(e.target.value)}
                  placeholder="Primary contact"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dn-man-email">Email (optional)</Label>
                <Input
                  id="dn-man-email"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dn-man-role">Role (optional)</Label>
                <Input
                  id="dn-man-role"
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  placeholder="e.g. BD Lead"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={cancelManualPartner}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveManualPartner}
                  disabled={!manualPartnerName.trim() || !manualContactName.trim()}
                >
                  Save partner
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Contact person</Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  disabled={!companyId || manualPartnerMode}
                  aria-expanded={contactOpen}
                  className="w-full justify-between font-normal"
                >
                  {contact && company
                    ? formatRhContactLine(contact, company.name)
                    : companyId
                      ? 'Select contact…'
                      : 'Choose a company first'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search contacts…" />
                  <CommandList>
                    <CommandEmpty>No contact for this company.</CommandEmpty>
                    <CommandGroup heading={company?.name ?? 'Contacts'}>
                      {contacts.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.title} ${c.specialty}`}
                          onSelect={() => selectContact(c)}
                        >
                          <Check className={cn('mr-2 h-4 w-4', contactId === c.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="flex flex-col gap-0.5 text-left">
                            <span>
                              {c.name} — {c.title} — {company?.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-normal">{c.specialty}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dn-value">Deal value (USD)</Label>
            <Input
              id="dn-value"
              type="number"
              min={1}
              step={1}
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="100000"
              required
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Commission structure</p>
            {(
              [
                ['Introducer', introducerCommission, setIntroducerCommission, introResolved],
                ['Closer', closerCommission, setCloserCommission, closerResolved],
                ['Platform', platformCommission, setPlatformCommission, platformResolved],
              ] as const
            ).map(([label, state, setState, result]) => (
              <div key={label} className="rounded-md border bg-background p-3 space-y-2">
                <p className="text-sm font-medium">{label}</p>
                <Select
                  value={state.kind}
                  onValueChange={(v) =>
                    setState((prev) => ({ ...prev, kind: v as CommissionStructureKind }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMISSION_STRUCTURE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {state.kind === 'pct_of_participant' ? (
                  <Select
                    value={state.baseParticipant}
                    onValueChange={(v) =>
                      setState((prev) => ({ ...prev, baseParticipant: v as BaseParticipantSlot }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BASE_PARTICIPANT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                {state.kind === 'formula_advanced' ? (
                  <Input
                    value={state.formula}
                    onChange={(e) => setState((prev) => ({ ...prev, formula: e.target.value }))}
                    placeholder="Formula expression (preview only)"
                  />
                ) : (
                  <Input
                    type="number"
                    min={0}
                    step={state.kind === 'fixed_amount' ? 1 : 0.5}
                    value={state.value}
                    onChange={(e) => setState((prev) => ({ ...prev, value: e.target.value }))}
                    placeholder={state.kind === 'fixed_amount' ? 'USD amount' : 'Percent'}
                  />
                )}
                <p className="text-xs text-muted-foreground">{result.previewLine}</p>
                {result.error ? <p className="text-xs text-destructive">{result.error}</p> : null}
              </div>
            ))}

            <div className="rounded-md border bg-background px-3 py-2 text-sm space-y-1">
              <p className="font-medium">Total deal value: ${valueOk ? dealValueNum.toLocaleString() : '0'}</p>
              <p>Allocated so far: ${totalCommission.toLocaleString()}</p>
              <p>Remaining: ${remainingAmount.toLocaleString()}</p>
              {commissionPct != null ? (
                <p className="text-muted-foreground">{commissionPct.toFixed(2)}% allocated</p>
              ) : null}
              {overAllocated ? (
                <p className="text-destructive font-medium">
                  Over-allocated. Total allocations cannot exceed deal value.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Payout is triggered manually when the contract is marked as paid on the deal card.
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Payment (optional)</p>
            <div className="space-y-2">
              <Label htmlFor="dn-payment-link">Payment link</Label>
              <Input
                id="dn-payment-link"
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                placeholder="Paste Stripe / bank / invoice link (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn-paid-amount">Paid amount (USD)</Label>
              <Input
                id="dn-paid-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This can be used to track how the client pays for this deal.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dn-intro">Introducer (attribution)</Label>
            <Input
              id="dn-intro"
              value={introducer}
              onChange={(e) => setIntroducer(e.target.value)}
              placeholder="Who gets introducer credit"
            />
            {contactId && introducerMatchesGraph && graphIntroducer ? (
              <p className="text-xs text-muted-foreground">Suggested from Rabbit Hole network history.</p>
            ) : null}
            {showOverrideNotice ? (
              <Alert className="border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/25 dark:border-amber-900/40">
                <AlertTitle className="text-sm">Override graph attribution?</AlertTitle>
                <AlertDescription className="text-xs sm:text-sm">
                  Rabbit Hole records <span className="font-medium">{graphIntroducer}</span> as the original
                  introducer for this contact. Are you sure you want to override?
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dn-closer">Closer</Label>
            <Input
              id="dn-closer"
              value={closer}
              onChange={(e) => setCloser(e.target.value)}
              placeholder="Who closed the deal"
            />
            <p className="text-xs text-muted-foreground">Enter manually (not sourced from the graph in this demo).</p>
          </div>
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {editDeal ? 'Save Changes' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
