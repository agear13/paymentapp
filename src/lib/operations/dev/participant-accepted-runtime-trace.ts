const TRACE_PREFIX = '[participant-accepted-runtime-trace]';

type ApprovalTraceFields = {
  id?: unknown;
  approvalStatus?: unknown;
  approval_status?: unknown;
  agreementLifecycle?: unknown;
  participantLifecycle?: unknown;
  approvedAt?: unknown;
  approved_at?: unknown;
  inviteStatus?: unknown;
};

type TraceState = {
  stopped: boolean;
  seen: Map<string, { fields: ApprovalTraceFields; object: unknown }>;
};

const globalTrace = globalThis as typeof globalThis & {
  __participantAcceptedRuntimeTrace?: TraceState;
};

function state(): TraceState {
  if (!globalTrace.__participantAcceptedRuntimeTrace) {
    globalTrace.__participantAcceptedRuntimeTrace = {
      stopped: false,
      seen: new Map(),
    };
  }
  return globalTrace.__participantAcceptedRuntimeTrace;
}

export function approvalTraceFields(value: unknown): ApprovalTraceFields | null {
  const p = value as Record<string, unknown> | null | undefined;
  if (!p || typeof p !== 'object') return null;
  return {
    id: p.id,
    approvalStatus: p.approvalStatus,
    approval_status: p.approval_status,
    agreementLifecycle: p.agreementLifecycle,
    participantLifecycle: p.participantLifecycle,
    approvedAt: p.approvedAt,
    approved_at: p.approved_at,
    inviteStatus: p.inviteStatus,
  };
}

function isApprovedField(field: keyof ApprovalTraceFields, value: unknown): boolean {
  if (field === 'approvalStatus' || field === 'approval_status') return value === 'Approved';
  if (field === 'agreementLifecycle') return value === 'APPROVED';
  if (field === 'participantLifecycle') {
    return value === 'APPROVED' || value === 'PAYOUT_READY' || value === 'ACTIVE';
  }
  if (field === 'approvedAt' || field === 'approved_at') return Boolean(value);
  return false;
}

function approvedFields(fields: ApprovalTraceFields): Array<keyof ApprovalTraceFields> {
  return (Object.keys(fields) as Array<keyof ApprovalTraceFields>).filter((field) =>
    isApprovedField(field, fields[field])
  );
}

function firstExternalStackLine(stack: string): string {
  return (
    stack
      .split('\n')
      .map((line) => line.trim())
      .find(
        (line) =>
          line.includes('/src/') &&
          !line.includes('participant-accepted-runtime-trace')
      ) ?? stack.split('\n')[1]?.trim() ?? 'unknown'
  );
}

export function traceRuntime(label: string, payload: unknown) {
  const current = state();
  if (current.stopped) return;
  console.info(`${TRACE_PREFIX} ${label}`, JSON.stringify(payload, null, 2));
}

export function watchParticipantAcceptedTransition(functionName: string, participant: unknown) {
  const current = state();
  if (current.stopped) return;

  const fields = approvalTraceFields(participant);
  const id = fields?.id;
  if (!fields || typeof id !== 'string' || !id) return;

  const previous = current.seen.get(id);
  const nextApprovedFields = approvedFields(fields);
  const previousApprovedFields = previous ? approvedFields(previous.fields) : [];

  if (previous && previousApprovedFields.length === 0 && nextApprovedFields.length > 0) {
    const stack = new Error().stack ?? '';
    current.stopped = true;
    console.info(
      `${TRACE_PREFIX} FIRST INCORRECT TRANSITION DETECTED`,
      JSON.stringify(
        {
          previousObject: previous.object,
          newObject: participant,
          changedApprovalFields: nextApprovedFields,
          functionName,
          fileAndLine: firstExternalStackLine(stack),
          callStack: stack,
        },
        null,
        2
      )
    );
    return;
  }

  current.seen.set(id, {
    fields,
    object: participant,
  });
}
