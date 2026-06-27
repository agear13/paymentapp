/**
 * Supplier Onboarding Engine — Regression Tests
 *
 * Comprehensive test suite for supplier-onboarding.ts.
 *
 * Covers:
 *   ✓ Draft invoice generation (auto-populated from agreement)
 *   ✓ Invoice populated from agreement data
 *   ✓ Bank details validation (BSB, account number, account name)
 *   ✓ Alternative payment methods
 *   ✓ ABN checksum validation (ATO algorithm)
 *   ✓ Manual review path for Not Applicable ABN
 *   ✓ GST Yes (invoice updated, totals recalculated)
 *   ✓ GST No (invoice is ex-GST)
 *   ✓ GST Not Applicable (operator review required)
 *   ✓ Invoice total recalculation when GST changes
 *   ✓ Operator approval flow
 *   ✓ Xero export readiness
 *   ✓ Timeline events
 *   ✓ Stage derivation
 *   ✓ Workspace-level aggregation
 *   ✓ Provvy narrative
 *   ✓ James Tourism Scenario (full lifecycle)
 *   ✓ Determinism
 *   ✓ Non-mutation
 *   ✓ Duplicate calculation invariants
 */

const {
  generateDraftInvoice,
  validateABN,
  validateBankDetails,
  deriveSupplierOnboardingStatus,
  deriveWorkspaceOnboardingStatus,
  buildSupplierOnboardingNarrative,
} = require('../../lib/commercial/supplier-onboarding');

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

const PROJECT_ID = 'proj-tourism-001';
const CURRENT_DATE = '2024-06-15T00:00:00Z';

function makeAgreement(overrides = {}) {
  return {
    approved: true,
    approvedAt: '2024-06-10T09:00:00Z',
    agreementReference: 'SUNSET-2024',
    projectName: 'Sunset Sessions Tourism',
    ...overrides,
  };
}

function makeObligation(overrides = {}) {
  return {
    amount: 8000,
    currency: 'AUD',
    type: 'fixed_fee',
    description: 'Venue management services',
    revenueSharePercent: null,
    condition: null,
    dueDate: '2024-08-15',
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    preference: 'bank_account',
    bankDetails: {
      accountName: 'Sarah Chen',
      bsb: '063000',
      accountNumber: '12345678',
    },
    alternativePaymentMethod: null,
    ...overrides,
  };
}

function makeABN(overrides = {}) {
  return {
    abn: '51824753556', // Valid ABN (ATO test number)
    abnNotApplicable: false,
    abnVerified: true,
    businessName: null,
    ...overrides,
  };
}

function makeGST(overrides = {}) {
  return {
    gstStatus: 'yes',
    ...overrides,
  };
}

function makeSubmission(overrides = {}) {
  return {
    submittedAt: '2024-06-12T14:00:00Z',
    declarationAccepted: true,
    ...overrides,
  };
}

function makeOperator(overrides = {}) {
  return {
    approvedAt: null,
    xeroExportedAt: null,
    notes: null,
    ...overrides,
  };
}

function makeInput(overrides = {}) {
  return {
    projectId: PROJECT_ID,
    participant: {
      id: 'sarah-001',
      name: 'Sarah Chen',
      role: 'Venue Manager',
      email: 'sarah@example.com',
    },
    agreement: makeAgreement(),
    obligation: makeObligation(),
    payment: makePayment(),
    abn: makeABN(),
    gst: makeGST(),
    submission: makeSubmission(),
    operator: makeOperator(),
    currentDate: CURRENT_DATE,
    ...overrides,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   1. DRAFT INVOICE GENERATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('generateDraftInvoice', () => {
  test('generates a deterministic invoice ID', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.invoiceId).toBe(`${PROJECT_ID}:sarah-001:supplier_invoice`);
  });

  test('auto-populates participant name and role', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.participantName).toBe('Sarah Chen');
    expect(invoice.participantRole).toBe('Venue Manager');
  });

  test('auto-populates project name and agreement reference', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.projectName).toBe('Sunset Sessions Tourism');
    expect(invoice.agreementReference).toBe('SUNSET-2024');
  });

  test('populates line items from obligation data', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0].description).toBe('Venue management services');
    expect(invoice.lineItems[0].unitAmount).toBe(8000);
  });

  test('calculates GST when gstStatus is yes', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'yes' }) }));
    expect(invoice.gstAmount).toBe(800); // 10% of 8000
    expect(invoice.total).toBe(8800);
    expect(invoice.subtotal).toBe(8000);
  });

  test('excludes GST when gstStatus is no', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'no' }) }));
    expect(invoice.gstAmount).toBeNull();
    expect(invoice.total).toBe(8000);
  });

  test('excludes GST when gstStatus is pending', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'pending' }) }));
    expect(invoice.gstAmount).toBeNull();
    expect(invoice.total).toBe(8000);
  });

  test('excludes GST when gstStatus is not_applicable', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'not_applicable' }) }));
    expect(invoice.gstAmount).toBeNull();
    expect(invoice.total).toBe(8000);
  });

  test('sets dueDate from obligation', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.dueDate).toBe('2024-08-15');
  });

  test('builds commercialReference from agreement reference and participant', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.commercialReference).toBe('SUNSET-2024:sarah-001');
  });

  test('sets generatedAt to currentDate', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.generatedAt).toBe(CURRENT_DATE);
  });

  test('sets confirmedAt from submission.submittedAt', () => {
    const invoice = generateDraftInvoice(makeInput());
    expect(invoice.confirmedAt).toBe('2024-06-12T14:00:00Z');
  });

  test('sets approvedAt from operator.approvedAt', () => {
    const input = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const invoice = generateDraftInvoice(input);
    expect(invoice.approvedAt).toBe('2024-06-14T10:00:00Z');
  });

  test('generates revenue share line item', () => {
    const input = makeInput({
      obligation: makeObligation({
        type: 'revenue_share',
        revenueSharePercent: 15,
        amount: 7500,
        description: null,
      }),
    });
    const invoice = generateDraftInvoice(input);
    expect(invoice.lineItems[0].description).toContain('15% revenue share');
  });

  test('generates conditional line item', () => {
    const input = makeInput({
      obligation: makeObligation({
        type: 'conditional',
        amount: 2000,
        condition: 'Attendance exceeds 500',
        description: null,
      }),
    });
    const invoice = generateDraftInvoice(input);
    expect(invoice.lineItems[0].description).toContain('Attendance exceeds 500');
  });

  test('falls back to default description when obligation description is null', () => {
    const input = makeInput({
      obligation: makeObligation({ description: null }),
    });
    const invoice = generateDraftInvoice(input);
    expect(typeof invoice.lineItems[0].description).toBe('string');
    expect(invoice.lineItems[0].description.length).toBeGreaterThan(0);
  });

  test('sets tax type GST when gstStatus is yes', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'yes' }) }));
    expect(invoice.lineItems[0].taxType).toBe('GST');
  });

  test('sets tax type EXEMPT when gstStatus is no', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'no' }) }));
    expect(invoice.lineItems[0].taxType).toBe('EXEMPT');
  });

  test('sets tax type PENDING when gstStatus is pending', () => {
    const invoice = generateDraftInvoice(makeInput({ gst: makeGST({ gstStatus: 'pending' }) }));
    expect(invoice.lineItems[0].taxType).toBe('PENDING');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   2. ABN VALIDATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('validateABN', () => {
  // Valid Australian ABNs (publicly known valid numbers)
  const VALID_ABNS = [
    '51824753556',  // ATO example
    '53004085616',  // Commonwealth Bank
  ];

  VALID_ABNS.forEach((abn) => {
    test(`validates valid ABN: ${abn}`, () => {
      const result = validateABN(abn);
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeNull();
    });
  });

  test('formats valid ABN as XX XXX XXX XXX', () => {
    const result = validateABN('51824753556');
    expect(result.formattedABN).toBe('51 824 753 556');
  });

  test('strips spaces and validates', () => {
    const result = validateABN('51 824 753 556');
    expect(result.isValid).toBe(true);
  });

  test('strips hyphens and validates', () => {
    const result = validateABN('51-824-753-556');
    expect(result.isValid).toBe(true);
  });

  test('rejects ABN with wrong checksum', () => {
    const result = validateABN('12345678901');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  test('rejects ABN with fewer than 11 digits', () => {
    const result = validateABN('1234567890');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('11 digits');
  });

  test('rejects ABN with more than 11 digits', () => {
    const result = validateABN('123456789012');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('11 digits');
  });

  test('rejects non-numeric ABN', () => {
    const result = validateABN('ABCDEFGHIJK');
    expect(result.isValid).toBe(false);
  });

  test('returns error for empty ABN', () => {
    const result = validateABN('');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  test('returns error for null ABN', () => {
    const result = validateABN(null);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  test('notApplicable returns requiresManualReview: true', () => {
    const result = validateABN(null, true);
    expect(result.isNotApplicable).toBe(true);
    expect(result.requiresManualReview).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  test('valid ABN does not require manual review', () => {
    const result = validateABN('51824753556');
    expect(result.requiresManualReview).toBe(false);
  });

  test('invalid ABN does not require manual review (supplier must fix)', () => {
    const result = validateABN('12345678901');
    expect(result.requiresManualReview).toBe(false);
  });

  test('valid ABN sets abnStatus to Active', () => {
    const result = validateABN('51824753556');
    expect(result.abnStatus).toBe('Active');
  });

  test('businessName is null pending ABR integration', () => {
    const result = validateABN('51824753556');
    expect(result.businessName).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   3. BANK DETAILS VALIDATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('validateBankDetails', () => {
  test('passes with valid BSB, account number, and name', () => {
    const result = validateBankDetails('Sarah Chen', '063000', '12345678');
    expect(result.isComplete).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('passes with hyphenated BSB', () => {
    const result = validateBankDetails('Sarah Chen', '063-000', '12345678');
    expect(result.bsbValid).toBe(true);
  });

  test('rejects BSB with fewer than 6 digits', () => {
    const result = validateBankDetails('Sarah Chen', '06300', '12345678');
    expect(result.bsbValid).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  test('rejects BSB with more than 6 digits', () => {
    const result = validateBankDetails('Sarah Chen', '0630000', '12345678');
    expect(result.bsbValid).toBe(false);
  });

  test('accepts account number with 6 digits', () => {
    const result = validateBankDetails('Sarah Chen', '063000', '123456');
    expect(result.accountNumberValid).toBe(true);
  });

  test('accepts account number with 9 digits', () => {
    const result = validateBankDetails('Sarah Chen', '063000', '123456789');
    expect(result.accountNumberValid).toBe(true);
  });

  test('rejects account number with 5 digits', () => {
    const result = validateBankDetails('Sarah Chen', '063000', '12345');
    expect(result.accountNumberValid).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  test('rejects account number with 10 digits', () => {
    const result = validateBankDetails('Sarah Chen', '063000', '1234567890');
    expect(result.accountNumberValid).toBe(false);
  });

  test('rejects empty account name', () => {
    const result = validateBankDetails('', '063000', '12345678');
    expect(result.accountNameValid).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  test('rejects null account name', () => {
    const result = validateBankDetails(null, '063000', '12345678');
    expect(result.accountNameValid).toBe(false);
  });

  test('returns multiple errors when multiple fields invalid', () => {
    const result = validateBankDetails('', '123', '12');
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.isComplete).toBe(false);
  });

  test('strips spaces from account number', () => {
    const result = validateBankDetails('Sarah Chen', '063000', '1234 5678');
    expect(result.accountNumberValid).toBe(true);
    expect(result.accountNumber).toBe('12345678');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   4. STAGE DERIVATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('Stage derivation', () => {
  test('not_started when agreement not approved', () => {
    const input = makeInput({ agreement: makeAgreement({ approved: false }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.stage).toBe('not_started');
  });

  test('invoice_generated when approved but no data entered', () => {
    const input = makeInput({
      payment: { preference: 'bank_account', bankDetails: { accountName: null, bsb: null, accountNumber: null }, alternativePaymentMethod: null },
      abn: makeABN({ abn: null, abnNotApplicable: false }),
      gst: makeGST({ gstStatus: 'pending' }),
      submission: makeSubmission({ submittedAt: null, declarationAccepted: false }),
    });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.stage).toBe('invoice_generated');
  });

  test('in_progress when some data entered but not submitted', () => {
    const input = makeInput({
      submission: makeSubmission({ submittedAt: null, declarationAccepted: false }),
    });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.stage).toBe('in_progress');
  });

  test('submitted when submission complete', () => {
    const input = makeInput({ submission: makeSubmission(), operator: makeOperator() });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.stage).toBe('submitted');
  });

  test('operator_approved when operator.approvedAt is set', () => {
    const input = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.stage).toBe('operator_approved');
  });

  test('xero_exported when operator.xeroExportedAt is set', () => {
    const input = makeInput({
      operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z', xeroExportedAt: '2024-06-14T12:00:00Z' }),
    });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.stage).toBe('xero_exported');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   5. CHECKLIST
   ════════════════════════════════════════════════════════════════════════════ */

describe('Onboarding checklist', () => {
  test('has 6 items', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    expect(status.checklist).toHaveLength(6);
  });

  test('all items complete after full submission and approval', () => {
    const input = makeInput({
      operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }),
    });
    const status = deriveSupplierOnboardingStatus(input);
    const incomplete = status.checklist.filter((i) => i.status !== 'complete');
    expect(incomplete).toHaveLength(0);
  });

  test('payment_details is complete with valid bank details', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const item = status.checklist.find((i) => i.id === 'payment_details');
    expect(item.status).toBe('complete');
    expect(item.isBlocker).toBe(false);
  });

  test('payment_details is in_progress with partial bank details', () => {
    const input = makeInput({
      payment: { preference: 'bank_account', bankDetails: { accountName: 'Sarah', bsb: null, accountNumber: null }, alternativePaymentMethod: null },
      submission: makeSubmission({ submittedAt: null, declarationAccepted: false }),
    });
    const status = deriveSupplierOnboardingStatus(input);
    const item = status.checklist.find((i) => i.id === 'payment_details');
    expect(item.status).toBe('in_progress');
  });

  test('payment_details requires_review with alternative payment method', () => {
    const input = makeInput({
      payment: { preference: 'alternative', bankDetails: { accountName: null, bsb: null, accountNumber: null }, alternativePaymentMethod: 'USDC wallet' },
    });
    const status = deriveSupplierOnboardingStatus(input);
    const item = status.checklist.find((i) => i.id === 'payment_details');
    expect(item.status).toBe('requires_review');
    expect(item.isBlocker).toBe(false);
  });

  test('abn is complete with valid ABN', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const item = status.checklist.find((i) => i.id === 'abn');
    expect(item.status).toBe('complete');
    expect(item.isBlocker).toBe(false);
  });

  test('abn is in_progress with invalid ABN entered', () => {
    const input = makeInput({ abn: makeABN({ abn: '12345678901' }) });
    const status = deriveSupplierOnboardingStatus(input);
    const item = status.checklist.find((i) => i.id === 'abn');
    expect(item.status).toBe('in_progress');
    expect(item.isBlocker).toBe(true);
  });

  test('abn requires_review when not applicable', () => {
    const input = makeInput({ abn: makeABN({ abn: null, abnNotApplicable: true }) });
    const status = deriveSupplierOnboardingStatus(input);
    const item = status.checklist.find((i) => i.id === 'abn');
    expect(item.status).toBe('requires_review');
    expect(item.isBlocker).toBe(false);
  });

  test('gst_status complete when yes or no', () => {
    for (const gstStatus of ['yes', 'no']) {
      const input = makeInput({ gst: makeGST({ gstStatus }) });
      const status = deriveSupplierOnboardingStatus(input);
      const item = status.checklist.find((i) => i.id === 'gst_status');
      expect(item.status).toBe('complete');
    }
  });

  test('gst_status requires_review when not_applicable', () => {
    const input = makeInput({ gst: makeGST({ gstStatus: 'not_applicable' }) });
    const status = deriveSupplierOnboardingStatus(input);
    const item = status.checklist.find((i) => i.id === 'gst_status');
    expect(item.status).toBe('requires_review');
    expect(item.isBlocker).toBe(false);
  });

  test('declaration is complete when submitted', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const item = status.checklist.find((i) => i.id === 'declaration');
    expect(item.status).toBe('complete');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   6. XERO READINESS
   ════════════════════════════════════════════════════════════════════════════ */

describe('Xero readiness', () => {
  test('readyForXeroExport is false without operator approval', () => {
    const status = deriveSupplierOnboardingStatus(makeInput({ operator: makeOperator() }));
    expect(status.readyForXeroExport).toBe(false);
  });

  test('readyForXeroExport is true after operator approval with no blockers', () => {
    const input = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.readyForXeroExport).toBe(true);
  });

  test('requires manual review when ABN is not applicable', () => {
    const input = makeInput({ abn: makeABN({ abn: null, abnNotApplicable: true }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.requiresManualReview).toBe(true);
  });

  test('requires manual review when alternative payment method used', () => {
    const input = makeInput({
      payment: { preference: 'alternative', bankDetails: { accountName: null, bsb: null, accountNumber: null }, alternativePaymentMethod: 'PayPal' },
    });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.requiresManualReview).toBe(true);
  });

  test('does not require manual review for standard bank + valid ABN + GST confirmed', () => {
    const input = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.requiresManualReview).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   7. INVOICE GST RECALCULATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('Invoice GST recalculation', () => {
  test('invoice total is $8,800 when GST is yes (8000 + 800)', () => {
    const status = deriveSupplierOnboardingStatus(makeInput({ gst: makeGST({ gstStatus: 'yes' }) }));
    expect(status.draftInvoice.total).toBe(8800);
    expect(status.draftInvoice.gstAmount).toBe(800);
  });

  test('invoice total is $8,000 when GST is no', () => {
    const status = deriveSupplierOnboardingStatus(makeInput({ gst: makeGST({ gstStatus: 'no' }) }));
    expect(status.draftInvoice.total).toBe(8000);
    expect(status.draftInvoice.gstAmount).toBeNull();
  });

  test('invoice total is $8,000 when GST is not_applicable', () => {
    const status = deriveSupplierOnboardingStatus(makeInput({ gst: makeGST({ gstStatus: 'not_applicable' }) }));
    expect(status.draftInvoice.total).toBe(8000);
    expect(status.draftInvoice.gstAmount).toBeNull();
  });

  test('invoice reflects obligation amount correctly', () => {
    const input = makeInput({ obligation: makeObligation({ amount: 12500 }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.draftInvoice.subtotal).toBe(12500);
    expect(status.draftInvoice.total).toBe(13750); // 12500 + 1250 GST
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   8. TIMELINE EVENTS
   ════════════════════════════════════════════════════════════════════════════ */

describe('Timeline events', () => {
  test('generates invoice_generated event when agreement is approved', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const event = status.timelineEvents.find((e) => e.type === 'supplier_invoice_generated');
    expect(event).toBeDefined();
    expect(event.participantId).toBe('sarah-001');
  });

  test('generates abn_verified event when ABN is valid', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const event = status.timelineEvents.find((e) => e.type === 'supplier_abn_verified');
    expect(event).toBeDefined();
  });

  test('generates abn_manual_review event when ABN not applicable', () => {
    const input = makeInput({ abn: makeABN({ abn: null, abnNotApplicable: true }) });
    const status = deriveSupplierOnboardingStatus(input);
    const event = status.timelineEvents.find((e) => e.type === 'supplier_abn_manual_review');
    expect(event).toBeDefined();
  });

  test('does NOT generate abn_manual_review when ABN is valid', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const event = status.timelineEvents.find((e) => e.type === 'supplier_abn_manual_review');
    expect(event).toBeUndefined();
  });

  test('generates gst_confirmed event when GST is set', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const event = status.timelineEvents.find((e) => e.type === 'supplier_gst_confirmed');
    expect(event).toBeDefined();
    expect(event.description).toContain('GST');
  });

  test('generates alt_payment event when alternative method used', () => {
    const input = makeInput({
      payment: { preference: 'alternative', bankDetails: { accountName: null, bsb: null, accountNumber: null }, alternativePaymentMethod: 'Wise' },
    });
    const status = deriveSupplierOnboardingStatus(input);
    const event = status.timelineEvents.find((e) => e.type === 'supplier_alternative_payment_supplied');
    expect(event).toBeDefined();
    expect(event.description).toContain('Wise');
  });

  test('generates onboarding_completed event when submitted', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    const event = status.timelineEvents.find((e) => e.type === 'supplier_onboarding_completed');
    expect(event).toBeDefined();
  });

  test('generates invoice_approved event when operator approves', () => {
    const input = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const status = deriveSupplierOnboardingStatus(input);
    const event = status.timelineEvents.find((e) => e.type === 'supplier_invoice_approved');
    expect(event).toBeDefined();
    expect(event.occurredAt).toBe('2024-06-14T10:00:00Z');
  });

  test('generates xero_exported event when exported', () => {
    const input = makeInput({
      operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z', xeroExportedAt: '2024-06-14T12:00:00Z' }),
    });
    const status = deriveSupplierOnboardingStatus(input);
    const event = status.timelineEvents.find((e) => e.type === 'supplier_invoice_exported_to_xero');
    expect(event).toBeDefined();
  });

  test('all events have projectId and participantId', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    status.timelineEvents.forEach((e) => {
      expect(e.projectId).toBe(PROJECT_ID);
      expect(e.participantId).toBe('sarah-001');
    });
  });

  test('all events have non-empty title and commercialImpact', () => {
    const status = deriveSupplierOnboardingStatus(makeInput());
    status.timelineEvents.forEach((e) => {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.commercialImpact.length).toBeGreaterThan(0);
    });
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   9. WORKSPACE-LEVEL AGGREGATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('deriveWorkspaceOnboardingStatus', () => {
  function makeBenInput() {
    return {
      projectId: PROJECT_ID,
      participant: { id: 'ben-001', name: 'Ben Torres', role: 'Sound Engineer', email: null },
      agreement: makeAgreement(),
      obligation: makeObligation({ amount: 6000 }),
      payment: { preference: 'bank_account', bankDetails: { accountName: null, bsb: null, accountNumber: null }, alternativePaymentMethod: null },
      abn: makeABN({ abn: null }),
      gst: makeGST({ gstStatus: 'pending' }),
      submission: makeSubmission({ submittedAt: null, declarationAccepted: false }),
      operator: makeOperator(),
      currentDate: CURRENT_DATE,
    };
  }

  test('aggregates counts correctly', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput(), makeBenInput()]);
    expect(workspace.totalCount).toBe(2);
    expect(workspace.completedCount).toBe(0); // neither has operator approval
    expect(workspace.inProgressCount).toBeGreaterThan(0);
  });

  test('summary reflects correct counts', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput(), makeBenInput()]);
    expect(workspace.summary).toContain('/ 2');
  });

  test('pendingSuppliers lists suppliers needing attention', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput(), makeBenInput()]);
    expect(workspace.pendingSuppliers.length).toBeGreaterThan(0);
    const names = workspace.pendingSuppliers.map((s) => s.participantName);
    expect(names).toContain('Ben Torres');
  });

  test('primaryCta is null when all complete', () => {
    const approvedInput = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z', xeroExportedAt: '2024-06-14T12:00:00Z' }) });
    const workspace = deriveWorkspaceOnboardingStatus([approvedInput]);
    expect(workspace.primaryCta).toBeNull();
  });

  test('primaryCta mentions review when supplier submitted', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput()]); // submitted, awaiting review
    expect(workspace.primaryCta).toContain('Verify payout details');
  });

  test('readyForExportCount includes operator-approved participants', () => {
    const approved = makeInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const workspace = deriveWorkspaceOnboardingStatus([approved, makeBenInput()]);
    expect(workspace.readyForExportCount).toBe(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   10. PROVVY NARRATIVE
   ════════════════════════════════════════════════════════════════════════════ */

describe('buildSupplierOnboardingNarrative', () => {
  test('returns a non-empty string', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput()]);
    const narrative = buildSupplierOnboardingNarrative(workspace);
    expect(typeof narrative).toBe('string');
    expect(narrative.length).toBeGreaterThan(0);
  });

  test('mentions supplier count', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput()]);
    const narrative = buildSupplierOnboardingNarrative(workspace);
    expect(narrative).toMatch(/supplier/i);
  });

  test('ends with recommended action when there is a CTA', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeInput()]);
    const narrative = buildSupplierOnboardingNarrative(workspace);
    if (workspace.primaryCta) {
      expect(narrative).toContain('Recommended next action');
    }
  });

  test('mentions manual review suppliers when applicable', () => {
    const input = makeInput({ abn: makeABN({ abn: null, abnNotApplicable: true }) });
    const workspace = deriveWorkspaceOnboardingStatus([input]);
    const narrative = buildSupplierOnboardingNarrative(workspace);
    expect(narrative).toMatch(/verification/i);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   11. JAMES TOURISM SCENARIO
   Full lifecycle: Agreement Approved → Onboarding → Invoice → Xero
   ════════════════════════════════════════════════════════════════════════════ */

describe('James Tourism Scenario', () => {
  // James is the operator running Sunset Sessions.
  // Sarah Chen: Venue Manager, $8,000 fixed fee
  // Ben Torres: Sound Engineer, $6,000 fixed fee
  //
  // Both participants have approved their agreements.
  // James needs to collect their supplier details before pushing to Xero.

  function makeSarahInput(stageOverrides = {}) {
    return makeInput({
      participant: { id: 'sarah-001', name: 'Sarah Chen', role: 'Venue Manager', email: 'sarah@example.com' },
      obligation: makeObligation({ amount: 8000 }),
      ...stageOverrides,
    });
  }

  function makeBenInput(stageOverrides = {}) {
    return {
      projectId: PROJECT_ID,
      participant: { id: 'ben-001', name: 'Ben Torres', role: 'Sound Engineer', email: 'ben@example.com' },
      agreement: makeAgreement(),
      obligation: makeObligation({ amount: 6000, description: 'Sound engineering services' }),
      payment: makePayment({ bankDetails: { accountName: 'Ben Torres', bsb: '082080', accountNumber: '234567890' } }),
      abn: makeABN({ abn: '53004085616' }), // Commonwealth Bank ABN (public, valid)
      gst: makeGST({ gstStatus: 'no' }),
      submission: makeSubmission(),
      operator: makeOperator(),
      currentDate: CURRENT_DATE,
      ...stageOverrides,
    };
  }

  test('Stage 1: After agreement approval, invoice is auto-generated', () => {
    const sarahInput = makeSarahInput({ submission: makeSubmission({ submittedAt: null, declarationAccepted: false }), payment: { preference: 'bank_account', bankDetails: { accountName: null, bsb: null, accountNumber: null }, alternativePaymentMethod: null }, abn: makeABN({ abn: null }), gst: makeGST({ gstStatus: 'pending' }) });
    const status = deriveSupplierOnboardingStatus(sarahInput);
    expect(status.draftInvoice.invoiceId).toBeTruthy();
    expect(status.draftInvoice.subtotal).toBe(8000);
    expect(status.stage).toBe('invoice_generated');
  });

  test('Stage 2: Sarah completes onboarding with bank details, ABN and GST', () => {
    const status = deriveSupplierOnboardingStatus(makeSarahInput());
    expect(status.stage).toBe('submitted');
    expect(status.onboardingComplete).toBe(false); // not yet operator-approved
    expect(status.checklist.find((i) => i.id === 'declaration').status).toBe('complete');
  });

  test('Stage 3: Ben completes onboarding (ex-GST)', () => {
    const benStatus = deriveSupplierOnboardingStatus(makeBenInput());
    expect(benStatus.stage).toBe('submitted');
    expect(benStatus.draftInvoice.gstAmount).toBeNull();
    expect(benStatus.draftInvoice.total).toBe(6000);
  });

  test('Stage 4: Invoice GST calculated correctly (Sarah = yes, Ben = no)', () => {
    const sarahStatus = deriveSupplierOnboardingStatus(makeSarahInput());
    const benStatus = deriveSupplierOnboardingStatus(makeBenInput());
    expect(sarahStatus.draftInvoice.gstAmount).toBe(800);
    expect(sarahStatus.draftInvoice.total).toBe(8800);
    expect(benStatus.draftInvoice.gstAmount).toBeNull();
    expect(benStatus.draftInvoice.total).toBe(6000);
  });

  test('Stage 5: Operator sees workspace summary — 2 pending review', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeSarahInput(), makeBenInput()]);
    expect(workspace.totalCount).toBe(2);
    expect(workspace.inProgressCount + workspace.completedCount).toBeGreaterThanOrEqual(0);
    expect(workspace.primaryCta).toContain('Verify payout details');
  });

  test('Stage 6: Operator approves Sarah — ready for Xero', () => {
    const approved = makeSarahInput({ operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z' }) });
    const status = deriveSupplierOnboardingStatus(approved);
    expect(status.stage).toBe('operator_approved');
    expect(status.readyForXeroExport).toBe(true);
    const event = status.timelineEvents.find((e) => e.type === 'supplier_invoice_approved');
    expect(event).toBeDefined();
  });

  test('Stage 7: Sarah exported to Xero — timeline records the event', () => {
    const exported = makeSarahInput({
      operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z', xeroExportedAt: '2024-06-14T11:00:00Z' }),
    });
    const status = deriveSupplierOnboardingStatus(exported);
    expect(status.stage).toBe('xero_exported');
    const event = status.timelineEvents.find((e) => e.type === 'supplier_invoice_exported_to_xero');
    expect(event).toBeDefined();
  });

  test('Final: Workspace summary shows all complete after both exported', () => {
    const sarahExported = makeSarahInput({
      operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z', xeroExportedAt: '2024-06-14T11:00:00Z' }),
    });
    const benExported = makeBenInput({
      operator: makeOperator({ approvedAt: '2024-06-14T10:00:00Z', xeroExportedAt: '2024-06-14T11:00:00Z' }),
    });
    const workspace = deriveWorkspaceOnboardingStatus([sarahExported, benExported]);
    expect(workspace.completedCount).toBe(2);
    expect(workspace.primaryCta).toBeNull();
    expect(workspace.summary).toContain('All 2');
  });

  test('Provvy narrative is actionable throughout lifecycle', () => {
    const workspace = deriveWorkspaceOnboardingStatus([makeSarahInput(), makeBenInput()]);
    const narrative = buildSupplierOnboardingNarrative(workspace);
    expect(narrative.length).toBeGreaterThan(0);
    expect(narrative).toMatch(/supplier/i);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   12. DETERMINISM
   ════════════════════════════════════════════════════════════════════════════ */

describe('Determinism', () => {
  test('same inputs always produce same stage', () => {
    const input = makeInput();
    const r1 = deriveSupplierOnboardingStatus(input);
    const r2 = deriveSupplierOnboardingStatus(input);
    expect(r1.stage).toBe(r2.stage);
    expect(r1.draftInvoice.total).toBe(r2.draftInvoice.total);
    expect(r1.checklist.length).toBe(r2.checklist.length);
  });

  test('different GST status produces different invoice totals', () => {
    const yesInput = makeInput({ gst: makeGST({ gstStatus: 'yes' }) });
    const noInput = makeInput({ gst: makeGST({ gstStatus: 'no' }) });
    const r1 = deriveSupplierOnboardingStatus(yesInput);
    const r2 = deriveSupplierOnboardingStatus(noInput);
    expect(r1.draftInvoice.total).not.toBe(r2.draftInvoice.total);
  });

  test('validateABN is deterministic', () => {
    const r1 = validateABN('51824753556');
    const r2 = validateABN('51824753556');
    expect(r1.isValid).toBe(r2.isValid);
    expect(r1.formattedABN).toBe(r2.formattedABN);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   13. NON-MUTATION
   ════════════════════════════════════════════════════════════════════════════ */

describe('Non-mutation', () => {
  test('deriveSupplierOnboardingStatus does not modify input', () => {
    const input = makeInput();
    const amountBefore = input.obligation.amount;
    const abnBefore = input.abn.abn;
    deriveSupplierOnboardingStatus(input);
    expect(input.obligation.amount).toBe(amountBefore);
    expect(input.abn.abn).toBe(abnBefore);
  });

  test('generateDraftInvoice does not modify input', () => {
    const input = makeInput();
    const amountBefore = input.obligation.amount;
    generateDraftInvoice(input);
    expect(input.obligation.amount).toBe(amountBefore);
  });

  test('validateABN does not modify input string', () => {
    const abn = '51824753556';
    validateABN(abn);
    expect(abn).toBe('51824753556');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   14. DUPLICATE CALCULATION INVARIANTS
   ════════════════════════════════════════════════════════════════════════════ */

describe('Duplicate calculation invariants', () => {
  test('draftInvoice.subtotal always equals obligation.amount', () => {
    const input = makeInput();
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.draftInvoice.subtotal).toBe(input.obligation.amount);
  });

  test('draftInvoice.gstAmount is exactly 10% of subtotal when GST yes', () => {
    const input = makeInput({ gst: makeGST({ gstStatus: 'yes' }) });
    const status = deriveSupplierOnboardingStatus(input);
    expect(status.draftInvoice.gstAmount).toBe(Math.round(input.obligation.amount * 0.1 * 100) / 100);
  });

  test('draftInvoice.total = subtotal + gstAmount', () => {
    const input = makeInput({ gst: makeGST({ gstStatus: 'yes' }) });
    const status = deriveSupplierOnboardingStatus(input);
    const { subtotal, gstAmount, total } = status.draftInvoice;
    expect(total).toBe(subtotal + (gstAmount ?? 0));
  });

  test('abnValidation in status matches standalone validateABN()', () => {
    const input = makeInput();
    const status = deriveSupplierOnboardingStatus(input);
    const standalone = validateABN(input.abn.abn, input.abn.abnNotApplicable);
    expect(status.abnValidation.isValid).toBe(standalone.isValid);
    expect(status.abnValidation.formattedABN).toBe(standalone.formattedABN);
  });
});
