'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  rhCompanies,
  getCompanyById,
  getContactsForCompany,
  formatRhContactLine,
  type RhContact,
} from '@/lib/data/mock-rabbit-hole-network';
import {
  COMMISSION_STRUCTURE_OPTIONS,
  type BaseParticipantSlot,
  type CommissionStructureKind,
  computeDealCommissionTotal,
  BASE_PARTICIPANT_OPTIONS,
} from '@/lib/deal-network-demo/commission-structure';

function norm(s: string) {
  return s.trim().toLowerCase();
}

export interface CreateDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (deal: RecentDeal) => void;
}

export function CreateDealModal({ open, onOpenChange, onCreate }: CreateDealModalProps) {
  const [dealName, setDealName] = React.useState('');
  const [companyId, setCompanyId] = React.useState<string>('');
  const [contactId, setContactId] = React.useState<string>('');
  const [dealValue, setDealValue] = React.useState('');
  const [payoutTrigger, setPayoutTrigger] = React.useState('Manual');
  const [introducer, setIntroducer] = React.useState('');
  const [graphIntroducer, setGraphIntroducer] = React.useState('');
  const [closer, setCloser] = React.useState('');
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);

  const [commissionKind, setCommissionKind] = React.useState<CommissionStructureKind>('pct_deal_value');
  const [commissionPctDeal, setCommissionPctDeal] = React.useState('20');
  const [commissionFixed, setCommissionFixed] = React.useState('20000');
  const [commissionBaseParticipant, setCommissionBaseParticipant] =
    React.useState<BaseParticipantSlot>('Closer');
  const [commissionPctOfParticipant, setCommissionPctOfParticipant] = React.useState('5');
  const [formulaText, setFormulaText] = React.useState('');

  const company = companyId ? getCompanyById(companyId) : undefined;
  const contacts = companyId ? getContactsForCompany(companyId) : [];
  const contact = contactId
    ? contacts.find((c) => c.id === contactId)
    : undefined;

  const introducerMatchesGraph =
    !contactId || !graphIntroducer || norm(introducer) === norm(graphIntroducer);
  const showOverrideNotice = Boolean(contactId && graphIntroducer && !introducerMatchesGraph);

  const dealValueNum = parseFloat(dealValue.replace(/,/g, ''));
  const commissionPreview = React.useMemo(() => {
    if (Number.isNaN(dealValueNum) || dealValueNum <= 0) {
      return { total: 0, previewLine: 'Enter deal value to preview commission pool.' };
    }
    return computeDealCommissionTotal(
      commissionKind,
      dealValueNum,
      parseFloat(commissionPctDeal) || 0,
      parseFloat(commissionFixed) || 0,
      commissionBaseParticipant,
      parseFloat(commissionPctOfParticipant) || 0,
      formulaText
    );
  }, [
    commissionKind,
    dealValueNum,
    commissionPctDeal,
    commissionFixed,
    commissionBaseParticipant,
    commissionPctOfParticipant,
    formulaText,
  ]);

  React.useEffect(() => {
    if (!open) {
      setDealName('');
      setCompanyId('');
      setContactId('');
      setDealValue('');
      setPayoutTrigger('Manual');
      setIntroducer('');
      setGraphIntroducer('');
      setCloser('');
      setCompanyOpen(false);
      setContactOpen(false);
      setCommissionKind('pct_deal_value');
      setCommissionPctDeal('20');
      setCommissionFixed('20000');
      setCommissionBaseParticipant('Closer');
      setCommissionPctOfParticipant('5');
      setFormulaText('');
    }
  }, [open]);

  function selectCompany(id: string) {
    setCompanyId(id);
    setContactId('');
    setIntroducer('');
    setGraphIntroducer('');
    setCompanyOpen(false);
  }

  function selectContact(c: RhContact) {
    setContactId(c.id);
    setIntroducer(c.introducedBy);
    setGraphIntroducer(c.introducedBy);
    setContactOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(dealValue.replace(/,/g, ''));
    if (!dealName.trim() || !company || !contact || Number.isNaN(value) || value <= 0) return;
    if (!introducer.trim() || !closer.trim()) return;

    const { total: commission } = computeDealCommissionTotal(
      commissionKind,
      value,
      parseFloat(commissionPctDeal) || 0,
      parseFloat(commissionFixed) || 0,
      commissionBaseParticipant,
      parseFloat(commissionPctOfParticipant) || 0,
      formulaText
    );
    if (commission <= 0) return;
    const rhContactLine = formatRhContactLine(contact, company.name);

    const newDeal: RecentDeal = {
      id: `demo-${Date.now()}`,
      dealName: dealName.trim(),
      partner: company.name,
      value,
      introducer: introducer.trim(),
      closer: closer.trim(),
      commission,
      status: 'Pending',
      lastUpdated: new Date().toISOString(),
      payoutTrigger,
      rhContactId: contact.id,
      rhContactLine,
      rhGraphIntroducer: contact.introducedBy,
    };
    onCreate(newDeal);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create deal</DialogTitle>
          <DialogDescription>
            Pull partner and contact context from the Rabbit Hole network graph (demo). Configure how the
            total commission pool is calculated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label>Partner (network company)</Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  className="w-full justify-between font-normal"
                >
                  {company ? company.name : 'Search Rabbit Hole companies…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search companies…" />
                  <CommandList>
                    <CommandEmpty>No company in graph.</CommandEmpty>
                    <CommandGroup heading="Rabbit Hole network">
                      {rhCompanies.map((c) => (
                        <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => selectCompany(c.id)}>
                          <Check className={cn('mr-2 h-4 w-4', companyId === c.id ? 'opacity-100' : 'opacity-0')} />
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Companies registered in the demo identity graph.</p>
          </div>

          <div className="space-y-2">
            <Label>Contact person</Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  disabled={!companyId}
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
            <div className="space-y-2">
              <Label>Commission type</Label>
              <Select
                value={commissionKind}
                onValueChange={(v) => setCommissionKind(v as CommissionStructureKind)}
              >
                <SelectTrigger className="w-full">
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
            </div>

            {commissionKind === 'pct_deal_value' ? (
              <div className="space-y-2">
                <Label htmlFor="dn-comm-pct-deal">Percentage of deal value</Label>
                <Input
                  id="dn-comm-pct-deal"
                  type="number"
                  min={0}
                  step={0.1}
                  value={commissionPctDeal}
                  onChange={(e) => setCommissionPctDeal(e.target.value)}
                />
              </div>
            ) : null}

            {commissionKind === 'fixed_amount' ? (
              <div className="space-y-2">
                <Label htmlFor="dn-comm-fixed">Fixed amount (USD)</Label>
                <Input
                  id="dn-comm-fixed"
                  type="number"
                  min={0}
                  step={100}
                  value={commissionFixed}
                  onChange={(e) => setCommissionFixed(e.target.value)}
                />
              </div>
            ) : null}

            {commissionKind === 'pct_of_participant' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Base participant</Label>
                  <Select
                    value={commissionBaseParticipant}
                    onValueChange={(v) => setCommissionBaseParticipant(v as BaseParticipantSlot)}
                  >
                    <SelectTrigger className="w-full">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dn-comm-pct-part">Percentage of base</Label>
                  <Input
                    id="dn-comm-pct-part"
                    type="number"
                    min={0}
                    step={0.5}
                    value={commissionPctOfParticipant}
                    onChange={(e) => setCommissionPctOfParticipant(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {commissionKind === 'formula_advanced' ? (
              <div className="space-y-2">
                <Label htmlFor="dn-formula">Formula</Label>
                <Input
                  id="dn-formula"
                  value={formulaText}
                  onChange={(e) => setFormulaText(e.target.value)}
                  placeholder="e.g. 10% of closer draw + $2k kicker"
                />
                <p className="text-xs text-muted-foreground">
                  Supports expressions like % of salary, % of another participant, etc. (Preview is static
                  in this demo — no live parsing.)
                </p>
              </div>
            ) : null}

            <div className="rounded-md border bg-background px-3 py-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Preview</p>
              <p className="text-foreground">{commissionPreview.previewLine}</p>
              <p className="mt-1 font-semibold tabular-nums">
                Total commission pool: ${commissionPreview.total.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payout trigger</Label>
            <Select value={payoutTrigger} onValueChange={setPayoutTrigger}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Contract Signed">Contract Signed</SelectItem>
                <SelectItem value="Contract Paid">Contract Paid</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dn-intro">Introducer (attribution)</Label>
            <Input
              id="dn-intro"
              value={introducer}
              onChange={(e) => setIntroducer(e.target.value)}
              placeholder="Who gets introducer credit"
              required
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
              required
            />
            <p className="text-xs text-muted-foreground">Enter manually (not sourced from the graph in this demo).</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!companyId || !contactId}>
              Add to pipeline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
