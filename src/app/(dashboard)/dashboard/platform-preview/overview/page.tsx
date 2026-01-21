'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import {
  DollarSign,
  Clock,
  TrendingDown,
  Package,
  ShoppingCart,
  AlertTriangle,
  Info,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  overviewMetrics,
  channelBreakdown,
  attentionItems,
  salesChartData,
} from '@/lib/data/mock-platform-preview';

export default function PlatformPreviewOverviewPage() {
  const chartConfig = {
    gross: {
      label: 'Gross Sales',
      color: 'hsl(var(--primary))',
    },
    net: {
      label: 'Net Receipts',
      color: 'hsl(var(--chart-2))',
    },
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  const getAttentionIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAttentionBadge = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Platform Preview: Commerce Intelligence</h1>
            <Badge variant="secondary">Preview</Badge>
          </div>
          <p className="text-muted-foreground">
            A preview of the unified dashboard that connects channels, payments, and inventory. (Coming soon)
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${overviewMetrics.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All Channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Receipts</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${overviewMetrics.netReceipts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">After fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlements</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${overviewMetrics.pendingSettlements.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Paid</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${overviewMetrics.feesPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">POS + Grab + Online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Risk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overviewMetrics.inventoryRiskCount}</div>
            <p className="text-xs text-muted-foreground mt-1">SKUs need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overviewMetrics.openOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all channels</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sales Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales (Gross vs Net) — Last 30 Days</CardTitle>
            <CardDescription>Revenue trends across all channels</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="gross"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Sales by Channel Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Channel</CardTitle>
            <CardDescription>Revenue distribution across channels</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={channelBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ channel, percent }) => `${channel.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="gross"
                >
                  {channelBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-3">
                        <p className="font-semibold">{data.channel}</p>
                        <p className="text-sm">Gross: ${data.gross.toLocaleString()}</p>
                        <p className="text-sm">Net: ${data.net.toLocaleString()}</p>
                        <p className="text-sm">Orders: {data.orderCount}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* What Needs Attention */}
      <Card>
        <CardHeader>
          <CardTitle>What Needs Attention</CardTitle>
          <CardDescription>Issues and alerts across your platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {attentionItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="mt-0.5">{getAttentionIcon(item.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant={getAttentionBadge(item.type) as 'default' | 'secondary' | 'outline' | 'destructive'}>{item.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {item.actionLabel && (
                  <Button variant="ghost" size="sm">
                    {item.actionLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Start with Payment Links (Money In)</CardTitle>
            <CardDescription>
              Accept payments from customers and track revenue in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/payment-links">
              <Button variant="outline" className="w-full">
                View Payment Links
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Partners & Payouts (Money Out)</CardTitle>
            <CardDescription>
              Manage partner revenue share allocations and payout schedules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/partners/dashboard">
              <Button variant="outline" className="w-full">
                View Partners Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

