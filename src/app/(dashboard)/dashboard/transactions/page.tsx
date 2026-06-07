export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import { redirect } from 'next/navigation';
import { TransactionsTable } from '@/components/dashboard/transactions-table';
import { PaymentLinksTransactionsEmpty } from '@/components/payment-links/payment-links-empty-guidance';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';

export default async function TransactionsPage() {
  // Get current user's organization with proper data isolation
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  const org = await getUserOrganization();

  if (!org) {
    redirect('/onboarding');
  }

  // Fetch all payment events for this organization (include FX snapshots for fiat equivalent)
  const allEvents = await prisma.payment_events.findMany({
    where: {
      payment_links: {
        organization_id: org.id,
      },
      event_type: 'PAYMENT_CONFIRMED', // Only show confirmed payments
    },
    include: {
      payment_links: {
        select: {
          id: true,
          short_code: true,
          description: true,
          invoice_reference: true,
          amount: true,
          currency: true,
          fx_snapshots: {
            where: { snapshot_type: 'SETTLEMENT' },
            orderBy: { captured_at: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  // Filter by payment method
  const stripeEvents = allEvents.filter(e => e.payment_method === 'STRIPE');
  const hederaEvents = allEvents.filter(e => e.payment_method === 'HEDERA');
  const showPropagationTraceHints = isBetaAdminEmail(user.email);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Funding activity</h1>
        <p className="text-muted-foreground">
          View funding events across Stripe, Wise, and Hedera that support agreement obligations.
        </p>
        {showPropagationTraceHints && (
          <p className="text-xs text-muted-foreground mt-2 max-w-3xl">
            Commission trace (beta admin): use the Stripe Payment Intent in the Transaction ID column, or
            short code, with{' '}
            <code className="text-[11px] bg-muted px-1 rounded">
              GET /api/admin/commission-propagation-trace?stripePaymentIntentId=pi_…
            </code>
            . Enable live settlement logs with{' '}
            <code className="text-[11px] bg-muted px-1 rounded">COMMISSION_PROPAGATION_TRACE=true</code> on
            Render.
          </p>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({allEvents.length})</TabsTrigger>
          <TabsTrigger value="stripe">Stripe ({stripeEvents.length})</TabsTrigger>
          <TabsTrigger value="hedera">Hedera ({hederaEvents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All funding activity</CardTitle>
              <CardDescription>
                Complete funding history across Stripe, Wise, and Hedera.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allEvents.length > 0 ? (
                <TransactionsTable events={allEvents} showPropagationTraceHints={showPropagationTraceHints} />
              ) : (
                <PaymentLinksTransactionsEmpty />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stripe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stripe funding activity</CardTitle>
              <CardDescription>
                Fiat payment transactions via Stripe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stripeEvents.length > 0 ? (
                <TransactionsTable events={stripeEvents} showPropagationTraceHints={showPropagationTraceHints} />
              ) : allEvents.length === 0 ? (
                <PaymentLinksTransactionsEmpty />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  No Stripe funding activity yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hedera" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hedera funding activity</CardTitle>
              <CardDescription>
                Cryptocurrency transactions via Hedera network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hederaEvents.length > 0 ? (
                <TransactionsTable events={hederaEvents} showPropagationTraceHints={showPropagationTraceHints} />
              ) : allEvents.length === 0 ? (
                <PaymentLinksTransactionsEmpty />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  No Hedera funding activity yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
