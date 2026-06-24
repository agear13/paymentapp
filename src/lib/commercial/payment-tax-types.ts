/**
 * Payment & Tax Information — extended payment method and tax residency types.
 * Maps to SupplierPaymentDetails on submission for backwards compatibility.
 */

export const PAYMENT_METHOD_TYPES = [
  'bank_account_australia',
  'wise',
  'revolut',
  'payid',
  'crypto_wallet',
  'qr_code',
  'other',
] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  bank_account_australia: 'Australian Bank Account',
  wise: 'Wise',
  revolut: 'Revolut',
  payid: 'PayID',
  crypto_wallet: 'Crypto Wallet',
  qr_code: 'Upload QR Code',
  other: 'Other',
};

export const TAX_RESIDENCY_COUNTRIES = [
  'australia',
  'new_zealand',
  'united_states',
  'united_kingdom',
  'singapore',
  'other',
] as const;

export type TaxResidencyCountry = (typeof TAX_RESIDENCY_COUNTRIES)[number];

export const TAX_RESIDENCY_LABELS: Record<TaxResidencyCountry, string> = {
  australia: 'Australia',
  new_zealand: 'New Zealand',
  united_states: 'United States',
  united_kingdom: 'United Kingdom',
  singapore: 'Singapore',
  other: 'Other',
};

export type PaymentMethodDetails = {
  methodType: PaymentMethodType;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  wiseEmail?: string | null;
  wiseAccount?: string | null;
  revolutUsername?: string | null;
  payId?: string | null;
  cryptoNetwork?: string | null;
  cryptoWalletAddress?: string | null;
  otherDescription?: string | null;
  qrAttachmentId?: string | null;
};

export type TaxResidencyDetails = {
  country: TaxResidencyCountry;
  abn?: string | null;
  businessName?: string | null;
  gstRegistered?: 'yes' | 'no' | 'not_applicable' | null;
  businessRegistrationNumber?: string | null;
  taxIdentificationNumber?: string | null;
  taxNotApplicable?: boolean;
  abnVerificationSource?: 'abr' | 'checksum' | 'not_applicable' | null;
  abnVerified?: boolean;
};

export function isAustralianTaxResidency(country: TaxResidencyCountry): boolean {
  return country === 'australia';
}

export function mapPaymentMethodToSupplierPayment(details: PaymentMethodDetails): {
  preference: 'bank_account' | 'alternative';
  bankDetails: {
    accountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
  };
  alternativePaymentMethod: string | null;
  methodType: PaymentMethodType;
  extendedDetails: PaymentMethodDetails;
} {
  if (details.methodType === 'bank_account_australia') {
    return {
      preference: 'bank_account',
      bankDetails: {
        accountName: details.bankAccountName ?? null,
        bsb: details.bankBsb ?? null,
        accountNumber: details.bankAccountNumber ?? null,
      },
      alternativePaymentMethod: null,
      methodType: details.methodType,
      extendedDetails: details,
    };
  }

  const label = PAYMENT_METHOD_LABELS[details.methodType];
  let alt = label;
  if (details.methodType === 'wise') {
    alt = `Wise — ${details.wiseEmail ?? ''} ${details.wiseAccount ?? ''}`.trim();
  } else if (details.methodType === 'revolut') {
    alt = `Revolut — ${details.revolutUsername ?? ''}`.trim();
  } else if (details.methodType === 'payid') {
    alt = `PayID — ${details.payId ?? ''}`.trim();
  } else if (details.methodType === 'crypto_wallet') {
    alt = `Crypto — ${details.cryptoNetwork ?? ''} ${details.cryptoWalletAddress ?? ''}`.trim();
  } else if (details.methodType === 'qr_code') {
    alt = 'QR code payment (see attachment)';
  } else if (details.methodType === 'other') {
    alt = details.otherDescription ?? 'Other payment method';
  }

  return {
    preference: 'alternative',
    bankDetails: { accountName: null, bsb: null, accountNumber: null },
    alternativePaymentMethod: alt,
    methodType: details.methodType,
    extendedDetails: details,
  };
}

export function mapTaxToSupplierGst(
  tax: TaxResidencyDetails
): { gstStatus: 'yes' | 'no' | 'not_applicable' | 'pending'; abnInput: {
  abn: string | null;
  abnNotApplicable: boolean;
  abnVerified: boolean;
  businessName: string | null;
} } {
  if (!isAustralianTaxResidency(tax.country)) {
    return {
      gstStatus: 'not_applicable',
      abnInput: {
        abn: tax.taxIdentificationNumber ?? tax.businessRegistrationNumber ?? null,
        abnNotApplicable: tax.taxNotApplicable ?? true,
        abnVerified: false,
        businessName: null,
      },
    };
  }

  const gstStatus =
    tax.gstRegistered === 'yes'
      ? 'yes'
      : tax.gstRegistered === 'no'
      ? 'no'
      : tax.gstRegistered === 'not_applicable'
      ? 'not_applicable'
      : 'pending';

  return {
    gstStatus,
    abnInput: {
      abn: tax.abn ?? null,
      abnNotApplicable: false,
      abnVerified: tax.abnVerified ?? false,
      businessName: tax.businessName ?? null,
    },
  };
}
