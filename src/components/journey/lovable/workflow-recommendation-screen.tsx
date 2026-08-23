'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy prescribed-workflow screen — new-user path goes Context → Create workspace. */
export function WorkflowRecommendationScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/journey/provisioning');
  }, [router]);

  return null;
}
