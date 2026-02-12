import { redirect } from 'next/navigation';
import { getAuthedParticipantForProgram } from '@/lib/referrals/participant-auth';
import { getConsultantDashboardData } from '@/lib/referrals/consultant-data';
import { ConsultantDashboard } from '@/components/referrals/consultant-dashboard';

export default async function ConsultantPage() {
  const authed = await getAuthedParticipantForProgram('consultant-referral');

  if (!authed) {
    redirect('/dashboard/programs/overview?bind=1');
  }

  const { participant, program } = authed;

  if (participant.role !== 'CONSULTANT' && participant.role !== 'BD_PARTNER') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Consultant Dashboard</h1>
        <p className="text-muted-foreground">
          This page is for consultants and BD partners. Your role ({participant.role}) does not have access to create advocate links.
        </p>
      </div>
    );
  }

  const dashboardData =
    participant.role === 'CONSULTANT'
      ? await getConsultantDashboardData(participant.id, program.id)
      : { bdPartnerName: '', ownerPercent: 0, advocates: [], earnings: [] };

  return (
    <ConsultantDashboard
      participant={participant}
      program={program}
      isConsultant={participant.role === 'CONSULTANT'}
      dashboardData={dashboardData}
    />
  );
}
