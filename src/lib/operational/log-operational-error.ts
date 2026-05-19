export type OperationalErrorContext = {
  route?: string;
  component?: string;
  digest?: string;
};

export type OperationalErrorLog = {
  message: string;
  missingSymbol?: string;
  stack?: string;
  route?: string;
  component?: string;
  digest?: string;
  buildVersion?: string;
  timestamp: string;
};

const BUILD_VERSION =
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  'development';

function extractMissingSymbol(message: string): string | undefined {
  const match = message.match(/(\w+) is not defined/);
  return match?.[1];
}

function isUndefinedReferenceError(message: string): boolean {
  return /is not defined/i.test(message) || /can't find variable/i.test(message);
}

export function logOperationalError(error: Error, context: OperationalErrorContext = {}): OperationalErrorLog {
  const payload: OperationalErrorLog = {
    message: error.message,
    missingSymbol: extractMissingSymbol(error.message),
    stack: error.stack,
    route: context.route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
    component: context.component,
    digest: context.digest,
    buildVersion: BUILD_VERSION,
    timestamp: new Date().toISOString(),
  };

  console.error('[Operational UI Error]', payload);
  return payload;
}

export function getOperationalErrorPresentation(error: Error): {
  title: string;
  message: string;
  suggestion?: string;
} {
  if (isUndefinedReferenceError(error.message)) {
    return {
      title: 'An operational UI error occurred',
      message:
        'Part of the settlement interface failed to load correctly. Our team can use the error reference below to diagnose the issue.',
      suggestion: 'Try refreshing the page. If this continues, contact support with the error reference.',
    };
  }

  return {
    title: 'An operational UI error occurred',
    message: 'Something interrupted this operational workflow. Please try again.',
    suggestion: 'If the problem persists, contact support with the error reference.',
  };
}
