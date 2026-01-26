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

    // Calculate success rate (PAID / (PAID + EXPIRED + CANCELED + OPEN))
    const totalCompletedCount = await prisma.payment_links.count({
      where: {
        organization_id: organizationId,
        status: {
          in: ['OPEN', 'PAID', 'EXPIRED', 'CANCELED'],
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
    <div className="space-y-8">
      {/* Header with primary CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your payment activity.
          </p>
        </div>
        <Link href="/dashboard/payment-links?action=create">
          <div className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-6 py-3 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Invoice
          </div>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Revenue</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Links</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeLinksCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Open payment links</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">This Month</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completedPaymentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Success Rate</CardTitle>
            <div className="p-2 bg-amber-50 rounded-lg">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Of all payment attempts</p>
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
              <div className="flex flex-col h-[200px] items-center justify-center text-center">
                <div className="mb-4 p-3 bg-gray-50 rounded-full">
                  <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No recent activity</p>
                <p className="text-xs text-muted-foreground mb-4">Create your first invoice to get started</p>
                <Link href="/dashboard/payment-links?action=create">
                  <span className="text-sm text-primary hover:text-[rgb(61,92,224)] font-medium">
                    Create Invoice →
                  </span>
                </Link>
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
            <Link href="/dashboard/partners/onboarding?source=merchant">
              <div className="rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors flex items-center justify-between border-primary/50 bg-primary/5">
                <div>
                  <div className="font-medium">Earn by referring businesses</div>
                  <div className="text-sm text-muted-foreground">Share your link, earnings accrue automatically, payouts run on schedule.</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Last updated indicator (trust cue) */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Last updated: {new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
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
