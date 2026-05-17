'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type {
  ParticipantReferralCommerce,
  ReferralCommissionMode,
} from '@/lib/referrals/referral-commerce-config';

export type OrganizationServiceOption = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
};

type Props = {
  organizationId: string | null;
  value: ParticipantReferralCommerce;
  onChange: (next: ParticipantReferralCommerce) => void;
  disabled?: boolean;
  /** Operational project workspace copy vs legacy pilot labels. */
  tone?: 'pilot' | 'operational';
  /** When parent controls the enable toggle, hide the checkbox row. */
  hideEnableToggle?: boolean;
};

export function ReferralCommerceSection({
  organizationId,
  value,
  onChange,
  disabled,
  tone = 'pilot',
  hideEnableToggle = false,
}: Props) {
  const operational = tone === 'operational';
  const [services, setServices] = React.useState<OrganizationServiceOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (!organizationId || !value.createReferralLink) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/organization-services?organizationId=${organizationId}&status=active`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const rows = (json.data ?? json.services ?? []) as OrganizationServiceOption[];
        setServices(
          rows.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? '',
            price: Number(s.price),
            currency: s.currency,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, value.createReferralLink]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [services, search]);

  const enabledSet = React.useMemo(
    () => new Set(value.enabledServiceIds ?? []),
    [value.enabledServiceIds]
  );

  function patch(partial: Partial<ParticipantReferralCommerce>) {
    onChange({ ...value, ...partial });
  }

  function toggleService(id: string, checked: boolean) {
    const cur = new Set(value.enabledServiceIds ?? []);
    if (checked) cur.add(id);
    else cur.delete(id);
    patch({ enabledServiceIds: [...cur] });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div>
        <p className="text-sm font-medium">
          {operational ? 'Attributable revenue participation' : 'Referral commerce'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {operational
            ? 'Issue a trackable customer link and configure how attributable revenue is recognized.'
            : 'Configure referral link issuance and how this participant earns commission.'}
        </p>
      </div>

      {!hideEnableToggle ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="ref-create-link"
            checked={value.createReferralLink !== false}
            disabled={disabled}
            onCheckedChange={(c) => patch({ createReferralLink: c === true })}
          />
          <Label htmlFor="ref-create-link" className="font-normal cursor-pointer">
            {operational
              ? 'Enable customer attribution tracking'
              : 'Create referral link for participant'}
          </Label>
        </div>
      ) : null}

      {value.createReferralLink !== false ? (
        <>
          <RadioGroup
            value={value.commissionMode}
            disabled={disabled}
            onValueChange={(v) => patch({ commissionMode: v as ReferralCommissionMode })}
            className="space-y-2"
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="project_revenue_share" id="mode-project" className="mt-1" />
              <div>
                <Label htmlFor="mode-project" className="font-medium cursor-pointer">
                  {operational ? 'Revenue participation (project)' : 'Project revenue share'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {operational
                    ? 'Uses the fixed payout or revenue share configured above.'
                    : 'Uses deal/project commission above (percentage or fixed).'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="referral_commerce" id="mode-commerce" className="mt-1" />
              <div>
                <Label htmlFor="mode-commerce" className="font-medium cursor-pointer">
                  {operational ? 'Customer attribution earnings' : 'Referral commerce attribution'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {operational
                    ? 'Participant earns from attributable purchases through their trackable customer link.'
                    : "Commission only when customers buy selected services through this participant's link."}
                </p>
              </div>
            </div>
          </RadioGroup>

          {value.commissionMode === 'referral_commerce' ? (
            <div className="space-y-3 pl-1 border-l-2 border-muted ml-1">
              <div className="space-y-2">
                <Label htmlFor="commerce-pct">
                  {operational ? 'Revenue share on attributable purchases (%)' : 'Commission on each service sale (%)'}
                </Label>
                <Input
                  id="commerce-pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  disabled={disabled}
                  value={value.commerceCommissionPct ?? 10}
                  onChange={(e) =>
                    patch({ commerceCommissionPct: parseFloat(e.target.value) || 0 })
                  }
                  className="max-w-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {operational ? 'Services on trackable customer link' : 'Services available on referral link'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {operational
                    ? 'Leave all unchecked to allow every active service. Select specific services to restrict the payment link.'
                    : 'Leave all unchecked to allow every active service. Select specific services to restrict the landing page.'}
                </p>
                {!organizationId ? (
                  <p className="text-xs text-amber-700">Organization required to load services.</p>
                ) : loading ? (
                  <p className="text-xs text-muted-foreground">Loading services…</p>
                ) : services.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active services — add services in Settings → Services.
                  </p>
                ) : (
                  <>
                    <Input
                      placeholder="Search services…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      disabled={disabled}
                    />
                    <ul className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2 bg-background">
                      {filtered.map((s) => (
                        <li key={s.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            id={`svc-${s.id}`}
                            checked={enabledSet.has(s.id)}
                            disabled={disabled}
                            onCheckedChange={(c) => toggleService(s.id, c === true)}
                          />
                          <label htmlFor={`svc-${s.id}`} className="cursor-pointer flex-1">
                            <span className="font-medium">{s.name}</span>
                            <span className="text-muted-foreground ml-2">
                              {s.price.toFixed(2)} {s.currency}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
