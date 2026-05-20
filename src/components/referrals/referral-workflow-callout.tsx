import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

const STEPS = [
  'Create your project or program',
  'Invite a participant, they accept',
  'A referral link is created automatically',
  'Participant copies the link or QR and shares it',
  'Customer opens the link, picks a service, and pays',
  'Attribution and commission are recorded on payment',
] as const;

export function ReferralWorkflowCallout({ audience }: { audience: 'operator' | 'participant' }) {
  return (
    <Card className="border-blue-100 bg-blue-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">How referral attribution works</CardTitle>
        <CardDescription>
          {audience === 'operator'
            ? 'This is the operational chain your team and participants should follow.'
            : 'Share your link below. When someone pays through it, you are attributed automatically.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm text-gray-700">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
              {i < STEPS.length - 1 ? (
                <ArrowRight className="hidden sm:inline h-4 w-4 shrink-0 text-blue-300 mt-1 ml-auto" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
