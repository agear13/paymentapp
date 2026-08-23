'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy analysis theater — new-user path goes Context → Create workspace. */
export function AssessmentAnalysisScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/journey/provisioning');
  }, [router]);

  return null;
}
