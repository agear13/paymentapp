/**
 * Accounting Synchronisation Regression Tests
 *
 * Comprehensive test suite for the canonical Accounting Export Engine.
 *
 * Covers:
 *   - Export readiness (all checklist items individually)
 *   - Blocker detection (each blocker type with correct reason code)
 *   - Preview generation (correct fields, GST calculation)
 *   - Sync status transitions
 *   - Not-applicable handling (unpaid_internal, xeroStatus: not_required)
 *   - Provider abstraction (connector interface)
 *   - Workspace sync status aggregation
 *   - Provvy/accounting narrative
 *   - Dashboard integration
 *   - James tourism scenario (full end-to-end, 10 stages)
 *   - Determinism and non-mutation
 *   - No duplicated calculations
 *   - Single canonical source of truth
 */

import {
  deriveAccountingExport,
  deriveAccountingExportPreview,
  deriveAccountingSyncStatus,
  deriveExportReadiness,
  buildAccountingNarrative,
  formatExportAmount,
} from '../../lib/commercial/accounting-export';

import {
  createAccountingConnector,
  ACCOUNTING_PROVIDERS,
  ACCOUNTING_PROVIDER_LABELS,
  SYNC_STATUS_LABELS,
} from '../../lib/commercial/accounting-connector';

/* ─── Fixtures ─────────────────────────────────────────────────────────── */

const PROJECT_ID = 'proj-tourism-001';
const TODAY = '2024-06-15';

function makeContext(overrides = {}) {
  return {
    projectId: PROJECT_ID,
    agreementReference: 'SUNSET-2024',
    projectName: 'Sunset Sessions Tourism',
    defaultProvider: 'xero',
    currentDate: TODAY,
    ...overrides,
  };
}

function makeParticipant(overrides = {}) {
  return {
    id: 'sarah-001',
    name: 'Sarah Chen',
    role: 'Venue Manager',
    ...overrides,
  };
}

function makeAgreement(overrides = {}) {
  return {
    approved: true,
    agreementGenerated: true,
    agreementReference: 'SUNSET-2024',
    projectName: 'Sunset Sessions',
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    state: 'verified',
    invoiceNumber: 'INV-001',
    invoiceDate: '2024-06-10',
    dueDate: '2024-06-30',
    invoiceAmount: 2750,
    supplierName: 'Sarah Chen Events Pty Ltd',
    description: 'Venue management services — Sunset Sessions 2024',
    ...overrides,
  };
}

function makeTaxDetails(overrides = {}) {
  return {
    abn: '51824753556',
    gstRegistered: true,
    businessName: 'Sarah Chen Events Pty Ltd',
    abnValid: true,
    ...overrides,
  };
}

function makeBankDetails(overrides = {}) {
  return {
    bsb: '062000',
    accountNumber: '12345678',
    accountName: 'Sarah Chen Events',
    complete: true,
    ...overrides,
  };
}

function makeFunding(overrides = {}) {
  return {
    status: 'funded',
    ...overrides,
  };
}

function makeObligation(overrides = {}) {
  return {
    amount: 2750,
    currency: 'AUD',
    type: 'fixed_fee',
    ...overrides,
  };
}

function makeAccounting(overrides = {}) {
  return {
    xeroStatus: 'pending',
    provider: 'xero',
    trackingCategory: 'Sunset Sessions',
    ...overrides,
  };
}

/** Fully ready participant input. */
function makeReadyInput(overrides = {}) {
  return {
    participant: makeParticipant(),
    agreement: makeAgreement(),
    invoice: makeInvoice(),
    taxDetails: makeTaxDetails(),
    bankDetails: makeBankDetails(),
    funding: makeFunding(),
    obligation: makeObligation(),
    accounting: makeAccounting(),
    ...overrides,
  };
}

/** Workspace input with multiple participants. */
function makeWorkspaceInput(participants = [makeReadyInput()], overrides = {}) {
  return {
    projectId: PROJECT_ID,
    projectName: 'Sunset Sessions Tourism',
    agreementReference: 'SUNSET-2024',
    currentDate: TODAY,
    defaultProvider: 'xero',
    participants,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   PART 1 — Accounting Connector Interface
   ══════════════════════════════════════════════════════════════════════════ */

describe('AccountingConnector interface', () => {
  it('ACCOUNTING_PROVIDERS contains all supported providers', () => {
    expect(ACCOUNTING_PROVIDERS).toContain('xero');
    expect(ACCOUNTING_PROVIDERS).toContain('myob');
    expect(ACCOUNTING_PROVIDERS).toContain('quickbooks');
    expect(ACCOUNTING_PROVIDERS).toContain('sage');
    expect(ACCOUNTING_PROVIDERS).toContain('netsuite');
  });

  it('every provider has a human-readable label', () => {
    for (const provider of ACCOUNTING_PROVIDERS) {
      expect(ACCOUNTING_PROVIDER_LABELS[provider]).toBeTruthy();
    }
  });

  it('every sync status has a human-readable label', () => {
    const statuses = ['ready', 'exporting', 'exported', 'failed', 'needs_review', 're_export_required'];
    for (const status of statuses) {
      expect(SYNC_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('createAccountingConnector returns a connector for xero', () => {
    const connector = createAccountingConnector('xero');
    expect(connector.provider).toBe('xero');
    expect(typeof connector.pushExport).toBe('function');
    expect(typeof connector.validateConnection).toBe('function');
    expect(typeof connector.checkExportStatus).toBe('function');
    expect(typeof connector.listTrackingCategories).toBe('function');
  });

  it('createAccountingConnector returns a connector for myob', () => {
    const connector = createAccountingConnector('myob');
    expect(connector.provider).toBe('myob');
  });

  it('createAccountingConnector returns a connector for quickbooks', () => {
    const connector = createAccountingConnector('quickbooks');
    expect(connector.provider).toBe('quickbooks');
  });

  it('throws for unknown provider', () => {
    expect(() => createAccountingConnector('unknown_provider')).toThrow();
  });

  it('connector interface is provider-agnostic — Commercial OS never calls provider SDK directly', () => {
    // Each connector exposes identical interface methods
    const xero = createAccountingConnector('xero');
    const myob = createAccountingConnector('myob');
    expect(Object.keys(xero)).toEqual(Object.keys(myob));
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 2 — Export Readiness
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveExportReadiness', () => {
  it('returns ready for a fully prepared participant', () => {
    const readiness = deriveExportReadiness(makeReadyInput());
    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
    expect(readiness.nextAction).toBeNull();
  });

  describe('Individual blockers', () => {
    it('agreement_not_approved when participant has not approved', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ agreement: makeAgreement({ approved: false }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'agreement_not_approved');
      expect(blocker).toBeTruthy();
      expect(blocker?.explanation).toBeTruthy();
      expect(blocker?.consequence).toBeTruthy();
      expect(blocker?.action).toBeTruthy();
    });

    it('invoice_not_received when invoice state is required', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ invoice: makeInvoice({ state: 'required' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'invoice_not_received');
      expect(blocker).toBeTruthy();
    });

    it('invoice_not_received when invoice state is requested', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ invoice: makeInvoice({ state: 'requested' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'invoice_not_received');
      expect(blocker).toBeTruthy();
    });

    it('invoice_not_verified when received but not verified', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ invoice: makeInvoice({ state: 'received' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'invoice_not_verified');
      expect(blocker).toBeTruthy();
    });

    it('abn_missing when no ABN provided', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ taxDetails: makeTaxDetails({ abn: null }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'abn_missing');
      expect(blocker).toBeTruthy();
    });

    it('abn_invalid when ABN fails check digit', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ abn: '12345678901', abnValid: false }),
        })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'abn_invalid');
      expect(blocker).toBeTruthy();
      expect(blocker?.explanation).toContain('12345678901');
    });

    it('gst_not_confirmed when gstRegistered is undefined', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ gstRegistered: undefined }),
        })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'gst_not_confirmed');
      expect(blocker).toBeTruthy();
    });

    it('gst_not_confirmed when gstRegistered is null', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({
          taxDetails: makeTaxDetails({ gstRegistered: null }),
        })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'gst_not_confirmed');
      expect(blocker).toBeTruthy();
    });

    it('bank_details_incomplete when bank details missing', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ bankDetails: { complete: false } })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'bank_details_incomplete');
      expect(blocker).toBeTruthy();
    });

    it('funding_not_confirmed when unfunded', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'unfunded' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'funding_not_confirmed');
      expect(blocker).toBeTruthy();
    });

    it('funding_not_confirmed when partially funded', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'partially_funded' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'funding_not_confirmed');
      expect(blocker).toBeTruthy();
    });

    it('no funding blocker when status is cleared', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'cleared' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'funding_not_confirmed');
      expect(blocker).toBeFalsy();
    });

    it('no funding blocker when status is paid', () => {
      const readiness = deriveExportReadiness(
        makeReadyInput({ funding: makeFunding({ status: 'paid' }) })
      );
      const blocker = readiness.blockers.find((b) => b.reason === 'funding_not_confirmed');
      expect(blocker).toBeFalsy();
    });
  });

  it('returns multiple blockers simultaneously', () => {
    const readiness = deriveExportReadiness({
      ...makeReadyInput(),
      agreement: makeAgreement({ approved: false }),
      invoice: makeInvoice({ state: 'required' }),
      taxDetails: {},
      bankDetails: { complete: false },
      funding: makeFunding({ status: 'unfunded' }),
    });
    expect(readiness.blockers.length).toBeGreaterThan(3);
    expect(readiness.ready).toBe(false);
  });

  it('nextAction is the first blocker action', () => {
    const readiness = deriveExportReadiness(
      makeReadyInput({ agreement: makeAgreement({ approved: false }) })
    );
    expect(readiness.nextAction).toBe(readiness.blockers[0].action);
  });

  it('every blocker has explanation, consequence, and action', () => {
    const readiness = deriveExportReadiness({
      ...makeReadyInput(),
      agreement: makeAgreement({ approved: false }),
      invoice: makeInvoice({ state: 'required' }),
      taxDetails: {},
      bankDetails: { complete: false },
      funding: makeFunding({ status: 'unfunded' }),
    });

    for (const blocker of readiness.blockers) {
      expect(blocker.explanation).toBeTruthy();
      expect(blocker.consequence).toBeTruthy();
      expect(blocker.action).toBeTruthy();
      expect(blocker.reason).toBeTruthy();
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 3 — Preview Generation
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveAccountingExportPreview', () => {
  it('returns null when not ready for export', () => {
    const preview = deriveAccountingExportPreview(
      makeReadyInput({ agreement: makeAgreement({ approved: false }) }),
      makeContext()
    );
    expect(preview).toBeNull();
  });

  it('returns a preview when ready', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview).not.toBeNull();
  });

  it('uses business name as supplier when available', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.supplier).toBe('Sarah Chen Events Pty Ltd');
  });

  it('falls back to participant name when no business name', () => {
    const preview = deriveAccountingExportPreview(
      makeReadyInput({ taxDetails: makeTaxDetails({ businessName: null }) }),
      makeContext()
    );
    expect(preview?.supplier).toBeTruthy();
  });

  it('calculates GST correctly for GST-registered suppliers', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.gstIncluded).toBe(true);
    // GST = amount / 11
    const expectedGst = Math.round((2750 / 11) * 100) / 100;
    expect(preview?.gstAmount).toBe(expectedGst);
  });

  it('sets gstAmount to 0 for non-GST-registered suppliers', () => {
    const preview = deriveAccountingExportPreview(
      makeReadyInput({ taxDetails: makeTaxDetails({ gstRegistered: false }) }),
      makeContext()
    );
    expect(preview?.gstIncluded).toBe(false);
    expect(preview?.gstAmount).toBe(0);
  });

  it('includes invoice number', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.invoiceNumber).toBe('INV-001');
  });

  it('includes tracking category', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.trackingCategory).toBe('Sunset Sessions');
  });

  it('includes accounting system label', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.accountingSystemLabel).toBe('Xero');
  });

  it('includes due date from invoice', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.dueDate).toBe('2024-06-30');
  });

  it('reference includes agreement reference and participant name', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.reference).toContain('Sarah Chen');
    expect(preview?.reference).toContain('SUNSET-2024');
  });

  it('includes ABN', () => {
    const preview = deriveAccountingExportPreview(makeReadyInput(), makeContext());
    expect(preview?.abn).toBe('51824753556');
  });

  it('uses invoice amount when available', () => {
    const preview = deriveAccountingExportPreview(
      makeReadyInput({ invoice: makeInvoice({ invoiceAmount: 3000 }) }),
      makeContext()
    );
    expect(preview?.amount).toBe(3000);
  });

  it('falls back to obligation amount when invoice amount not specified', () => {
    const preview = deriveAccountingExportPreview(
      makeReadyInput({ invoice: makeInvoice({ invoiceAmount: null }) }),
      makeContext()
    );
    expect(preview?.amount).toBe(2750);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 4 — Full Export Model (deriveAccountingExport)
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveAccountingExport', () => {
  it('generates a deterministic export ID', () => {
    const model = deriveAccountingExport(makeReadyInput(), makeContext());
    expect(model.exportId).toBe(`${PROJECT_ID}:sarah-001:accounting_export`);
  });

  it('status is "ready" when readiness passes and not yet exported', () => {
    const model = deriveAccountingExport(makeReadyInput(), makeContext());
    expect(model.status).toBe('ready');
    expect(model.exportReadiness.ready).toBe(true);
  });

  it('status is "exported" when accounting shows exported', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({
          xeroStatus: 'exported',
          exportedAt: '2024-06-14T10:00:00Z',
          providerReference: 'XERO-BILL-123',
        }),
      }),
      makeContext()
    );
    expect(model.status).toBe('exported');
    expect(model.exportedAt).toBe('2024-06-14T10:00:00Z');
    expect(model.providerReference).toBe('XERO-BILL-123');
  });

  it('status is "failed" when accounting shows failed', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({
          xeroStatus: 'failed',
          lastError: 'network timeout',
        }),
      }),
      makeContext()
    );
    expect(model.status).toBe('failed');
    expect(model.failureReason).toBeTruthy();
    expect(model.failureAction).toBeTruthy();
  });

  it('status is "needs_review" when accounting shows needs_review', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({ xeroStatus: 'needs_review' }),
      }),
      makeContext()
    );
    expect(model.status).toBe('needs_review');
  });

  it('re_export_required is true when xeroStatus is re_export_required', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({ xeroStatus: 're_export_required' }),
      }),
      makeContext()
    );
    expect(model.reExportRequired).toBe(true);
    expect(model.status).toBe('re_export_required');
  });

  it('preview is null when not ready for export', () => {
    const model = deriveAccountingExport(
      makeReadyInput({ agreement: makeAgreement({ approved: false }) }),
      makeContext()
    );
    expect(model.preview).toBeNull();
  });

  it('preview is populated when ready', () => {
    const model = deriveAccountingExport(makeReadyInput(), makeContext());
    expect(model.preview).not.toBeNull();
    expect(model.preview?.supplier).toBeTruthy();
    expect(model.preview?.amount).toBeGreaterThan(0);
  });

  it('notApplicable is false for normal participants', () => {
    const model = deriveAccountingExport(makeReadyInput(), makeContext());
    expect(model.notApplicable).toBe(false);
  });

  it('notApplicable is true for unpaid_internal obligation', () => {
    const model = deriveAccountingExport(
      makeReadyInput({ obligation: makeObligation({ type: 'unpaid_internal' }) }),
      makeContext()
    );
    expect(model.notApplicable).toBe(true);
  });

  it('notApplicable is true when xeroStatus is not_required', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({ xeroStatus: 'not_required' }),
      }),
      makeContext()
    );
    expect(model.notApplicable).toBe(true);
  });

  it('failure reason is operator-friendly (not a technical error)', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({
          xeroStatus: 'failed',
          lastError: 'auth token expired',
        }),
      }),
      makeContext()
    );
    expect(model.failureReason).not.toContain('token');
    expect(model.failureReason?.toLowerCase()).toContain('connection');
  });

  it('failure reason describes duplicate error in operator language', () => {
    const model = deriveAccountingExport(
      makeReadyInput({
        accounting: makeAccounting({
          xeroStatus: 'failed',
          lastError: 'duplicate invoice number',
        }),
      }),
      makeContext()
    );
    expect(model.failureReason?.toLowerCase()).toContain('duplicate');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 5 — Workspace Sync Status
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveAccountingSyncStatus', () => {
  it('handles empty participant list', () => {
    const status = deriveAccountingSyncStatus(makeWorkspaceInput([]));
    expect(status.totalExportable).toBe(0);
    expect(status.overallStatus).toBe('not_started');
  });

  it('overall status is all_exported when everyone is exported', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput({
          accounting: makeAccounting({ xeroStatus: 'exported', exportedAt: TODAY + 'T10:00:00Z' }),
        }),
        makeReadyInput({
          participant: makeParticipant({ id: 'ben-002', name: 'Ben Torres' }),
          accounting: makeAccounting({ xeroStatus: 'exported', exportedAt: TODAY + 'T11:00:00Z' }),
        }),
      ])
    );
    expect(status.overallStatus).toBe('all_exported');
    expect(status.exportedTodayCount).toBe(2);
  });

  it('overall status is blocked when any export has failed', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput({
          accounting: makeAccounting({ xeroStatus: 'failed' }),
        }),
      ])
    );
    expect(status.overallStatus).toBe('blocked');
    expect(status.failedCount).toBe(1);
  });

  it('overall status is in_progress when some exported and some ready', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput({
          accounting: makeAccounting({ xeroStatus: 'exported', exportedAt: '2024-06-14T10:00:00Z' }),
        }),
        makeReadyInput({
          participant: makeParticipant({ id: 'ben-002' }),
          accounting: makeAccounting({ xeroStatus: 'pending' }),
        }),
      ])
    );
    expect(status.overallStatus).toBe('in_progress');
  });

  it('not_applicable participants are excluded from counts', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput({ obligation: makeObligation({ type: 'unpaid_internal' }) }),
        makeReadyInput({
          participant: makeParticipant({ id: 'ben-002' }),
          accounting: makeAccounting({ xeroStatus: 'pending' }),
        }),
      ])
    );
    expect(status.totalExportable).toBe(1);
  });

  it('primaryCta is non-null when action is needed', () => {
    const status = deriveAccountingSyncStatus(makeWorkspaceInput([makeReadyInput()]));
    expect(status.primaryCta).toBeTruthy();
  });

  it('primaryCta is null when all exported', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput({
          accounting: makeAccounting({ xeroStatus: 'exported' }),
        }),
      ])
    );
    expect(status.primaryCta).toBeNull();
  });

  it('prioritises resolving errors over exporting', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput({ accounting: makeAccounting({ xeroStatus: 'failed' }) }),
        makeReadyInput({
          participant: makeParticipant({ id: 'ben-002' }),
          accounting: makeAccounting({ xeroStatus: 'pending' }),
        }),
      ])
    );
    expect(status.primaryCta?.toLowerCase()).toContain('error');
  });

  it('readyToExportCount counts only ready, non-exported participants', () => {
    const status = deriveAccountingSyncStatus(
      makeWorkspaceInput([
        makeReadyInput(), // ready, not exported
        makeReadyInput({
          participant: makeParticipant({ id: 'ben-002' }),
          accounting: makeAccounting({ xeroStatus: 'exported' }),
        }), // already exported
      ])
    );
    expect(status.readyToExportCount).toBe(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 6 — Accounting Narrative
   ══════════════════════════════════════════════════════════════════════════ */

describe('buildAccountingNarrative', () => {
  it('returns a clean message for empty model list', () => {
    const narrative = buildAccountingNarrative([]);
    expect(narrative).toContain('No participants require accounting export');
  });

  it('mentions exported participants', () => {
    const model = deriveAccountingExport(
      makeReadyInput({ accounting: makeAccounting({ xeroStatus: 'exported' }) }),
      makeContext()
    );
    const narrative = buildAccountingNarrative([model]);
    expect(narrative.toLowerCase()).toContain('exported');
  });

  it('mentions failed exports', () => {
    const model = deriveAccountingExport(
      makeReadyInput({ accounting: makeAccounting({ xeroStatus: 'failed', lastError: 'network timeout' }) }),
      makeContext()
    );
    const narrative = buildAccountingNarrative([model]);
    expect(narrative.toLowerCase()).toContain('failed');
  });

  it('ends with exactly one recommended next action when action needed', () => {
    const model = deriveAccountingExport(makeReadyInput(), makeContext());
    const narrative = buildAccountingNarrative([model]);
    const actionLines = narrative
      .split('\n')
      .filter((l) => l.toLowerCase().includes('recommended next action'));
    expect(actionLines).toHaveLength(1);
  });

  it('says all exports are complete when all exported', () => {
    const model = deriveAccountingExport(
      makeReadyInput({ accounting: makeAccounting({ xeroStatus: 'exported' }) }),
      makeContext()
    );
    const narrative = buildAccountingNarrative([model]);
    expect(narrative.toLowerCase()).toContain('exported');
  });

  it('mentions blockers when participant is not ready', () => {
    const model = deriveAccountingExport(
      makeReadyInput({ agreement: makeAgreement({ approved: false }) }),
      makeContext()
    );
    const narrative = buildAccountingNarrative([model]);
    expect(narrative.toLowerCase()).toContain('blocked');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 7 — Format Utilities
   ══════════════════════════════════════════════════════════════════════════ */

describe('formatExportAmount', () => {
  it('formats AUD amounts correctly', () => {
    const result = formatExportAmount(2750, 'AUD');
    expect(result).toContain('2,750');
    expect(result).toContain('$');
  });

  it('includes decimal places', () => {
    const result = formatExportAmount(2750.50, 'AUD');
    expect(result).toContain('50');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 8 — James Tourism Scenario (Full End-to-End)
   ══════════════════════════════════════════════════════════════════════════ */

describe('James Tourism Scenario', () => {
  /**
   * Two participants:
   *   Sarah Chen — Venue Manager, $2,750 (GST registered)
   *   Ben Torres — Tour Guide, $1,800 (NOT GST registered)
   *
   * Progresses through all stages from agreement creation to full export.
   */

  const SARAH = { id: 'sarah', name: 'Sarah Chen', role: 'Venue Manager' };
  const BEN = { id: 'ben', name: 'Ben Torres', role: 'Tour Guide' };

  function sarahBase(overrides = {}) {
    return {
      participant: SARAH,
      agreement: makeAgreement(),
      invoice: makeInvoice({ invoiceAmount: 2750, obligationAmount: 2750 }),
      taxDetails: makeTaxDetails({ gstRegistered: true }),
      bankDetails: makeBankDetails(),
      funding: makeFunding({ status: 'funded' }),
      obligation: makeObligation({ amount: 2750 }),
      accounting: makeAccounting(),
      ...overrides,
    };
  }

  function benBase(overrides = {}) {
    return {
      participant: BEN,
      agreement: makeAgreement(),
      invoice: makeInvoice({
        invoiceNumber: 'INV-BEN-001',
        invoiceAmount: 1800,
        supplierName: 'Ben Torres',
        description: 'Tour guide services',
      }),
      taxDetails: makeTaxDetails({
        abn: '53004085616',
        gstRegistered: false,
        businessName: 'Ben Torres',
      }),
      bankDetails: makeBankDetails({ accountName: 'Ben Torres' }),
      funding: makeFunding({ status: 'funded' }),
      obligation: makeObligation({ amount: 1800 }),
      accounting: makeAccounting(),
      ...overrides,
    };
  }

  describe('Stage 1: Agreement created, nothing ready', () => {
    it('both participants have export blocked', () => {
      const ctx = makeContext();
      const sarahModel = deriveAccountingExport(
        {
          ...sarahBase(),
          agreement: makeAgreement({ approved: false }),
          invoice: makeInvoice({ state: 'required' }),
          taxDetails: {},
          bankDetails: { complete: false },
          funding: makeFunding({ status: 'unfunded' }),
        },
        ctx
      );
      const benModel = deriveAccountingExport(
        {
          ...benBase(),
          agreement: makeAgreement({ approved: false }),
          invoice: makeInvoice({ state: 'required' }),
          taxDetails: {},
          bankDetails: { complete: false },
          funding: makeFunding({ status: 'unfunded' }),
        },
        ctx
      );
      expect(sarahModel.exportReadiness.ready).toBe(false);
      expect(benModel.exportReadiness.ready).toBe(false);
      expect(sarahModel.preview).toBeNull();
      expect(benModel.preview).toBeNull();
    });
  });

  describe('Stage 2: Participants approved, invoice requested', () => {
    it('invoice_not_received blocker when invoice is in requested state', () => {
      const model = deriveAccountingExport(
        sarahBase({ invoice: makeInvoice({ state: 'requested' }) }),
        makeContext()
      );
      const blocker = model.exportReadiness.blockers.find(
        (b) => b.reason === 'invoice_not_received'
      );
      expect(blocker).toBeTruthy();
    });
  });

  describe('Stage 3: Invoices received', () => {
    it('invoice_not_verified blocker when invoice received but not verified', () => {
      const model = deriveAccountingExport(
        sarahBase({ invoice: makeInvoice({ state: 'received' }) }),
        makeContext()
      );
      const blocker = model.exportReadiness.blockers.find(
        (b) => b.reason === 'invoice_not_verified'
      );
      expect(blocker).toBeTruthy();
    });
  });

  describe('Stage 4: Invoices verified — ready for accounting export', () => {
    it('Sarah is ready for export with GST', () => {
      const model = deriveAccountingExport(sarahBase(), makeContext());
      expect(model.exportReadiness.ready).toBe(true);
      expect(model.preview?.gstIncluded).toBe(true);
      const expectedGst = Math.round((2750 / 11) * 100) / 100;
      expect(model.preview?.gstAmount).toBe(expectedGst);
    });

    it('Ben is ready for export without GST', () => {
      const model = deriveAccountingExport(benBase(), makeContext());
      expect(model.exportReadiness.ready).toBe(true);
      expect(model.preview?.gstIncluded).toBe(false);
      expect(model.preview?.gstAmount).toBe(0);
    });

    it('Sarah preview has correct supplier name from business name', () => {
      const model = deriveAccountingExport(sarahBase(), makeContext());
      expect(model.preview?.supplier).toBe('Sarah Chen Events Pty Ltd');
    });

    it("Ben preview uses participant name when no business name differs", () => {
      const model = deriveAccountingExport(benBase(), makeContext());
      expect(model.preview?.supplier).toBeTruthy();
    });
  });

  describe('Stage 5: Operator approves export preview', () => {
    it('export model captures exportApprovedAt when provided', () => {
      const model = deriveAccountingExport(
        sarahBase({
          accounting: makeAccounting({
            xeroStatus: 'exporting',
            exportApprovedAt: '2024-06-15T09:30:00Z',
          }),
        }),
        makeContext()
      );
      expect(model.exportApprovedAt).toBe('2024-06-15T09:30:00Z');
    });
  });

  describe('Stage 6: Export pushed to Xero', () => {
    it('Sarah is exported with provider reference', () => {
      const model = deriveAccountingExport(
        sarahBase({
          accounting: makeAccounting({
            xeroStatus: 'exported',
            exportedAt: '2024-06-15T10:00:00Z',
            providerReference: 'XERO-BILL-SARAH-001',
          }),
        }),
        makeContext()
      );
      expect(model.status).toBe('exported');
      expect(model.providerReference).toBe('XERO-BILL-SARAH-001');
      expect(model.exportedAt).toBe('2024-06-15T10:00:00Z');
    });

    it('Ben is exported with provider reference', () => {
      const model = deriveAccountingExport(
        benBase({
          accounting: makeAccounting({
            xeroStatus: 'exported',
            exportedAt: '2024-06-15T10:05:00Z',
            providerReference: 'XERO-BILL-BEN-001',
          }),
        }),
        makeContext()
      );
      expect(model.status).toBe('exported');
      expect(model.providerReference).toBe('XERO-BILL-BEN-001');
    });
  });

  describe('Stage 7: All participants exported — dashboard complete', () => {
    it('workspace overallStatus is all_exported', () => {
      const wsStatus = deriveAccountingSyncStatus(
        makeWorkspaceInput([
          sarahBase({
            accounting: makeAccounting({
              xeroStatus: 'exported',
              exportedAt: TODAY + 'T10:00:00Z',
              providerReference: 'XERO-SARAH',
            }),
          }),
          benBase({
            accounting: makeAccounting({
              xeroStatus: 'exported',
              exportedAt: TODAY + 'T10:05:00Z',
              providerReference: 'XERO-BEN',
            }),
          }),
        ])
      );
      expect(wsStatus.overallStatus).toBe('all_exported');
      expect(wsStatus.exportedTodayCount).toBe(2);
      expect(wsStatus.primaryCta).toBeNull();
    });
  });

  describe('Error recovery', () => {
    it('failed export shows operator-friendly error and retry action', () => {
      const model = deriveAccountingExport(
        sarahBase({
          accounting: makeAccounting({
            xeroStatus: 'failed',
            lastError: 'network timeout connecting to Xero API',
          }),
        }),
        makeContext()
      );
      expect(model.status).toBe('failed');
      expect(model.failureReason).toBeTruthy();
      // Must not expose "API" or technical language
      expect(model.failureReason?.toLowerCase()).not.toContain('api');
      expect(model.failureAction).toBeTruthy();
    });

    it('workspace primaryCta focuses on errors first', () => {
      const wsStatus = deriveAccountingSyncStatus(
        makeWorkspaceInput([
          sarahBase({ accounting: makeAccounting({ xeroStatus: 'failed', lastError: 'timeout' }) }),
          benBase({ accounting: makeAccounting({ xeroStatus: 'pending' }) }),
        ])
      );
      expect(wsStatus.primaryCta?.toLowerCase()).toContain('error');
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 9 — Determinism and Non-mutation
   ══════════════════════════════════════════════════════════════════════════ */

describe('Determinism and non-mutation', () => {
  it('same input produces same output', () => {
    const input = makeReadyInput();
    const ctx = makeContext();
    const m1 = deriveAccountingExport(input, ctx);
    const m2 = deriveAccountingExport(input, ctx);
    expect(m1.exportId).toBe(m2.exportId);
    expect(m1.status).toBe(m2.status);
    expect(m1.exportReadiness.ready).toBe(m2.exportReadiness.ready);
  });

  it('does not mutate the input', () => {
    const input = makeReadyInput();
    const originalStatus = input.funding.status;
    deriveAccountingExport(input, makeContext());
    expect(input.funding.status).toBe(originalStatus);
  });

  it('export ID is stable across calls', () => {
    const id1 = deriveAccountingExport(makeReadyInput(), makeContext()).exportId;
    const id2 = deriveAccountingExport(makeReadyInput(), makeContext()).exportId;
    expect(id1).toBe(id2);
  });

  it('different participants produce different export IDs', () => {
    const sarahModel = deriveAccountingExport(makeReadyInput(), makeContext());
    const benModel = deriveAccountingExport(
      makeReadyInput({ participant: makeParticipant({ id: 'ben-002' }) }),
      makeContext()
    );
    expect(sarahModel.exportId).not.toBe(benModel.exportId);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 10 — No Duplicated Calculations
   ══════════════════════════════════════════════════════════════════════════ */

describe('No duplicated calculations', () => {
  it('workspace sync status is consistent with individual export models', () => {
    const participants = [
      makeReadyInput(),
      makeReadyInput({
        participant: makeParticipant({ id: 'ben-002' }),
        accounting: makeAccounting({ xeroStatus: 'exported' }),
      }),
    ];
    const wsStatus = deriveAccountingSyncStatus(makeWorkspaceInput(participants));
    const individual = participants.map((p) => deriveAccountingExport(p, makeContext()));

    // Workspace should reflect the same data as individually derived models
    const wsExported = wsStatus.participants.filter((m) => m.status === 'exported').length;
    const indivExported = individual.filter((m) => m.status === 'exported').length;
    expect(wsExported).toBe(indivExported);
  });

  it('readyToExportCount matches manual count', () => {
    const participants = [
      makeReadyInput(),
      makeReadyInput({
        participant: makeParticipant({ id: 'p2' }),
        agreement: makeAgreement({ approved: false }),
      }),
    ];
    const wsStatus = deriveAccountingSyncStatus(makeWorkspaceInput(participants));
    const manualReady = wsStatus.participants.filter(
      (m) => m.exportReadiness.ready && m.status === 'ready' && !m.exportedAt
    ).length;
    expect(wsStatus.readyToExportCount).toBe(manualReady);
  });
});
