export const dynamic = 'force-dynamic';
export const revalidate = 0;


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
        <p className="text-muted-foreground">
          View your double-entry bookkeeping ledger and account balances.
        </p>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
              <CardDescription>
                Your organization's chart of accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No accounts configured yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ledger Entries</CardTitle>
              <CardDescription>
                All ledger entries for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No ledger entries yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
              <CardDescription>
                Your organization's financial position.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No balance data available yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}













