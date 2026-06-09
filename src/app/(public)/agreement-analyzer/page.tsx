import { AgreementAnalyzerLandingPage } from '@/components/agreement-analyzer/agreement-analyzer-landing-page';

export const metadata = {
  title: 'Free AI Agreement Analyzer | Provvypay',
  description:
    'Upload agreements and receive an AI-generated obligation report identifying payment obligations, revenue splits, settlement risks and missing clauses.',
};

export default function AgreementAnalyzerPage() {
  return <AgreementAnalyzerLandingPage />;
}
