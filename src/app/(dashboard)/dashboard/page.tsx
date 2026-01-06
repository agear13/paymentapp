import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';

async function getDashboardStats(organizationId: string) {
  try {
    // Get total revenue from paid payment links
    const paidLinks = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
        status: 'PAID',
      },
      select: {
        amount: true,
        currency: true,
      },
    });

    // Calculate total revenue (simplified - just sum amounts)
    const totalRevenue = paidLinks.reduce((sum, link) => {
      return sum + Number(link.amount);
    }, 0);

    // Get active links count (OPEN status)
    const activeLinksCount = await prisma.payment_links.count({
      where: {
        organization_id: organizationId,
        status: 'OPEN',
      },
    });

    // Get completed payments count this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const completedPaymentsCount = await prisma.payment_links.count({
      where: {
        organization_id: organizationId,
        status: 'PAID',
        updated_at: {
          gte: startOfMonth,
        },
      },
    });

    // Calculate success rate (PAID / (PAID + EXPIRED + CANCELLED))
    const totalCompletedCount = await prisma.payment_links.count({
      where: {
        organization_id: organizationId,
        status: {
          in: ['PAID', 'EXPIRED', 'CANCELLED'],
        },
      },
    });

    const paidCount = await prisma.payment_links.count({
      where: {
        organization_id: organizationId,
        status: 'PAID',
      },
    });

    const successRate = totalCompletedCount > 0 
      ? Math.round((paidCount / totalCompletedCount) * 100) 
      : 0;

    // Get recent activity
    const recentLinks = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
      },
      select: {
        id: true,
        short_code: true,
        status: true,
        amount: true,
        currency: true,
        description: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 5,
    });

    return {
      totalRevenue,
      activeLinksCount,
      completedPaymentsCount,
      successRate,
      recentLinks,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return default values if query fails
    return {
      totalRevenue: 0,
      activeLinksCount: 0,
      completedPaymentsCount: 0,
      successRate: 0,
      recentLinks: [],
    };
  }
}

export default async function DashboardPage() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      redirect('/auth/login');
    }

    const organization = await getUserOrganization();
    
    if (!organization) {
      redirect('/onboarding');
    }

    const stats = await getDashboardStats(organization.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your payment activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">All time payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLinksCount}</div>
            <p className="text-xs text-muted-foreground">Payment links</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedPaymentsCount}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">Of initiated payments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent payment link activity</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentLinks.length > 0 ? (
              <div className="space-y-3">
                {stats.recentLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{link.description || link.short_code}</p>
                      <p className="text-sm text-muted-foreground">
                        {link.short_code} • {link.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${Number(link.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{link.currency}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/payment-links?action=create">
              <div className="rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors flex items-center justify-between">
                <div>
                  <div className="font-medium">Create Payment Link</div>
                  <div className="text-sm text-muted-foreground">Generate a new payment link</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/dashboard/transactions">
              <div className="rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors flex items-center justify-between">
                <div>
                  <div className="font-medium">View Transactions</div>
                  <div className="text-sm text-muted-foreground">Review recent transactions</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/dashboard/settings/merchant">
              <div className="rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors flex items-center justify-between">
                <div>
                  <div className="font-medium">Configure Settings</div>
                  <div className="text-sm text-muted-foreground">Update merchant settings</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
  } catch (error) {
    console.error('Dashboard page error:', error);
    
    // Return a minimal error page
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your payment activity.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$0.00</div>
              <p className="text-xs text-muted-foreground">All time payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Payment links</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">Of initiated payments</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              There was an error loading your dashboard data. Please try refreshing the page or contact support if the issue persists.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Check the browser console for more details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
