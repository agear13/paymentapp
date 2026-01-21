'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Shield } from 'lucide-react';
import { mockAllocationRules } from '@/lib/data/mock-partners';

export default function PartnerRulesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Allocation Rules</h1>
        <p className="text-muted-foreground">
          Automated rules that determine how earnings are allocated from incoming payments
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Rules are applied automatically when payments are processed. Higher priority rules
          are evaluated first. Rules define how earnings are allocated automatically from incoming payments.
        </AlertDescription>
      </Alert>

      {/* Rules Overview Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockAllocationRules.length}</div>
            <p className="text-xs text-muted-foreground">Currently in effect</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Standard Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15%</div>
            <p className="text-xs text-muted-foreground">Base revenue share</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonus Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20%</div>
            <p className="text-xs text-muted-foreground">New merchant boost</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Share Rules</CardTitle>
          <CardDescription>
            Allocation rules applied to your partner account (read-only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Scope</TableHead>
                <TableHead>Allocation Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead>Effective Period</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAllocationRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.scope}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rule.allocationType === 'Percentage'
                          ? 'default'
                          : rule.allocationType === 'Tiered'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {rule.allocationType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{rule.value}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{rule.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>
                        {new Date(rule.effectiveFrom).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      {rule.effectiveTo && (
                        <p className="text-muted-foreground">
                          to{' '}
                          {new Date(rule.effectiveTo).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                      {!rule.effectiveTo && (
                        <p className="text-muted-foreground">Ongoing</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground">{rule.description}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Additional Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Rules Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              1
            </div>
            <div>
              <p className="text-sm font-medium">Automatic Application</p>
              <p className="text-sm text-muted-foreground">
                Rules are evaluated and applied automatically when a merchant processes a payment
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              2
            </div>
            <div>
              <p className="text-sm font-medium">Priority-Based</p>
              <p className="text-sm text-muted-foreground">
                Higher priority rules are checked first. The first matching rule determines allocation
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              3
            </div>
            <div>
              <p className="text-sm font-medium">Real-Time Allocation</p>
              <p className="text-sm text-muted-foreground">
                Your earnings are calculated and recorded in the ledger immediately upon payment
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              4
            </div>
            <div>
              <p className="text-sm font-medium">Transparent Tracking</p>
              <p className="text-sm text-muted-foreground">
                Every allocation is tracked in your ledger with full details of the applied rule
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

