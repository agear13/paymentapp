import { BUILD_ID } from '@/generated/build-info';

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

const BUILD_VERSION = BUILD_ID;

function extractMissingSymbol(message: string): string | undefined {
  const match = message.match(/(\w+) is not defined/);
  return match?.[1];
}

function isOperationalUiError(message: string): boolean {
  return (
    /is not defined/i.test(message) ||
    /can't find variable/i.test(message) ||
    /loading chunk/i.test(message) ||
    /chunkloaderror/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message)
  );
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
  if (isOperationalUiError(error.message)) {
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
