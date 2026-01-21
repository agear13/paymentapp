'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import {
  DollarSign,
  Clock,
  TrendingUp,
  Calendar,
  Plus,
  Zap,
  Send,
} from 'lucide-react';
import {
  currentPartnerProfile,
  mockAttributedEntities,
  mockEarningsChartData,
  mockLedgerEntries,
  type AttributedEntity,
  type LedgerEntry,
  type EarningsDataPoint,
} from '@/lib/data/mock-partners';

export default function PartnersDashboardPage() {
  const [profile, setProfile] = useState(currentPartnerProfile);
  const [entities, setEntities] = useState(mockAttributedEntities);
  const [chartData, setChartData] = useState(mockEarningsChartData);
  const [ledger, setLedger] = useState(mockLedgerEntries);
  const [programType, setProgramType] = useState<string>('');

  useEffect(() => {
    // Read program type from localStorage
    const storedProgramType = localStorage.getItem('partnerProgramType');
    if (storedProgramType) {
      setProgramType(storedProgramType);
    }
  }, []);

  // Simulate incoming payment
  const simulatePayment = () => {
    const randomEntity = entities[Math.floor(Math.random() * entities.filter(e => e.status === 'Active').length)];
    const grossAmount = Math.floor(Math.random() * 3000) + 500;
    const earningsAmount = parseFloat((grossAmount * (profile.revenueShareRate / 100)).toFixed(2));

    // Randomly pick a transaction type
    const transactionTypes: Array<'Payment Link' | 'Rewards' | 'Invoice' | 'Other'> = [
      'Payment Link',
      'Rewards',
      'Invoice',
      'Other',
    ];
    const randomTransactionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];

    // Add new ledger entry
    const newEntry: LedgerEntry = {
      id: `ledger-sim-${Date.now()}`,
      partnerId: profile.id,
      date: new Date().toISOString().split('T')[0],
      source: randomEntity.entityName,
      sourceType: randomEntity.entityType,
      transactionType: randomTransactionType,
      grossAmount,
      allocationRate: profile.revenueShareRate,
      earningsAmount,
      status: 'Pending',
    };

    setLedger([newEntry, ...ledger]);

    // Update stats
    setProfile({
      ...profile,
      totalEarnings: profile.totalEarnings + earningsAmount,
      pendingEarnings: profile.pendingEarnings + earningsAmount,
    });

    // Update entity
    const updatedEntities = entities.map(e => {
      if (e.id === randomEntity.id) {
        return {
          ...e,
          grossRevenue: e.grossRevenue + grossAmount,
          earningsAllocated: e.earningsAllocated + earningsAmount,
        };
      }
      return e;
    });
    setEntities(updatedEntities);

    // Update chart (add to today)
    const today = new Date().toISOString().split('T')[0];
    const existingIndex = chartData.findIndex(d => d.date === today);
    if (existingIndex >= 0) {
      const updated = [...chartData];
      updated[existingIndex] = {
        ...updated[existingIndex],
        earnings: updated[existingIndex].earnings + earningsAmount,
        gross: updated[existingIndex].gross + grossAmount,
      };
      setChartData(updated);
    } else {
      setChartData([...chartData, { date: today, earnings: earningsAmount, gross: grossAmount }]);
    }
  };

  // Simulate payout run
  const simulatePayout = () => {
    const pendingAmount = ledger
      .filter(e => e.status === 'Pending')
      .reduce((sum, e) => sum + e.earningsAmount, 0);

    if (pendingAmount === 0) {
      alert('No pending earnings to pay out');
      return;
    }

    // Mark all pending as paid
    const updatedLedger = ledger.map(e => {
      if (e.status === 'Pending') {
        return { ...e, status: 'Paid' as const, payoutId: `payout-sim-${Date.now()}` };
      }
      return e;
    });
    setLedger(updatedLedger);

    // Update stats
    setProfile({
      ...profile,
      pendingEarnings: 0,
      paidOut: profile.paidOut + pendingAmount,
    });
  };

  const chartConfig = {
    earnings: {
      label: 'Earnings',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Partner Dashboard</h1>
            {programType && (
              <Badge variant="outline" className="text-xs">
                {programType}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Track your earnings, attributed merchants, and revenue share allocation
          </p>
        </div>
        <Link href="/dashboard/programs/overview">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Your Own Program
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${profile.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">All time revenue share</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${profile.pendingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting next payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${profile.paidOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Successfully transferred</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(profile.nextPayoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <p className="text-xs text-muted-foreground">Scheduled transfer date</p>
          </CardContent>
        </Card>
      </div>

      {/* Demo Simulation Controls */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Demo Simulation Controls</CardTitle>
          <CardDescription>Test the partner earnings flow with simulated data</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={simulatePayment}>
            <Zap className="h-4 w-4 mr-2" />
            Simulate Incoming Payment
          </Button>
          <Button variant="outline" onClick={simulatePayout}>
            <Send className="h-4 w-4 mr-2" />
            Simulate Payout Run
          </Button>
        </CardContent>
      </Card>

      {/* Earnings Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings Trend (Last 30 Days)</CardTitle>
          <CardDescription>Daily revenue share allocation from attributed merchants</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <AreaChart data={chartData}>
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
                dataKey="earnings"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Attributed Entities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attributed Merchants & Programs</CardTitle>
          <CardDescription>
            Entities attributed to your partner account and their revenue contribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Attribution Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross Revenue</TableHead>
                <TableHead className="text-right">Earnings Allocated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell className="font-medium">{entity.entityName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entity.entityType}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(entity.attributionDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entity.status === 'Active'
                          ? 'success'
                          : entity.status === 'Pending'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {entity.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${entity.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${entity.earningsAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

