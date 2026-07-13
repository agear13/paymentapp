import type {
  CommercialTimingFieldKey,
  CommercialTimingFields,
} from '@/lib/commercial-timing/types';

/** Assign a resolved timing field without indexed-access union errors. */
export function assignCommercialTimingField(
  target: CommercialTimingFields,
  key: CommercialTimingFieldKey,
  value: NonNullable<CommercialTimingFields[CommercialTimingFieldKey]>
): void {
  switch (key) {
    case 'servicePeriodStart':
      target.servicePeriodStart = value as string;
      break;
    case 'servicePeriodEnd':
      target.servicePeriodEnd = value as string;
      break;
    case 'recognitionPeriod':
      target.recognitionPeriod = value as NonNullable<
        CommercialTimingFields['recognitionPeriod']
      >;
      break;
    case 'expectedPaymentDate':
      target.expectedPaymentDate = value as string;
      break;
    case 'expectedSettlementDate':
      target.expectedSettlementDate = value as string;
      break;
  }
}
