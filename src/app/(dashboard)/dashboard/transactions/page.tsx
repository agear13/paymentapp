export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import { redirect } from 'next/navigation';
import { TransactionsTable } from '@/components/dashboard/transactions-table';

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

  // Fetch all payment events for this organization
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          View all payment transactions across Stripe and Hedera.
        </p>
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
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>
                Complete transaction history across all payment methods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allEvents.length > 0 ? (
                <TransactionsTable events={allEvents} />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  No transactions yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stripe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Transactions</CardTitle>
              <CardDescription>
                Fiat payment transactions via Stripe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stripeEvents.length > 0 ? (
                <TransactionsTable events={stripeEvents} />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  No Stripe transactions yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hedera" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hedera Transactions</CardTitle>
              <CardDescription>
                Cryptocurrency transactions via Hedera network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hederaEvents.length > 0 ? (
                <TransactionsTable events={hederaEvents} />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  No Hedera transactions yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
