'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy connect step — onboarding now uses Connected Systems after workspace provisioning.
 * Redirect anyone landing here to the analysis step.
 */
export function AssessmentConnectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/journey/assessment/analysis');
  }, [router]);

  return null;
}
