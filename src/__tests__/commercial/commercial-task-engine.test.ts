/**
 * Operations Automation Regression Tests
 *
 * Comprehensive test suite for the canonical Commercial Task Engine.
 *
 * Covers:
 *   - Event → Task generation (every workflow stage generates correct tasks)
 *   - Automatic next actions (each stage triggers the right next task)
 *   - Deadline detection (overdue, due today, due this week)
 *   - Risk escalation (severity assignment, consequence descriptions)
 *   - No duplicate task generation
 *   - Dashboard queue grouping (today / this week / waiting / completed)
 *   - Provvy narrative ("What should I do now?")
 *   - Workspace-level tasks (payment provider, revenue collection, archive)
 *   - Invoice discrepancy detection
 *   - James tourism scenario (full 10-stage lifecycle)
 *   - Determinism — same inputs → same outputs
 *   - Single canonical task engine
 */

import {
  deriveCommercialTasks,
  addDays,
  daysDiff,
} from '../../lib/commercial/commercial-task-engine';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const TODAY = '2024-06-15';

/* ─── Fixtures ───────────────────────────────────────────────────────────── */

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
    agreementGenerated: true,
    earningsConfigured: true,
    sentAt: '2024-06-10',
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    state: 'verified',
    requestedAt: '2024-06-11',
    receivedAt: '2024-06-12',
    invoiceDueDate: null,
    invoiceAmount: 2500,
    obligationAmount: 2500,
    ...overrides,
  };
}

function makeTaxDetails(overrides = {}) {
  return {
    abn: '51824753556',
    gstRegistered: true,
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

function makeAccounting(overrides = {}) {
  return {
    xeroStatus: 'exported',
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

/** A fully settled (paid) participant — all tasks should be complete. */
function makeCompleteParticipant(id = 'p1', name = 'Sarah Chen') {
  return {
    participant: makeParticipant({ id, name }),
    agreement: makeAgreement(),
    invoice: makeInvoice({ state: 'ready_for_settlement' }),
    taxDetails: makeTaxDetails(),
    bankDetails: makeBankDetails(),
    funding: makeFunding({ status: 'paid' }),
    accounting: makeAccounting(),
    obligation: makeObligation(),
  };
}

/** A participant early in the workflow — nothing configured. */
function makeNewParticipant(id = 'p1', name = 'Sarah Chen') {
  return {
    participant: makeParticipant({ id, name }),
    agreement: { approved: false, agreementGenerated: false, earningsConfigured: false },
    invoice: { state: 'required', requestedAt: null, receivedAt: null, invoiceDueDate: null, invoiceAmount: null, obligationAmount: 2500 },
    taxDetails: {},
    bankDetails: { complete: false },
    funding: { status: 'unfunded' },
    accounting: { xeroStatus: 'pending' },
    obligation: makeObligation(),
  };
}

/** Build a standard task input. */
function makeInput(overrides = {}) {
  return {
    projectId: 'proj-001',
    currentDate: TODAY,
    participants: [],
    paymentProviderConnected: true,
    revenueCollectionEnabled: true,
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   PART 1 — Date Utilities
   ══════════════════════════════════════════════════════════════════════════ */

describe('Date utilities', () => {
  describe('addDays', () => {
    it('adds positive days', () => {
      expect(addDays('2024-06-15', 1)).toBe('2024-06-16');
    });

    it('adds 7 days across month boundary', () => {
      expect(addDays('2024-06-28', 7)).toBe('2024-07-05');
    });

    it('adds 0 days returns same date', () => {
      expect(addDays('2024-06-15', 0)).toBe('2024-06-15');
    });

    it('handles negative days (subtracts)', () => {
      expect(addDays('2024-06-15', -3)).toBe('2024-06-12');
    });
  });

  describe('daysDiff', () => {
    it('returns positive when dateA is after dateB', () => {
      expect(daysDiff('2024-06-17', '2024-06-15')).toBe(2);
    });

    it('returns negative when dateA is before dateB', () => {
      expect(daysDiff('2024-06-13', '2024-06-15')).toBe(-2);
    });

    it('returns 0 for same date', () => {
      expect(daysDiff('2024-06-15', '2024-06-15')).toBe(0);
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 2 — Empty / No Participants
   ══════════════════════════════════════════════════════════════════════════ */

describe('deriveCommercialTasks — empty input', () => {
  it('returns empty task list when no participants', () => {
    const result = deriveCommercialTasks(makeInput());
    expect(result.tasks).toHaveLength(0);
    expect(result.activeCount).toBe(0);
    expect(result.primaryTask).toBeNull();
  });

  it('returns a Provvy narrative even for empty state', () => {
    const result = deriveCommercialTasks(makeInput());
    expect(result.provvyNarrative).toBeTruthy();
    expect(typeof result.provvyNarrative).toBe('string');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 3 — Workflow Stage → Task Generation
   ══════════════════════════════════════════════════════════════════════════ */

describe('Event → Task generation', () => {
  describe('Stage 1: Earnings not configured', () => {
    it('generates configure_earnings task', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [makeNewParticipant()],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'configure_earnings');
      expect(task).toBeTruthy();
      expect(task?.participantName).toBe('Sarah Chen');
      expect(task?.priority).toBe('high');
    });

    it('configure_earnings task is not present when earnings are configured', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...makeNewParticipant(),
              agreement: { approved: false, agreementGenerated: false, earningsConfigured: true },
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'configure_earnings');
      expect(task).toBeFalsy();
    });
  });

  describe('Stage 2: Earnings configured, agreement not generated', () => {
    it('generates generate_agreement task', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...makeNewParticipant(),
              agreement: { approved: false, agreementGenerated: false, earningsConfigured: true },
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'generate_agreement');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('high');
    });
  });

  describe('Stage 3: Agreement generated, not sent', () => {
    it('generates send_approval task', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...makeNewParticipant(),
              agreement: {
                approved: false,
                agreementGenerated: true,
                earningsConfigured: true,
                sentAt: null,
              },
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'send_approval');
      expect(task).toBeTruthy();
      expect(task?.status).toBe('pending');
    });
  });

  describe('Stage 4: Approval sent, waiting', () => {
    it('generates waiting send_approval task when recently sent', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...makeNewParticipant(),
              agreement: {
                approved: false,
                agreementGenerated: true,
                earningsConfigured: true,
                sentAt: addDays(TODAY, -2), // sent 2 days ago
              },
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'send_approval');
      expect(task?.status).toBe('waiting');
      expect(task?.group).toBe('waiting');
    });

    it('generates chase_approval task when overdue (sent > 5 days ago)', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...makeNewParticipant(),
              agreement: {
                approved: false,
                agreementGenerated: true,
                earningsConfigured: true,
                sentAt: addDays(TODAY, -8), // 8 days ago — overdue
              },
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'chase_approval');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('high');
    });

    it('creates a risk when approval is overdue', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...makeNewParticipant(),
              agreement: {
                approved: false,
                agreementGenerated: true,
                earningsConfigured: true,
                sentAt: addDays(TODAY, -8),
              },
            },
          ],
        })
      );
      const risk = result.risks.find((r) => r.id === 'p1:approval_overdue');
      expect(risk).toBeTruthy();
      expect(risk?.severity).toBe('high');
    });
  });

  describe('Stage 5: Approved — invoice required', () => {
    it('generates request_invoice task after approval', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({ state: 'required', requestedAt: null }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'request_invoice');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('high');
    });
  });

  describe('Stage 6: Invoice requested — waiting', () => {
    it('generates waiting task when invoice requested but not received', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({
                state: 'requested',
                requestedAt: addDays(TODAY, -1),
                invoiceDueDate: addDays(TODAY, 6),
              }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.group === 'waiting' || t.status === 'waiting');
      expect(task).toBeTruthy();
    });

    it('generates critical chase task when invoice is overdue', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({
                state: 'requested',
                requestedAt: addDays(TODAY, -10),
                invoiceDueDate: addDays(TODAY, -3), // overdue by 3 days
              }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'chase_invoice');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('critical');
      expect(task?.isOverdue).toBe(true);
    });

    it('creates a critical risk when invoice is overdue', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({
                state: 'requested',
                requestedAt: addDays(TODAY, -10),
                invoiceDueDate: addDays(TODAY, -3),
              }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const risk = result.risks.find((r) => r.id === 'p1:invoice_overdue');
      expect(risk).toBeTruthy();
      expect(risk?.severity).toBe('critical');
    });
  });

  describe('Stage 7: Invoice received — review required', () => {
    it('generates review_invoice task', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({ state: 'received' }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'review_invoice');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('high');
    });
  });

  describe('Stage 8: Invoice verified — export to Xero', () => {
    it('generates export_to_xero task when accounting is pending', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({ state: 'verified' }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'funded' }),
              accounting: makeAccounting({ xeroStatus: 'pending' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'export_to_xero');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('high');
    });

    it('does NOT generate export_to_xero when already exported', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({ state: 'ready_for_settlement' }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'funded' }),
              accounting: makeAccounting({ xeroStatus: 'exported' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'export_to_xero');
      expect(task).toBeFalsy();
    });
  });

  describe('Stage 9: Ready for settlement — release payment', () => {
    it('generates release_payment task when all conditions met', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({ state: 'ready_for_settlement' }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'funded' }),
              accounting: makeAccounting({ xeroStatus: 'exported' }),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'release_payment');
      expect(task).toBeTruthy();
      expect(task?.status).toBe('pending');
      expect(task?.priority).toBe('high');
    });

    it('does NOT generate release_payment when funding is unfunded', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice({ state: 'ready_for_settlement' }),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting(),
              obligation: makeObligation(),
            },
          ],
        })
      );
      const task = result.tasks.find(
        (t) => t.taskType === 'release_payment' && t.status === 'pending'
      );
      expect(task).toBeFalsy();
    });
  });

  describe('Stage 10: Paid — completed', () => {
    it('marks release_payment as completed when paid', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [makeCompleteParticipant()],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'release_payment');
      expect(task?.status).toBe('completed');
      expect(task?.group).toBe('completed');
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 4 — Workspace-Level Tasks
   ══════════════════════════════════════════════════════════════════════════ */

describe('Workspace-level tasks', () => {
  describe('Payment provider', () => {
    it('generates connect_payment_provider task when all approved but not connected', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice(),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding(),
              accounting: makeAccounting(),
              obligation: makeObligation(),
            },
          ],
          paymentProviderConnected: false,
          revenueCollectionEnabled: false,
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'connect_payment_provider');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('critical');
    });

    it('creates a risk when payment provider is not connected', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice(),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding(),
              accounting: makeAccounting(),
              obligation: makeObligation(),
            },
          ],
          paymentProviderConnected: false,
          revenueCollectionEnabled: false,
        })
      );
      const risk = result.risks.find((r) => r.id === 'workspace:payment_provider_missing');
      expect(risk).toBeTruthy();
      expect(risk?.severity).toBe('critical');
    });

    it('does NOT generate connect_payment_provider when already connected', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice(),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding(),
              accounting: makeAccounting(),
              obligation: makeObligation(),
            },
          ],
          paymentProviderConnected: true,
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'connect_payment_provider');
      expect(task).toBeFalsy();
    });
  });

  describe('Revenue collection', () => {
    it('generates enable_revenue_collection task when provider connected but not enabled', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant(),
              agreement: makeAgreement(),
              invoice: makeInvoice(),
              taxDetails: makeTaxDetails(),
              bankDetails: makeBankDetails(),
              funding: makeFunding(),
              accounting: makeAccounting(),
              obligation: makeObligation(),
            },
          ],
          paymentProviderConnected: true,
          revenueCollectionEnabled: false,
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'enable_revenue_collection');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('high');
    });
  });

  describe('Archive agreement', () => {
    it('generates archive_agreement task when all participants are paid', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            makeCompleteParticipant('p1', 'Sarah'),
            makeCompleteParticipant('p2', 'Ben'),
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'archive_agreement');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('low');
    });

    it('does NOT generate archive when some participants are not paid', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            makeCompleteParticipant('p1', 'Sarah'),
            {
              ...makeCompleteParticipant('p2', 'Ben'),
              funding: makeFunding({ status: 'funded' }),
            },
          ],
        })
      );
      const task = result.tasks.find((t) => t.taskType === 'archive_agreement');
      expect(task).toBeFalsy();
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 5 — Risk Escalation
   ══════════════════════════════════════════════════════════════════════════ */

describe('Risk escalation', () => {
  it('every risk has id, title, explanation, consequence, action, severity, detectedAt', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            ...makeNewParticipant(),
            agreement: {
              approved: false,
              agreementGenerated: true,
              earningsConfigured: true,
              sentAt: addDays(TODAY, -8),
            },
          },
        ],
        paymentProviderConnected: false,
      })
    );

    for (const risk of result.risks) {
      expect(risk.id).toBeTruthy();
      expect(risk.title).toBeTruthy();
      expect(risk.explanation).toBeTruthy();
      expect(risk.consequence).toBeTruthy();
      expect(risk.action).toBeTruthy();
      expect(['critical', 'high', 'medium', 'low']).toContain(risk.severity);
      expect(risk.detectedAt).toBe(TODAY);
    }
  });

  it('invoice mismatch creates critical risk', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice({
              state: 'received',
              invoiceAmount: 3500, // Mismatch: obligation is 2500
              obligationAmount: 2500,
            }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation({ amount: 2500 }),
          },
        ],
      })
    );
    const risk = result.risks.find((r) => r.id === 'p1:invoice_mismatch');
    expect(risk).toBeTruthy();
    expect(risk?.severity).toBe('critical');
  });

  it('missing bank details creates high risk', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice(),
            taxDetails: makeTaxDetails(),
            bankDetails: { bsb: null, accountNumber: null, accountName: null, complete: false },
            funding: makeFunding({ status: 'funded' }),
            accounting: makeAccounting(),
            obligation: makeObligation(),
          },
        ],
      })
    );
    const risk = result.risks.find((r) => r.id === 'p1:missing_bank_details');
    expect(risk).toBeTruthy();
    expect(risk?.severity).toBe('high');
  });

  it('unfunded obligation creates critical risk', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice(),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting(),
            obligation: makeObligation(),
          },
        ],
      })
    );
    const risk = result.risks.find((r) => r.id === 'p1:funding_not_confirmed');
    expect(risk).toBeTruthy();
    expect(risk?.severity).toBe('critical');
  });

  it('no risks generated for a fully settled participant', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [makeCompleteParticipant()],
      })
    );
    const participantRisks = result.risks.filter((r) => r.participantId === 'p1');
    expect(participantRisks).toHaveLength(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 6 — Task Queue Grouping
   ══════════════════════════════════════════════════════════════════════════ */

describe('Task queue grouping', () => {
  it('overdue tasks appear in todaysTasks', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice({
              state: 'requested',
              requestedAt: addDays(TODAY, -10),
              invoiceDueDate: addDays(TODAY, -3), // 3 days overdue
            }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
        ],
      })
    );
    expect(result.todaysTasks.length).toBeGreaterThan(0);
    expect(result.overdueCount).toBeGreaterThan(0);
  });

  it('waiting tasks appear in waitingTasks', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            ...makeNewParticipant(),
            agreement: {
              approved: false,
              agreementGenerated: true,
              earningsConfigured: true,
              sentAt: addDays(TODAY, -2),
            },
          },
        ],
      })
    );
    expect(result.waitingTasks.length).toBeGreaterThan(0);
  });

  it('completed tasks appear in completedTasks', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [makeCompleteParticipant()],
      })
    );
    expect(result.completedTasks.length).toBeGreaterThan(0);
  });

  it('tasks are sorted with critical/overdue first', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant({ id: 'p1', name: 'Sarah' }),
            agreement: makeAgreement(),
            invoice: makeInvoice({
              state: 'requested',
              requestedAt: addDays(TODAY, -10),
              invoiceDueDate: addDays(TODAY, -3),
            }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
          {
            participant: makeParticipant({ id: 'p2', name: 'Ben' }),
            agreement: makeAgreement(),
            invoice: makeInvoice({ state: 'received' }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
        ],
      })
    );

    // First non-completed task should be overdue or critical
    const activeTasks = result.tasks.filter((t) => t.status !== 'completed');
    if (activeTasks.length > 1) {
      const first = activeTasks[0];
      const last = activeTasks[activeTasks.length - 1];
      const firstPriority = ['critical', 'high', 'medium', 'low'].indexOf(first.priority);
      const lastPriority = ['critical', 'high', 'medium', 'low'].indexOf(last.priority);
      expect(firstPriority).toBeLessThanOrEqual(lastPriority);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 7 — Deadline Detection
   ══════════════════════════════════════════════════════════════════════════ */

describe('Deadline detection', () => {
  it('detects overdue invoices (isOverdue = true)', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice({
              state: 'requested',
              requestedAt: addDays(TODAY, -10),
              invoiceDueDate: addDays(TODAY, -3),
            }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
        ],
      })
    );

    const overdueTasks = result.tasks.filter((t) => t.isOverdue);
    expect(overdueTasks.length).toBeGreaterThan(0);
    expect(result.overdueCount).toBe(overdueTasks.length);
  });

  it('correctly computes daysUntilDue for upcoming tasks', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice({ state: 'received' }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
        ],
      })
    );
    const task = result.tasks.find((t) => t.taskType === 'review_invoice');
    expect(task?.daysUntilDue).toBe(1); // due tomorrow
    expect(task?.isOverdue).toBe(false);
  });

  it('task with no dueDate has daysUntilDue = null', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [makeCompleteParticipant()],
      })
    );
    const task = result.tasks.find((t) => t.dueDate === null);
    if (task) {
      expect(task.daysUntilDue).toBeNull();
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 8 — No Duplicate Tasks
   ══════════════════════════════════════════════════════════════════════════ */

describe('No duplicate tasks', () => {
  it('each task has a unique ID', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          makeNewParticipant('p1', 'Sarah'),
          makeNewParticipant('p2', 'Ben'),
        ],
      })
    );
    const ids = result.tasks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('calling deriveCommercialTasks twice with same input produces same tasks', () => {
    const input = makeInput({
      participants: [makeNewParticipant()],
    });
    const r1 = deriveCommercialTasks(input);
    const r2 = deriveCommercialTasks(input);
    expect(r1.tasks.map((t) => t.id)).toEqual(r2.tasks.map((t) => t.id));
  });

  it('no duplicate risks for the same participant+type', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice({
              state: 'requested',
              requestedAt: addDays(TODAY, -10),
              invoiceDueDate: addDays(TODAY, -3),
            }),
            taxDetails: makeTaxDetails(),
            bankDetails: { complete: false },
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
        ],
      })
    );
    const riskIds = result.risks.map((r) => r.id);
    const uniqueRiskIds = new Set(riskIds);
    expect(uniqueRiskIds.size).toBe(riskIds.length);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 9 — Provvy Narrative
   ══════════════════════════════════════════════════════════════════════════ */

describe('Provvy narrative', () => {
  it('says everything is up to date when no tasks', () => {
    const result = deriveCommercialTasks(makeInput());
    expect(result.provvyNarrative.toLowerCase()).toContain('up to date');
  });

  it('mentions overdue items when present', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [
          {
            participant: makeParticipant(),
            agreement: makeAgreement(),
            invoice: makeInvoice({
              state: 'requested',
              requestedAt: addDays(TODAY, -10),
              invoiceDueDate: addDays(TODAY, -3),
            }),
            taxDetails: makeTaxDetails(),
            bankDetails: makeBankDetails(),
            funding: makeFunding({ status: 'unfunded' }),
            accounting: makeAccounting({ xeroStatus: 'not_required' }),
            obligation: makeObligation(),
          },
        ],
      })
    );
    expect(result.provvyNarrative.toLowerCase()).toContain('overdue');
  });

  it('ends with recommended next action when tasks exist', () => {
    const result = deriveCommercialTasks(
      makeInput({
        participants: [makeNewParticipant()],
      })
    );
    expect(result.provvyNarrative.toLowerCase()).toContain('recommended next action');
  });

  it('narrative is a non-empty string', () => {
    const result = deriveCommercialTasks(makeInput({ participants: [makeNewParticipant()] }));
    expect(typeof result.provvyNarrative).toBe('string');
    expect(result.provvyNarrative.length).toBeGreaterThan(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 10 — James Tourism Scenario (End-to-End)
   ══════════════════════════════════════════════════════════════════════════ */

describe('James Tourism Scenario', () => {
  /**
   * Two participants:
   *   Sarah Chen  — Venue Manager, fixed fee $2,500
   *   Ben Torres  — Tour Guide, fixed fee $1,800
   *
   * Progresses through all 10 lifecycle stages.
   */

  function sarahCtx(overrides = {}) {
    return {
      participant: makeParticipant({ id: 'sarah', name: 'Sarah Chen', role: 'Venue Manager' }),
      agreement: makeAgreement(),
      invoice: makeInvoice({ obligationAmount: 2500, invoiceAmount: 2500 }),
      taxDetails: makeTaxDetails(),
      bankDetails: makeBankDetails(),
      funding: makeFunding(),
      accounting: makeAccounting(),
      obligation: makeObligation({ amount: 2500 }),
      ...overrides,
    };
  }

  function benCtx(overrides = {}) {
    return {
      participant: makeParticipant({ id: 'ben', name: 'Ben Torres', role: 'Tour Guide' }),
      agreement: makeAgreement(),
      invoice: makeInvoice({ obligationAmount: 1800, invoiceAmount: 1800 }),
      taxDetails: makeTaxDetails(),
      bankDetails: makeBankDetails(),
      funding: makeFunding({ status: 'funded' }),
      accounting: makeAccounting(),
      obligation: makeObligation({ amount: 1800 }),
      ...overrides,
    };
  }

  describe('Stage 1: Agreement just created, no participants configured', () => {
    it('generates configure_earnings for both participants', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              participant: makeParticipant({ id: 'sarah', name: 'Sarah Chen' }),
              agreement: { approved: false, agreementGenerated: false, earningsConfigured: false },
              invoice: { state: 'required' },
              taxDetails: {},
              bankDetails: { complete: false },
              funding: { status: 'unfunded' },
              accounting: { xeroStatus: 'pending' },
              obligation: makeObligation({ amount: 2500 }),
            },
            {
              participant: makeParticipant({ id: 'ben', name: 'Ben Torres' }),
              agreement: { approved: false, agreementGenerated: false, earningsConfigured: false },
              invoice: { state: 'required' },
              taxDetails: {},
              bankDetails: { complete: false },
              funding: { status: 'unfunded' },
              accounting: { xeroStatus: 'pending' },
              obligation: makeObligation({ amount: 1800 }),
            },
          ],
          paymentProviderConnected: false,
          revenueCollectionEnabled: false,
        })
      );

      const earningsTasks = result.tasks.filter((t) => t.taskType === 'configure_earnings');
      expect(earningsTasks).toHaveLength(2);
      expect(result.activeCount).toBeGreaterThan(0);
    });
  });

  describe('Stage 2: Approvals sent, waiting', () => {
    it('generates waiting tasks for both participants', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            sarahCtx({
              agreement: {
                ...makeAgreement(),
                approved: false,
                sentAt: addDays(TODAY, -2),
              },
            }),
            benCtx({
              agreement: {
                ...makeAgreement(),
                approved: false,
                sentAt: addDays(TODAY, -2),
              },
            }),
          ],
          paymentProviderConnected: false,
          revenueCollectionEnabled: false,
        })
      );

      expect(result.waitingTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Stage 3: All approved, payment provider needed', () => {
    it('generates connect_payment_provider as critical task', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [sarahCtx(), benCtx()],
          paymentProviderConnected: false,
          revenueCollectionEnabled: false,
        })
      );

      const task = result.tasks.find((t) => t.taskType === 'connect_payment_provider');
      expect(task).toBeTruthy();
      expect(task?.priority).toBe('critical');
      expect(result.criticalCount).toBeGreaterThan(0);
    });
  });

  describe('Stage 4: Approved, invoices requested', () => {
    it('generates waiting tasks for invoice submission', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({
                state: 'requested',
                requestedAt: addDays(TODAY, -1),
                invoiceDueDate: addDays(TODAY, 6),
              }),
            }),
            benCtx({
              invoice: makeInvoice({
                state: 'requested',
                requestedAt: addDays(TODAY, -1),
                invoiceDueDate: addDays(TODAY, 6),
              }),
            }),
          ],
        })
      );
      expect(result.waitingTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Stage 5: Invoices received, review needed', () => {
    it('generates review_invoice tasks for both participants', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'received' }),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
            }),
            benCtx({
              invoice: makeInvoice({ state: 'received', invoiceAmount: 1800, obligationAmount: 1800 }),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
            }),
          ],
        })
      );
      const reviewTasks = result.tasks.filter((t) => t.taskType === 'review_invoice');
      expect(reviewTasks).toHaveLength(2);
    });
  });

  describe('Stage 6: Invoices verified, Xero export needed', () => {
    it('generates export_to_xero tasks when accounting is pending', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'verified' }),
              funding: makeFunding({ status: 'funded' }),
              accounting: makeAccounting({ xeroStatus: 'pending' }),
            }),
            benCtx({
              invoice: makeInvoice({ state: 'verified', invoiceAmount: 1800, obligationAmount: 1800 }),
              accounting: makeAccounting({ xeroStatus: 'pending' }),
            }),
          ],
        })
      );
      const xeroTasks = result.tasks.filter((t) => t.taskType === 'export_to_xero');
      expect(xeroTasks).toHaveLength(2);
    });
  });

  describe('Stage 7: Funding confirmed, Xero exported — ready for payment', () => {
    it('generates release_payment for both participants', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'ready_for_settlement' }),
              funding: makeFunding({ status: 'funded' }),
            }),
            benCtx({
              invoice: makeInvoice({ state: 'ready_for_settlement', invoiceAmount: 1800, obligationAmount: 1800 }),
            }),
          ],
        })
      );
      const paymentTasks = result.tasks.filter(
        (t) => t.taskType === 'release_payment' && t.status === 'pending'
      );
      expect(paymentTasks).toHaveLength(2);
    });
  });

  describe('Stage 8: Both participants paid — archive', () => {
    it('generates archive_agreement and marks all payments as complete', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            {
              ...sarahCtx(),
              funding: makeFunding({ status: 'paid' }),
            },
            {
              ...benCtx(),
              funding: makeFunding({ status: 'paid' }),
            },
          ],
        })
      );

      const completedPayments = result.tasks.filter(
        (t) => t.taskType === 'release_payment' && t.status === 'completed'
      );
      expect(completedPayments).toHaveLength(2);

      const archiveTask = result.tasks.find((t) => t.taskType === 'archive_agreement');
      expect(archiveTask).toBeTruthy();
    });

    it('no active tasks remain and no risks for a fully settled agreement', () => {
      const result = deriveCommercialTasks(
        makeInput({
          participants: [
            { ...sarahCtx(), funding: makeFunding({ status: 'paid' }) },
            { ...benCtx(), funding: makeFunding({ status: 'paid' }) },
          ],
        })
      );

      // Only active task should be the low-priority archive
      const activeTasks = result.tasks.filter(
        (t) => t.status !== 'completed' && t.priority !== 'low'
      );
      expect(activeTasks).toHaveLength(0);

      const participantRisks = result.risks.filter((r) => r.participantId);
      expect(participantRisks).toHaveLength(0);
    });
  });

  describe('Journey continuity — no manual workflow progression', () => {
    it('every stage produces at least one active task until all paid', () => {
      const stages = [
        // Stage 1: nothing configured
        makeInput({
          participants: [
            {
              participant: makeParticipant({ id: 'sarah' }),
              agreement: { approved: false, agreementGenerated: false, earningsConfigured: false },
              invoice: { state: 'required' },
              taxDetails: {},
              bankDetails: { complete: false },
              funding: { status: 'unfunded' },
              accounting: { xeroStatus: 'pending' },
              obligation: makeObligation({ amount: 2500 }),
            },
          ],
          paymentProviderConnected: false,
        }),
        // Stage 2: earnings configured, not generated
        makeInput({
          participants: [
            {
              participant: makeParticipant({ id: 'sarah' }),
              agreement: { approved: false, agreementGenerated: false, earningsConfigured: true },
              invoice: { state: 'required' },
              taxDetails: {},
              bankDetails: { complete: false },
              funding: { status: 'unfunded' },
              accounting: { xeroStatus: 'pending' },
              obligation: makeObligation({ amount: 2500 }),
            },
          ],
          paymentProviderConnected: false,
        }),
        // Stage 3: approved, invoice required
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'required', requestedAt: null }),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
            }),
          ],
        }),
        // Stage 4: invoice received
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'received' }),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
            }),
          ],
        }),
        // Stage 5: invoice verified, funding needed
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'verified' }),
              funding: makeFunding({ status: 'unfunded' }),
              accounting: makeAccounting({ xeroStatus: 'not_required' }),
            }),
          ],
        }),
        // Stage 6: ready for payment
        makeInput({
          participants: [
            sarahCtx({
              invoice: makeInvoice({ state: 'ready_for_settlement' }),
              funding: makeFunding({ status: 'funded' }),
            }),
          ],
        }),
      ];

      for (const stage of stages) {
        const result = deriveCommercialTasks(stage);
        const activeTasks = result.tasks.filter(
          (t) => t.status !== 'completed' && t.status !== 'cancelled'
        );
        expect(activeTasks.length).toBeGreaterThan(0);
        expect(result.primaryTask).not.toBeNull();
      }
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 11 — Determinism and Non-mutation
   ══════════════════════════════════════════════════════════════════════════ */

describe('Determinism', () => {
  it('produces identical output on repeated calls', () => {
    const input = makeInput({
      participants: [makeNewParticipant()],
    });
    const r1 = deriveCommercialTasks(input);
    const r2 = deriveCommercialTasks(input);

    expect(r1.tasks.map((t) => t.id)).toEqual(r2.tasks.map((t) => t.id));
    expect(r1.criticalCount).toBe(r2.criticalCount);
    expect(r1.overdueCount).toBe(r2.overdueCount);
  });

  it('does not mutate the input', () => {
    const input = makeInput({
      participants: [makeNewParticipant()],
    });
    const originalStatus = input.participants[0].funding.status;
    deriveCommercialTasks(input);
    expect(input.participants[0].funding.status).toBe(originalStatus);
  });

  it('different participant states produce different task types', () => {
    const earlyStage = deriveCommercialTasks(
      makeInput({ participants: [makeNewParticipant()] })
    );
    const lateStage = deriveCommercialTasks(
      makeInput({ participants: [makeCompleteParticipant()] })
    );
    const earlyTypes = earlyStage.tasks.map((t) => t.taskType).sort();
    const lateTypes = lateStage.tasks.map((t) => t.taskType).sort();
    expect(earlyTypes).not.toEqual(lateTypes);
  });
});
