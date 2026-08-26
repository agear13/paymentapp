import { WorkspaceCreateInvoiceScreen } from '@/components/journey/lovable/workspace-create-invoice-screen';

type PageProps = {
  searchParams: Promise<{ origin?: string; sourceParticipantId?: string }>;
};

export default async function WorkspaceCreateInvoicePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <WorkspaceCreateInvoiceScreen
      origin={params.origin}
      sourceParticipantId={params.sourceParticipantId}
    />
  );
}
