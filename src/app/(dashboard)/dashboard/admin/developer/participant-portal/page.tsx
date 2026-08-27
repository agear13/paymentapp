import { notFound } from 'next/navigation';
import { isParticipantTestContextEnabled } from '@/lib/participant-portal/participant-test-context';
import { ParticipantPortalTestClient } from '@/components/dev/participant-portal-test-client';

export default function ParticipantPortalTestPage() {
  if (!isParticipantTestContextEnabled()) {
    notFound();
  }
  return <ParticipantPortalTestClient />;
}
