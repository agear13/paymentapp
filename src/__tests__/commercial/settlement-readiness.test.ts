/**
 * Settlement Readiness Regression Tests
 *
 * Comprehensive test suite for the canonical Settlement Readiness Engine.
 *
 * Covers:
 *   - Invoice lifecycle states and transitions
 *   - ABN validation (valid, invalid, edge cases)
 *   - BSB and account number validation
 *   - Settlement checklist generation
 *   - Readiness score calculation
 *   - Blocker derivation
 *   - Tax detail validation (GST consistency)
 *   - Funding dependency
 *   - Xero readiness
 *   - Workspace-level aggregation
 *   - Provvy narrative generation
 *   - James tourism scenario (full end-to-end)
 *   - No duplicated calculations
 *   - Single canonical source of truth
 */

import {
  deriveInvoiceState,
  invoiceStateIndex,
  invoiceStateProgress,
  isInvoiceAtOrAfter,
  nextInvoiceState,
  INVOICE_LIFECYCLE_STATES,
  INVOICE_STATE_LABELS,
} from '../../lib/commercial/invoice-lifecycle';

import {
  deriveSettlementReadiness,
  deriveWorkspaceSettlementReadiness,
  buildSettlementReadinessNarrative,
  validateAbn,
  formatAbn,
} from '../../lib/commercial/settlement-readiness';

/* ─── Fixtures ─────────────────────────────────────────────────────────── */

function makeParticipant(overrides = {}) {
  return {
    id: 'p1',
    name: 'Sarah Chen',
    role: 'Venue Manager',
    email: 'sarah@example.com',
    ...overrides,
  };
}

function makeAgreement(overrides = {}) {
  return {
    approved: true,
    approvedAt: '2024-06-10T09:00:00Z',
    agreementGenerated: true,
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    invoiceNotRequired: false,
    invoiceRequested: true,
    invoiceReceivedAt: '2024-06-12T10:00:00Z',
    invoiceVerifiedAt: '2024-06-13T11:00:00Z',
    invoiceExportedAt: null,
    paymentReady: false,
    invoiceNumber: 'INV-001',
    supplierName: 'Sarah Chen Events',
    invoiceAmount: 2500,
    currency: 'AUD',
    ...overrides,
  };
}

function makeTaxDetails(overrides = {}) {
  return {
    abn: '51824753556', // Valid ABN
    gstRegistered: true,
    businessName: 'Sarah Chen Events Pty Ltd',
    abnVerified: true,
    ...overrides,
  };
}

function makeBankDetails(overrides = {}) {
  return {
    bsb: '062000',
    accountNumber: '12345678',
    accountName: 'Sarah Chen Events',
    bankName: 'Commonwealth Bank',
    paymentReference: 'SUNSET-SARAH',
    ...overrides,
  };
}

function makeFunding(overrides = {}) {
  return {
    status: 'funded',
    amount: 2500,
    obligationAmount: 2500,
    currency: 'AUD',
    ...overrides,
  };
}

function makeAccounting(overrides = {}) {
  return {
    xeroStatus: 'exported',
    exportedAt: '2024-06-14T09:00:00Z',
    ...overrides,
  };
}

function makeObligation(overrides = {}) {
  return {
    amount: 2500,
    currency: 'AUD',
    type: 'fixed_fee',
    ...overrides,
  };
}

/** Build a fully-ready participant input. */
function makeReadyInput(overrides = {}) {
  return {
    participant: makeParticipant(),
    agreement: makeAgreement(),
    invoice: makeInvoice({ paymentReady: true }),
    taxDetails: makeTaxDetails(),
    bankDetails: makeBankDetails(),
    funding: makeFunding({ status: 'cleared' }),
    accounting: makeAccounting(),
    obligation: makeObligation(),
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   PART 1 — Invoice Lifecycle
   ══════════════════════════════════════════════════════════════════════════ */

describe('Invoice Lifecycle', () => {
  describe('INVOICE_LIFECYCLE_STATES', () => {
    it('contains 8 states in order', () => {
      expect(INVOICE_LIFECYCLE_STATES).toEqual([
        'not_required',
        'required',
        'requested',
        'received',
        'verified',
        'ready_for_xero',
        'exported',
        'ready_for_settlement',
      ]);
    });

    it('has no duplicates', () => {
      expect(new Set(INVOICE_LIFECYCLE_STATES).size).toBe(INVOICE_LIFECYCLE_STATES.length);
    });

    it('has a label for every state', () => {
      for (const state of INVOICE_LIFECYCLE_STATES) {
        expect(INVOICE_STATE_LABELS[state]).toBeTruthy();
      }
    });
  });

  describe('deriveInvoiceState', () => {
    it('returns not_required when invoiceNotRequired is true', () => {
      expect(deriveInvoiceState({ invoiceNotRequired: true })).toBe('not_required');
    });

    it('returns required when nothing is set', () => {
      expect(deriveInvoiceState({})).toBe('required');
    });

    it('returns requested when invoiceRequested is true', () => {
      expect(deriveInvoiceState({ invoiceRequested: true })).toBe('requested');
    });

    it('returns received when invoice has been received', () => {
      expect(
        deriveInvoiceState({ invoiceRequested: true, invoiceReceivedAt: '2024-06-01' })
      ).toBe('received');
    });

    it('returns verified when invoice has been verified but not cleared for Xero', () => {
      expect(
        deriveInvoiceState({
          invoiceRequested: true,
          invoiceReceivedAt: '2024-06-01',
          invoiceVerifiedAt: '2024-06-02',
          invoiceReadyForXero: false,
        })
      ).toBe('verified');
    });

    it('returns ready_for_xero when verified and cleared for Xero export', () => {
      expect(
        deriveInvoiceState({
          invoiceVerifiedAt: '2024-06-02',
          invoiceReadyForXero: true,
          invoiceExportedAt: null,
        })
      ).toBe('ready_for_xero');
    });

    it('returns exported when exported but payment not ready', () => {
      expect(
        deriveInvoiceState({
          invoiceExportedAt: '2024-06-03',
          paymentReady: false,
        })
      ).toBe('exported');
    });

    it('returns ready_for_settlement when exported and payment ready', () => {
      expect(
        deriveInvoiceState({
          invoiceExportedAt: '2024-06-03',
          paymentReady: true,
        })
      ).toBe('ready_for_settlement');
    });

    it('not_required takes precedence over everything else', () => {
      expect(
        deriveInvoiceState({
          invoiceNotRequired: true,
          invoiceExportedAt: '2024-06-03',
          paymentReady: true,
        })
      ).toBe('not_required');
    });
  });

  describe('invoiceStateIndex', () => {
    it('first state has index 0', () => {
      expect(invoiceStateIndex('not_required')).toBe(0);
    });

    it('last state has the highest index', () => {
      expect(invoiceStateIndex('ready_for_settlement')).toBe(INVOICE_LIFECYCLE_STATES.length - 1);
    });

    it('returns sequential indices', () => {
      for (let i = 0; i < INVOICE_LIFECYCLE_STATES.length; i++) {
        expect(invoiceStateIndex(INVOICE_LIFECYCLE_STATES[i])).toBe(i);
      }
    });
  });

  describe('isInvoiceAtOrAfter', () => {
    it('returns true when at the same state', () => {
      expect(isInvoiceAtOrAfter('received', 'received')).toBe(true);
    });

    it('returns true when past the target state', () => {
      expect(isInvoiceAtOrAfter('verified', 'received')).toBe(true);
    });

    it('returns false when before the target state', () => {
      expect(isInvoiceAtOrAfter('requested', 'verified')).toBe(false);
    });
  });

  describe('invoiceStateProgress', () => {
    it('first state is 0%', () => {
      expect(invoiceStateProgress('not_required')).toBe(0);
    });

    it('last state is 100%', () => {
      expect(invoiceStateProgress('ready_for_settlement')).toBe(100);
    });

    it('progress is monotonically increasing', () => {
      let prev = -1;
      for (const state of INVOICE_LIFECYCLE_STATES) {
        const progress = invoiceStateProgress(state);
        expect(progress).toBeGreaterThan(prev);
        prev = progress;
      }
    });
  });

  describe('nextInvoiceState', () => {
    it('returns the next state', () => {
      expect(nextInvoiceState('required')).toBe('requested');
    });

    it('returns null for the last state', () => {
      expect(nextInvoiceState('ready_for_settlement')).toBeNull();
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 2 — ABN Validation
   ══════════════════════════════════════════════════════════════════════════ */

describe('ABN Validation', () => {
  describe('validateAbn', () => {
    it('accepts valid ABNs', () => {
      // Well-known valid ABNs
      expect(validateAbn('51824753556')).toBe(true);
      expect(validateAbn('53004085616')).toBe(true);
      expect(validateAbn('12345678901')).toBe(false); // invalid
    });

    it('rejects ABNs with wrong length', () => {
      expect(validateAbn('1234567890')).toBe(false);  // 10 digits
      expect(validateAbn('123456789012')).toBe(false); // 12 digits
    });

    it('rejects ABNs with non-numeric characters', () => {
      expect(validateAbn('5182475355A')).toBe(false);
    });

    it('strips spaces before validation', () => {
      expect(validateAbn('51 824 753 556')).toBe(true);
    });

    it('rejects empty string', () => {
      expect(validateAbn('')).toBe(false);
    });

    it('rejects all-zeros', () => {
      expect(validateAbn('00000000000')).toBe(false);
    });
  });

  describe('formatAbn', () => {
    it('formats a valid ABN', () => {
      expect(formatAbn('51824753556')).toBe('51 824 753 556');
    });

    it('strips spaces before formatting', () => {
      expect(formatAbn('51 824 753 556')).toBe('51 824 753 556');
    });

    it('returns input unchanged for wrong length', () => {
      expect(formatAbn('1234567890')).toBe('1234567890');
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 3 — Settlement Readiness Engine Core
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveSettlementReadiness', () => {
  describe('fully ready participant', () => {
    const result = deriveSettlementReadiness(makeReadyInput());

    it('reports readyToSettle = true', () => {
      expect(result.readyToSettle).toBe(true);
    });

    it('reports readinessScore = 100', () => {
      expect(result.readinessScore).toBe(100);
    });

    it('has no blockers', () => {
      expect(result.blockers).toHaveLength(0);
    });

    it('has no missingRequirements', () => {
      expect(result.missingRequirements).toHaveLength(0);
    });

    it('nextAction is null', () => {
      expect(result.nextAction).toBeNull();
    });

    it('checklist has 8 items', () => {
      expect(result.checklist).toHaveLength(8);
    });

    it('all checklist items are complete', () => {
      for (const item of result.checklist) {
        expect(item.status).toBe('complete');
      }
    });

    it('contains participant identity', () => {
      expect(result.participantId).toBe('p1');
      expect(result.participantName).toBe('Sarah Chen');
    });
  });

  describe('checklist item ordering', () => {
    it('checklist items are in canonical order', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      const ids = result.checklist.map((i) => i.id);
      expect(ids).toEqual([
        'commercial_agreement',
        'participant_approval',
        'payment_details',
        'tax_information',
        'invoice',
        'funding_confirmed',
        'accounting_export',
        'ready_for_settlement',
      ]);
    });
  });

  describe('commercial agreement check', () => {
    it('missing when agreementGenerated is false', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ agreement: makeAgreement({ agreementGenerated: false }) })
      );
      const item = result.checklist.find((i) => i.id === 'commercial_agreement');
      expect(item?.status).toBe('missing');
      expect(item?.isBlocker).toBe(true);
    });

    it('complete when agreementGenerated is true', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ agreement: makeAgreement({ agreementGenerated: true }) })
      );
      const item = result.checklist.find((i) => i.id === 'commercial_agreement');
      expect(item?.status).toBe('complete');
    });
  });

  describe('participant approval check', () => {
    it('missing when agreement not generated and not approved', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ agreement: { approved: false, agreementGenerated: false } })
      );
      const item = result.checklist.find((i) => i.id === 'participant_approval');
      expect(item?.status).toBe('missing');
      expect(item?.isBlocker).toBe(true);
    });

    it('in_progress when agreement generated but not approved', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          agreement: makeAgreement({ agreementGenerated: true, approved: false }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'participant_approval');
      expect(item?.status).toBe('in_progress');
    });

    it('complete when approved', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      const item = result.checklist.find((i) => i.id === 'participant_approval');
      expect(item?.status).toBe('complete');
    });
  });

  describe('payment details check', () => {
    it('missing when no bank details provided', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ bankDetails: {} })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      expect(item?.status).toBe('missing');
      expect(item?.isBlocker).toBe(true);
    });

    it('in_progress when BSB is invalid (partial details entered)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ bankDetails: makeBankDetails({ bsb: '123' }) })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      // Partial details entered — in_progress, not yet complete
      expect(item?.status).not.toBe('complete');
      expect(item?.status).toBe('in_progress');
    });

    it('in_progress when account number is too short', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ bankDetails: makeBankDetails({ accountNumber: '123' }) })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      expect(item?.status).not.toBe('complete');
    });

    it('in_progress when account number is too long (10 digits)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ bankDetails: makeBankDetails({ accountNumber: '1234567890' }) })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      expect(item?.status).not.toBe('complete');
    });

    it('in_progress when accountName is blank but BSB and account provided', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ bankDetails: makeBankDetails({ accountName: '' }) })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      expect(item?.status).not.toBe('complete');
    });

    it('complete with valid BSB + 6-digit account number', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          bankDetails: makeBankDetails({ bsb: '062000', accountNumber: '123456' }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      expect(item?.status).toBe('complete');
    });

    it('complete with valid BSB + 9-digit account number', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          bankDetails: makeBankDetails({ bsb: '062000', accountNumber: '123456789' }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'payment_details');
      expect(item?.status).toBe('complete');
    });
  });

  describe('tax information check', () => {
    it('missing when ABN not provided', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ taxDetails: makeTaxDetails({ abn: null }) })
      );
      const item = result.checklist.find((i) => i.id === 'tax_information');
      expect(item?.status).toBe('missing');
      expect(item?.isBlocker).toBe(true);
    });

    it('in_progress when ABN is invalid (number entered but fails check digit)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ taxDetails: makeTaxDetails({ abn: '12345678901' }) })
      );
      const item = result.checklist.find((i) => i.id === 'tax_information');
      // ABN entered but invalid — in_progress
      expect(item?.status).not.toBe('complete');
      expect(item?.status).toBe('in_progress');
    });

    it('in_progress when GST status is undefined but ABN is valid', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ abn: '51824753556', gstRegistered: undefined }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'tax_information');
      // ABN valid but GST not confirmed — in_progress
      expect(item?.status).not.toBe('complete');
    });

    it('complete when valid ABN and GST status confirmed', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      const item = result.checklist.find((i) => i.id === 'tax_information');
      expect(item?.status).toBe('complete');
    });

    it('complete when GST registered = false (not required to be true)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ gstRegistered: false }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'tax_information');
      expect(item?.status).toBe('complete');
    });
  });

  describe('GST consistency validation', () => {
    it('gstConsistent is false when GST registered but ABN invalid', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ abn: 'invalid', gstRegistered: true }),
        })
      );
      expect(result.validation.gstConsistent).toBe(false);
    });

    it('gstConsistent is true when not GST registered regardless of ABN', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ abn: null, gstRegistered: false }),
        })
      );
      expect(result.validation.gstConsistent).toBe(true);
    });
  });

  describe('invoice check', () => {
    it('missing when invoice not yet requested', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({
            invoiceRequested: false,
            invoiceReceivedAt: null,
            invoiceVerifiedAt: null,
          }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'invoice');
      expect(item?.status).toBe('missing');
    });

    it('in_progress when invoice requested but not received', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({
            invoiceRequested: true,
            invoiceReceivedAt: null,
            invoiceVerifiedAt: null,
          }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'invoice');
      expect(item?.status).toBe('in_progress');
    });

    it('in_progress when received but not verified', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({
            invoiceRequested: true,
            invoiceReceivedAt: '2024-06-12',
            invoiceVerifiedAt: null,
          }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'invoice');
      expect(item?.status).toBe('in_progress');
    });

    it('complete when verified', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      const item = result.checklist.find((i) => i.id === 'invoice');
      expect(item?.status).toBe('complete');
    });

    it('complete when not_required (unpaid_internal obligation)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          obligation: makeObligation({ type: 'unpaid_internal' }),
        })
      );
      const item = result.checklist.find((i) => i.id === 'invoice');
      expect(item?.status).toBe('complete');
      expect(result.invoiceNotRequired).toBe(true);
    });
  });

  describe('funding confirmed check', () => {
    it('missing when unfunded', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      );
      const item = result.checklist.find((i) => i.id === 'funding_confirmed');
      expect(item?.status).toBe('missing');
      expect(item?.isBlocker).toBe(true);
    });

    it('in_progress when partially funded', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'partially_funded' }) })
      );
      const item = result.checklist.find((i) => i.id === 'funding_confirmed');
      expect(item?.status).toBe('in_progress');
    });

    it('complete when funded', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'funded' }) })
      );
      const item = result.checklist.find((i) => i.id === 'funding_confirmed');
      expect(item?.status).toBe('complete');
    });

    it('complete when cleared', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'cleared' }) })
      );
      const item = result.checklist.find((i) => i.id === 'funding_confirmed');
      expect(item?.status).toBe('complete');
    });

    it('complete when paid', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'paid' }) })
      );
      const item = result.checklist.find((i) => i.id === 'funding_confirmed');
      expect(item?.status).toBe('complete');
    });
  });

  describe('accounting export check', () => {
    it('in_progress when xeroStatus is pending (export initiated but not complete)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ accounting: makeAccounting({ xeroStatus: 'pending', exportedAt: null }) })
      );
      const item = result.checklist.find((i) => i.id === 'accounting_export');
      // Export is in progress
      expect(item?.status).not.toBe('complete');
      expect(item?.status).toBe('in_progress');
    });

    it('complete when exported', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      const item = result.checklist.find((i) => i.id === 'accounting_export');
      expect(item?.status).toBe('complete');
    });

    it('complete when not_required', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ accounting: { xeroStatus: 'not_required' } })
      );
      const item = result.checklist.find((i) => i.id === 'accounting_export');
      expect(item?.status).toBe('complete');
    });
  });

  describe('ready_for_settlement sentinel', () => {
    it('complete when all other items are complete', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      const item = result.checklist.find((i) => i.id === 'ready_for_settlement');
      expect(item?.status).toBe('complete');
    });

    it('missing when any item is incomplete', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      );
      const item = result.checklist.find((i) => i.id === 'ready_for_settlement');
      expect(item?.status).toBe('missing');
    });
  });

  describe('readiness score calculation', () => {
    it('returns 100 for a fully ready participant', () => {
      expect(deriveSettlementReadiness(makeReadyInput()).readinessScore).toBe(100);
    });

    it('returns a very low score for a participant with nothing set up', () => {
      const result = deriveSettlementReadiness({
        participant: makeParticipant(),
        agreement: { approved: false, agreementGenerated: false },
        invoice: { invoiceNotRequired: false, invoiceRequested: false },
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'not_required' },
        obligation: makeObligation(),
      });
      // All substantive items are missing; accounting not_required = complete (5%).
      // Score is at most the accounting weight (5).
      expect(result.readinessScore).toBeLessThanOrEqual(10);
      expect(result.readyToSettle).toBe(false);
    });

    it('increases as items are completed', () => {
      const base = {
        participant: makeParticipant(),
        agreement: { approved: false, agreementGenerated: false },
        invoice: { invoiceNotRequired: false, invoiceRequested: false },
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
        obligation: makeObligation(),
      };

      const score0 = deriveSettlementReadiness(base).readinessScore;
      const score1 = deriveSettlementReadiness({
        ...base,
        agreement: { approved: true, agreementGenerated: true },
      }).readinessScore;
      const score2 = deriveSettlementReadiness({
        ...base,
        agreement: { approved: true, agreementGenerated: true },
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
      }).readinessScore;

      expect(score1).toBeGreaterThan(score0);
      expect(score2).toBeGreaterThan(score1);
    });

    it('is between 0 and 100 inclusive', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      expect(result.readinessScore).toBeGreaterThanOrEqual(0);
      expect(result.readinessScore).toBeLessThanOrEqual(100);
    });
  });

  describe('blockers', () => {
    it('returns no blockers for a ready participant', () => {
      const result = deriveSettlementReadiness(makeReadyInput());
      expect(result.blockers).toHaveLength(0);
    });

    it('returns a blocker for missing participant approval', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ agreement: makeAgreement({ approved: false }) })
      );
      const blocker = result.blockers.find((b) => b.title === 'Participant has not approved');
      expect(blocker).toBeTruthy();
      expect(blocker?.severity).toBe('critical');
    });

    it('returns a blocker for missing bank details', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ bankDetails: {} })
      );
      const blocker = result.blockers.find((b) => b.title === 'Bank account details missing');
      expect(blocker).toBeTruthy();
    });

    it('returns a blocker for unfunded obligation', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      );
      const blocker = result.blockers.find((b) => b.title === 'Funding not confirmed');
      expect(blocker).toBeTruthy();
      expect(blocker?.severity).toBe('critical');
    });

    it('returns a blocker for partially funded', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'partially_funded' }) })
      );
      const blocker = result.blockers.find((b) => b.title === 'Funding partially confirmed');
      expect(blocker).toBeTruthy();
    });

    it('every blocker has title, explanation, consequence, action, severity', () => {
      const result = deriveSettlementReadiness({
        participant: makeParticipant(),
        agreement: { approved: false, agreementGenerated: false },
        invoice: { invoiceNotRequired: false, invoiceRequested: false },
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
        obligation: makeObligation(),
      });

      for (const blocker of result.blockers) {
        expect(blocker.title).toBeTruthy();
        expect(blocker.explanation).toBeTruthy();
        expect(blocker.consequence).toBeTruthy();
        expect(blocker.action).toBeTruthy();
        expect(['critical', 'high', 'medium']).toContain(blocker.severity);
      }
    });
  });

  describe('nextAction', () => {
    it('is null when ready to settle', () => {
      expect(deriveSettlementReadiness(makeReadyInput()).nextAction).toBeNull();
    });

    it('is non-null when blocked', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      );
      expect(result.nextAction).toBeTruthy();
    });

    it('is a string (not an object)', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({ agreement: makeAgreement({ approved: false }) })
      );
      expect(typeof result.nextAction).toBe('string');
    });
  });

  describe('invoiceAmountMatchesObligation validation', () => {
    it('is true when amounts match exactly', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({ invoiceAmount: 2500 }),
          obligation: makeObligation({ amount: 2500 }),
        })
      );
      expect(result.validation.invoiceAmountMatchesObligation).toBe(true);
    });

    it('is true within 1% tolerance', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({ invoiceAmount: 2510 }),
          obligation: makeObligation({ amount: 2500 }),
        })
      );
      expect(result.validation.invoiceAmountMatchesObligation).toBe(true);
    });

    it('is false when amounts differ significantly', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({ invoiceAmount: 3000 }),
          obligation: makeObligation({ amount: 2500 }),
        })
      );
      expect(result.validation.invoiceAmountMatchesObligation).toBe(false);
    });

    it('is null when invoice amount not provided', () => {
      const result = deriveSettlementReadiness(
        makeReadyInput({
          invoice: makeInvoice({ invoiceAmount: null }),
        })
      );
      expect(result.validation.invoiceAmountMatchesObligation).toBeNull();
    });
  });

  describe('determinism — same inputs produce same output', () => {
    it('produces identical output on repeated calls', () => {
      const input = makeReadyInput();
      const r1 = deriveSettlementReadiness(input);
      const r2 = deriveSettlementReadiness(input);
      expect(r1.readinessScore).toBe(r2.readinessScore);
      expect(r1.readyToSettle).toBe(r2.readyToSettle);
      expect(r1.checklist.map((i) => i.status)).toEqual(r2.checklist.map((i) => i.status));
    });

    it('does not mutate the input', () => {
      const input = makeReadyInput();
      const originalFundingStatus = input.funding.status;
      deriveSettlementReadiness(input);
      expect(input.funding.status).toBe(originalFundingStatus);
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 4 — Workspace-Level Aggregation
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveWorkspaceSettlementReadiness', () => {
  it('returns empty state for empty input', () => {
    const ws = deriveWorkspaceSettlementReadiness([]);
    expect(ws.readyCount).toBe(0);
    expect(ws.blockedCount).toBe(0);
    expect(ws.participants).toHaveLength(0);
    expect(ws.canReleaseBatch).toBe(false);
  });

  it('readyCount and blockedCount sum to total participants', () => {
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1', name: 'Sarah' }) }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2', name: 'Ben' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
      makeReadyInput({ participant: makeParticipant({ id: 'p3', name: 'Alex' }) }),
    ];
    const ws = deriveWorkspaceSettlementReadiness(inputs);
    expect(ws.readyCount + ws.blockedCount).toBe(inputs.length);
    expect(ws.readyCount).toBe(2);
    expect(ws.blockedCount).toBe(1);
  });

  it('canReleaseBatch is true only when ALL are ready', () => {
    const all_ready = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
      makeReadyInput({ participant: makeParticipant({ id: 'p2' }) }),
    ];
    expect(deriveWorkspaceSettlementReadiness(all_ready).canReleaseBatch).toBe(true);

    const one_blocked = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
    ];
    expect(deriveWorkspaceSettlementReadiness(one_blocked).canReleaseBatch).toBe(false);
  });

  it('averageScore is between 0 and 100', () => {
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
    ];
    const ws = deriveWorkspaceSettlementReadiness(inputs);
    expect(ws.averageScore).toBeGreaterThanOrEqual(0);
    expect(ws.averageScore).toBeLessThanOrEqual(100);
  });

  it('identifies a primaryBottleneck', () => {
    const inputs = [
      makeReadyInput({
        participant: makeParticipant({ id: 'p1' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
    ];
    const ws = deriveWorkspaceSettlementReadiness(inputs);
    expect(ws.primaryBottleneck).toBeTruthy();
  });

  it('primaryBottleneck is null when all ready', () => {
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
    ];
    const ws = deriveWorkspaceSettlementReadiness(inputs);
    expect(ws.primaryBottleneck).toBeNull();
  });

  it('each participant result is individually correct', () => {
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1', name: 'Sarah' }) }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2', name: 'Ben' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
    ];
    const ws = deriveWorkspaceSettlementReadiness(inputs);
    const sarah = ws.participants.find((p) => p.participantId === 'p1');
    const ben = ws.participants.find((p) => p.participantId === 'p2');
    expect(sarah?.readyToSettle).toBe(true);
    expect(ben?.readyToSettle).toBe(false);
  });

  it('does not perform independent readiness calculations (all use engine)', () => {
    // Ensure the aggregate figures are consistent with per-participant engine output
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
      makeReadyInput({ participant: makeParticipant({ id: 'p2' }) }),
    ];
    const ws = deriveWorkspaceSettlementReadiness(inputs);
    const manualAvg = Math.round(
      ws.participants.reduce((s, p) => s + p.readinessScore, 0) / ws.participants.length
    );
    expect(ws.averageScore).toBe(manualAvg);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 5 — Provvy Narrative
   ══════════════════════════════════════════════════════════════════════════ */

describe('buildSettlementReadinessNarrative', () => {
  it('returns a message for empty participant list', () => {
    const narrative = buildSettlementReadinessNarrative([]);
    expect(narrative).toContain('No participants');
  });

  it('lists ready participants', () => {
    const results = [deriveSettlementReadiness(makeReadyInput())];
    const narrative = buildSettlementReadinessNarrative(results);
    expect(narrative).toContain('Sarah Chen');
    expect(narrative.toLowerCase()).toContain('ready');
  });

  it('explains blockers for blocked participants', () => {
    const results = [
      deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      ),
    ];
    const narrative = buildSettlementReadinessNarrative(results);
    expect(narrative.toLowerCase()).toContain('funding');
  });

  it('ends with exactly one recommended next action when there are blockers', () => {
    const results = [
      deriveSettlementReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      ),
    ];
    const narrative = buildSettlementReadinessNarrative(results);
    const actionLines = narrative
      .split('\n')
      .filter((l) => l.toLowerCase().includes('recommended next action'));
    expect(actionLines).toHaveLength(1);
  });

  it('does not include "next action" text when all are ready', () => {
    const results = [deriveSettlementReadiness(makeReadyInput())];
    const narrative = buildSettlementReadinessNarrative(results);
    expect(narrative.toLowerCase()).not.toContain('recommended next action');
  });

  it('handles mixed ready/blocked participants', () => {
    const results = [
      deriveSettlementReadiness(makeReadyInput({ participant: makeParticipant({ id: 'p1', name: 'Sarah' }) })),
      deriveSettlementReadiness(
        makeReadyInput({
          participant: makeParticipant({ id: 'p2', name: 'Ben' }),
          funding: makeFunding({ status: 'unfunded' }),
        })
      ),
    ];
    const narrative = buildSettlementReadinessNarrative(results);
    expect(narrative).toContain('Sarah');
    expect(narrative).toContain('Ben');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 6 — James Tourism Scenario (End-to-End)
   ══════════════════════════════════════════════════════════════════════════ */

describe('James Tourism Scenario', () => {
  /**
   * Tourism agreement lifecycle:
   *   Agreement created → Participants added → Approvals → Forecast
   *   → Invoice Requested → Invoice Received → Tax Details Verified
   *   → Funding Confirmed → Ready for Xero → Ready for Settlement
   *
   * Two participants:
   *   - Sarah Chen (Venue Manager) — fixed fee $2,500
   *   - Ben Torres (Tour Guide) — fixed fee $1,800
   */

  const SARAH_ID = 'sarah-001';
  const BEN_ID = 'ben-002';

  function makeSarahBase() {
    return {
      participant: makeParticipant({ id: SARAH_ID, name: 'Sarah Chen', role: 'Venue Manager' }),
      obligation: makeObligation({ amount: 2500 }),
    };
  }

  function makeBenBase() {
    return {
      participant: makeParticipant({ id: BEN_ID, name: 'Ben Torres', role: 'Tour Guide' }),
      obligation: makeObligation({ amount: 1800 }),
    };
  }

  describe('Stage 1: Agreement created, participants added', () => {
    it('both participants are not ready to settle', () => {
      const sarahResult = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: { approved: false, agreementGenerated: false },
        invoice: {},
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'not_required' },
      });

      const benResult = deriveSettlementReadiness({
        ...makeBenBase(),
        agreement: { approved: false, agreementGenerated: false },
        invoice: {},
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'not_required' },
      });

      expect(sarahResult.readyToSettle).toBe(false);
      expect(benResult.readyToSettle).toBe(false);
      // All substantive items are missing; only accounting (not_required) is complete.
      // Score reflects only the accounting weight (≤10).
      expect(sarahResult.readinessScore).toBeLessThanOrEqual(10);
      expect(benResult.readinessScore).toBeLessThanOrEqual(10);
    });
  });

  describe('Stage 2: Agreements generated, approvals sent', () => {
    it('approval checklist item moves to in_progress after agreement generated', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: { approved: false, agreementGenerated: true },
        invoice: {},
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
      });

      const approvalItem = result.checklist.find((i) => i.id === 'participant_approval');
      expect(approvalItem?.status).toBe('in_progress');

      const agreementItem = result.checklist.find((i) => i.id === 'commercial_agreement');
      expect(agreementItem?.status).toBe('complete');
    });
  });

  describe('Stage 3: Both participants have approved', () => {
    it('approval item becomes complete', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement({ approved: true }),
        invoice: {},
        taxDetails: {},
        bankDetails: {},
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
      });

      const approvalItem = result.checklist.find((i) => i.id === 'participant_approval');
      expect(approvalItem?.status).toBe('complete');
    });
  });

  describe('Stage 4: Invoice requested', () => {
    it('invoice item moves to in_progress', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: { invoiceRequested: true, invoiceReceivedAt: null },
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
      });

      const invoiceItem = result.checklist.find((i) => i.id === 'invoice');
      expect(invoiceItem?.status).toBe('in_progress');
      expect(result.invoiceState).toBe('requested');
    });
  });

  describe('Stage 5: Invoice received', () => {
    it('invoice state is received', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: {
          invoiceRequested: true,
          invoiceReceivedAt: '2024-06-12T10:00:00Z',
          invoiceVerifiedAt: null,
          invoiceAmount: 2500,
        },
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
      });

      expect(result.invoiceState).toBe('received');
      const invoiceItem = result.checklist.find((i) => i.id === 'invoice');
      expect(invoiceItem?.status).toBe('in_progress');
    });
  });

  describe('Stage 6: Tax details verified (ABN + GST confirmed)', () => {
    it('tax information item becomes complete', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice(),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: { status: 'unfunded' },
        accounting: { xeroStatus: 'pending' },
      });

      const taxItem = result.checklist.find((i) => i.id === 'tax_information');
      expect(taxItem?.status).toBe('complete');
      expect(result.validation.abnValid).toBe(true);
    });
  });

  describe('Stage 7: Funding confirmed', () => {
    it('funding item becomes complete when status is funded', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice(),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: makeFunding({ status: 'funded' }),
        accounting: { xeroStatus: 'pending' },
      });

      const fundingItem = result.checklist.find((i) => i.id === 'funding_confirmed');
      expect(fundingItem?.status).toBe('complete');
    });
  });

  describe('Stage 8: Ready for Xero (invoice verified)', () => {
    it('invoice state is verified after invoiceVerifiedAt is set', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice({ invoiceExportedAt: null, invoiceReadyForXero: false }),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: makeFunding({ status: 'funded' }),
        accounting: { xeroStatus: 'pending' },
      });

      // Invoice has been verified — state should be 'verified'
      expect(result.invoiceState).toBe('verified');

      // Accounting export is pending (in_progress, not yet complete)
      const accountingItem = result.checklist.find((i) => i.id === 'accounting_export');
      expect(accountingItem?.status).toBe('in_progress');
    });

    it('invoice state is ready_for_xero when explicitly marked', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice({ invoiceExportedAt: null, invoiceReadyForXero: true }),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: makeFunding({ status: 'funded' }),
        accounting: { xeroStatus: 'pending' },
      });

      expect(result.invoiceState).toBe('ready_for_xero');
    });
  });

  describe('Stage 9: Exported to Xero', () => {
    it('accounting item becomes complete after export', () => {
      const result = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice({ invoiceExportedAt: '2024-06-14T09:00:00Z', paymentReady: false }),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: makeFunding({ status: 'funded' }),
        accounting: makeAccounting(),
      });

      const accountingItem = result.checklist.find((i) => i.id === 'accounting_export');
      expect(accountingItem?.status).toBe('complete');
      expect(result.invoiceState).toBe('exported');
    });
  });

  describe('Stage 10: Ready for Settlement (all items complete)', () => {
    it('Sarah is fully ready for settlement', () => {
      const sarahResult = deriveSettlementReadiness({
        ...makeSarahBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice({ invoiceExportedAt: '2024-06-14T09:00:00Z', paymentReady: true }),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: makeFunding({ status: 'cleared' }),
        accounting: makeAccounting(),
      });

      expect(sarahResult.readyToSettle).toBe(true);
      expect(sarahResult.readinessScore).toBe(100);
      expect(sarahResult.blockers).toHaveLength(0);
      expect(sarahResult.nextAction).toBeNull();
      expect(sarahResult.invoiceState).toBe('ready_for_settlement');
    });

    it('Ben is fully ready for settlement', () => {
      const benResult = deriveSettlementReadiness({
        ...makeBenBase(),
        agreement: makeAgreement(),
        invoice: makeInvoice({ invoiceAmount: 1800, invoiceExportedAt: '2024-06-14T09:00:00Z', paymentReady: true }),
        taxDetails: makeTaxDetails(),
        bankDetails: makeBankDetails(),
        funding: makeFunding({ status: 'cleared', amount: 1800, obligationAmount: 1800 }),
        accounting: makeAccounting(),
      });

      expect(benResult.readyToSettle).toBe(true);
    });

    it('workspace readiness is 100% when both ready', () => {
      const inputs = [
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: makeInvoice({ invoiceExportedAt: '2024-06-14T09:00:00Z', paymentReady: true }),
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: makeFunding({ status: 'cleared' }),
          accounting: makeAccounting(),
        },
        {
          ...makeBenBase(),
          agreement: makeAgreement(),
          invoice: makeInvoice({ invoiceAmount: 1800, invoiceExportedAt: '2024-06-14T09:00:00Z', paymentReady: true }),
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: makeFunding({ status: 'cleared', amount: 1800, obligationAmount: 1800 }),
          accounting: makeAccounting(),
        },
      ];

      const ws = deriveWorkspaceSettlementReadiness(inputs);
      expect(ws.canReleaseBatch).toBe(true);
      expect(ws.readyCount).toBe(2);
      expect(ws.blockedCount).toBe(0);
      expect(ws.overallReadiness).toBe(100);
    });

    it('provvy narrative says all are ready', () => {
      const inputs = [
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: makeInvoice({ invoiceExportedAt: '2024-06-14T09:00:00Z', paymentReady: true }),
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: makeFunding({ status: 'cleared' }),
          accounting: makeAccounting(),
        },
      ];
      const ws = deriveWorkspaceSettlementReadiness(inputs);
      expect(ws.provvyNarrative.toLowerCase()).toContain('ready');
    });
  });

  describe('Journey continuity — readiness increases monotonically through lifecycle', () => {
    it('each stage has a higher or equal readiness score than the previous', () => {
      const stages = [
        // Stage 1: nothing
        {
          ...makeSarahBase(),
          agreement: { approved: false, agreementGenerated: false },
          invoice: {},
          taxDetails: {},
          bankDetails: {},
          funding: { status: 'unfunded' },
          accounting: { xeroStatus: 'pending' },
        },
        // Stage 2: agreement generated
        {
          ...makeSarahBase(),
          agreement: { approved: false, agreementGenerated: true },
          invoice: {},
          taxDetails: {},
          bankDetails: {},
          funding: { status: 'unfunded' },
          accounting: { xeroStatus: 'pending' },
        },
        // Stage 3: approved
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: {},
          taxDetails: {},
          bankDetails: {},
          funding: { status: 'unfunded' },
          accounting: { xeroStatus: 'pending' },
        },
        // Stage 4: tax + bank added
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: {},
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: { status: 'unfunded' },
          accounting: { xeroStatus: 'pending' },
        },
        // Stage 5: invoice verified
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: makeInvoice(),
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: { status: 'unfunded' },
          accounting: { xeroStatus: 'pending' },
        },
        // Stage 6: funded
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: makeInvoice(),
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: makeFunding({ status: 'funded' }),
          accounting: { xeroStatus: 'pending' },
        },
        // Stage 7: exported
        {
          ...makeSarahBase(),
          agreement: makeAgreement(),
          invoice: makeInvoice({ invoiceExportedAt: '2024-06-14', paymentReady: true }),
          taxDetails: makeTaxDetails(),
          bankDetails: makeBankDetails(),
          funding: makeFunding({ status: 'cleared' }),
          accounting: makeAccounting(),
        },
      ];

      let previousScore = -1;
      for (const stage of stages) {
        const result = deriveSettlementReadiness(stage);
        expect(result.readinessScore).toBeGreaterThanOrEqual(previousScore);
        previousScore = result.readinessScore;
      }
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 7 — No Duplicate Calculations
   ══════════════════════════════════════════════════════════════════════════ */

describe('No duplicate calculations', () => {
  it('deriveWorkspaceSettlementReadiness averageScore matches manual per-participant calculation', () => {
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p3' }),
        bankDetails: {},
      }),
    ];

    const ws = deriveWorkspaceSettlementReadiness(inputs);

    // Manually derive each participant and calculate average
    const individual = inputs.map(deriveSettlementReadiness);
    const manualAvg = Math.round(
      individual.reduce((s, r) => s + r.readinessScore, 0) / individual.length
    );

    expect(ws.averageScore).toBe(manualAvg);
  });

  it('workspace results and individually derived results are identical', () => {
    const inputs = [
      makeReadyInput({ participant: makeParticipant({ id: 'p1' }) }),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2' }),
        funding: makeFunding({ status: 'unfunded' }),
      }),
    ];

    const ws = deriveWorkspaceSettlementReadiness(inputs);
    const individual = inputs.map(deriveSettlementReadiness);

    for (let i = 0; i < individual.length; i++) {
      expect(ws.participants[i].readinessScore).toBe(individual[i].readinessScore);
      expect(ws.participants[i].readyToSettle).toBe(individual[i].readyToSettle);
    }
  });
});
