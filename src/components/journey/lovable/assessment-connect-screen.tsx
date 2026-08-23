'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy connect step — new-user path goes Context → Create workspace. */
export function AssessmentConnectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/journey/provisioning');
  }, [router]);

  return null;
}
