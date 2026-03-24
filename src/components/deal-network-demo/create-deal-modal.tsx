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
  type RhCompany,
  type RhContact,
} from '@/lib/data/mock-rabbit-hole-network';
import {
  COMMISSION_STRUCTURE_OPTIONS,
  type BaseParticipantSlot,
  type CommissionStructureKind,
  computeDealCommissionTotal,
  BASE_PARTICIPANT_OPTIONS,
} from '@/lib/deal-network-demo/commission-structure';

const PAYOUT_TRIGGER_MANUAL = 'Manual' as const;

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

  const [commissionKind, setCommissionKind] = React.useState<CommissionStructureKind>('pct_deal_value');
  const [commissionPctDeal, setCommissionPctDeal] = React.useState('20');
  const [commissionFixed, setCommissionFixed] = React.useState('20000');
  const [commissionBaseParticipant, setCommissionBaseParticipant] =
    React.useState<BaseParticipantSlot>('Closer');
  const [commissionPctOfParticipant, setCommissionPctOfParticipant] = React.useState('5');
  const [formulaText, setFormulaText] = React.useState('');

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

  const valueOk = !Number.isNaN(dealValueNum) && dealValueNum > 0;
  const hasPartner = Boolean(companyId && contactId && company && contact);
  const canSubmit =
    Boolean(dealName.trim()) &&
    hasPartner &&
    valueOk &&
    Boolean(introducer.trim() && closer.trim()) &&
    commissionPreview.total > 0;

  React.useEffect(() => {
    if (!open) {
      setDealName('');
      setCompanyId('');
      setContactId('');
      setDealValue('');
      setIntroducer('');
      setGraphIntroducer('');
      setCloser('');
      setCompanyOpen(false);
      setContactOpen(false);
      setManualPartnerMode(false);
      setManualPartnerName('');
      setManualContactName('');
      setManualEmail('');
      setManualRole('');
      setCommissionKind('pct_deal_value');
      setCommissionPctDeal('20');
      setCommissionFixed('20000');
      setCommissionBaseParticipant('Closer');
      setCommissionPctOfParticipant('5');
      setFormulaText('');
    }
  }, [open]);

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
    const value = parseFloat(dealValue.replace(/,/g, ''));
    if (!canSubmit || !company || !contact) return;

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
      payoutTrigger: PAYOUT_TRIGGER_MANUAL,
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
            Pull partner and contact context from the Rabbit Hole network graph (demo), or add a partner
            not yet in the graph. Configure how the total commission pool is calculated.
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

          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Payout is triggered manually when the contract is marked as paid on the deal card.
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

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Create Deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
