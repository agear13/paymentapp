'use client';

import * as React from 'react';
import { CalendarRange } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import type { AgreementCommercialTiming } from '@/lib/commercial-timing/types';
import { formatYearMonth } from '@/lib/commercial-timing/serialization';

type CommercialTimingSectionProps = {
  timing: AgreementCommercialTiming;
  onChange: (timing: AgreementCommercialTiming) => void;
  disabled?: boolean;
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toMonthInputValue(ym: AgreementCommercialTiming['recognitionPeriod']): string {
  if (!ym) return '';
  return formatYearMonth(ym);
}

function fromMonthInputValue(value: string): AgreementCommercialTiming['recognitionPeriod'] {
  if (!value) return null;
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function CommercialTimingSection({
  timing,
  onChange,
  disabled,
}: CommercialTimingSectionProps) {
  const update = React.useCallback(
    (patch: Partial<AgreementCommercialTiming>) => {
      onChange({ ...timing, ...patch });
    },
    [onChange, timing]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          {PRODUCT_TERMINOLOGY.commercialTiming}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {PRODUCT_TERMINOLOGY.commercialTimingHelper}
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{PRODUCT_TERMINOLOGY.servicePeriod}</CardTitle>
          <CardDescription className="text-xs">
            When the commercial deliverable or service occurs
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <TimingDateField
            id="service-period-start"
            label="Start"
            value={toDateInputValue(timing.servicePeriodStart)}
            onChange={(v) => update({ servicePeriodStart: fromDateInputValue(v) })}
            disabled={disabled}
          />
          <TimingDateField
            id="service-period-end"
            label="End"
            value={toDateInputValue(timing.servicePeriodEnd)}
            onChange={(v) => update({ servicePeriodEnd: fromDateInputValue(v) })}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {PRODUCT_TERMINOLOGY.recognitionPeriod}
            </CardTitle>
            <CardDescription className="text-xs">
              Month for revenue or cost recognition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimingMonthField
              id="recognition-period"
              value={toMonthInputValue(timing.recognitionPeriod)}
              onChange={(v) => update({ recognitionPeriod: fromMonthInputValue(v) })}
              disabled={disabled}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {PRODUCT_TERMINOLOGY.expectedCustomerPayment}
            </CardTitle>
            <CardDescription className="text-xs">
              When customer payment is expected commercially
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimingDateField
              id="expected-payment-date"
              label="Expected date"
              value={toDateInputValue(timing.expectedPaymentDate)}
              onChange={(v) => update({ expectedPaymentDate: fromDateInputValue(v) })}
              disabled={disabled}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {PRODUCT_TERMINOLOGY.expectedParticipantSettlement}
            </CardTitle>
            <CardDescription className="text-xs">
              When participant settlement is expected
            </CardDescription>
          </CardHeader>
          <CardContent className="sm:max-w-xs">
            <TimingDateField
              id="expected-settlement-date"
              label="Expected date"
              value={toDateInputValue(timing.expectedSettlementDate)}
              onChange={(v) => update({ expectedSettlementDate: fromDateInputValue(v) })}
              disabled={disabled}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimingDateField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}

function TimingMonthField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Month
      </Label>
      <Input
        id={id}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}
