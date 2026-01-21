'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users, TrendingUp, DollarSign, Target, Plus } from 'lucide-react';
import {
  mockProgramMetrics,
  mockAllPartners,
} from '@/lib/data/mock-partners';

export default function ProgramsOverviewPage() {
  const { totalPartners, activePartners, totalRevenue, totalAllocated, avgRevenuePerPartner } = mockProgramMetrics;

  // Chart data - partners by role
  const roleData = [
    {
      role: 'Partner',
      count: mockAllPartners.filter(p => p.role === 'Partner').length,
      earnings: mockAllPartners.filter(p => p.role === 'Partner').reduce((sum, p) => sum + p.totalEarnings, 0),
    },
    {
      role: 'Affiliate',
      count: mockAllPartners.filter(p => p.role === 'Affiliate').length,
      earnings: mockAllPartners.filter(p => p.role === 'Affiliate').reduce((sum, p) => sum + p.totalEarnings, 0),
    },
    {
      role: 'Contributor',
      count: mockAllPartners.filter(p => p.role === 'Contributor').length,
      earnings: mockAllPartners.filter(p => p.role === 'Contributor').reduce((sum, p) => sum + p.totalEarnings, 0),
    },
  ];

  const chartConfig = {
    earnings: {
      label: 'Total Earnings',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Program Overview</h1>
          <p className="text-muted-foreground">
            Manage your revenue share program and partner network
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invite New Partner
        </Button>
      </div>

      {/* Program Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPartners}</div>
            <p className="text-xs text-muted-foreground">
              {activePartners} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePartners}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((activePartners / totalPartners) * 100)}% active rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevenue / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground">Attributed revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalAllocated / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground">To all partners</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Per Partner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(avgRevenuePerPartner / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground">Revenue per partner</p>
          </CardContent>
        </Card>
      </div>

      {/* Partners by Role Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Partners by Role</CardTitle>
          <CardDescription>Distribution of partners and their total earnings</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={roleData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="role" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* All Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Partner Network</CardTitle>
          <CardDescription>
            All partners contributing to your revenue share program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead className="text-right">Total Earnings</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-center">Share Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAllPartners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{partner.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{partner.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        partner.status === 'Active'
                          ? 'success'
                          : partner.status === 'Pending'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {partner.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(partner.joinedDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${partner.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    ${partner.pendingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {partner.revenueShareRate}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Program Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Revenue Share Programs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Revenue share programs enable partners to earn a percentage of revenue from merchants
            and transactions they refer or contribute to. This creates aligned incentives and
            sustainable growth for your payment platform.
          </p>

          <div className="grid gap-3 pt-3">
            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Automated Allocation</p>
                <p className="text-sm text-muted-foreground">
                  Earnings are calculated and allocated automatically when payments are processed
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Transparent Tracking</p>
                <p className="text-sm text-muted-foreground">
                  Partners have full visibility into their attributed merchants and earnings
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Flexible Payouts</p>
                <p className="text-sm text-muted-foreground">
                  Multiple payout methods and schedules to suit different partner preferences
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

