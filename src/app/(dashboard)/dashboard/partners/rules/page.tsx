'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info, Shield, Plus, Link2 } from 'lucide-react';
import { mockAllocationRules } from '@/lib/data/mock-partners';

type RuleType = 'Percentage' | 'Fixed Amount' | 'Tiered';

interface SavedRule {
  id: string;
  name: string;
  ruleType: RuleType;
  value: string;
  priority: number;
  assignedToLink?: string;
}

export default function PartnerRulesPage() {
  const [savedRules, setSavedRules] = React.useState<SavedRule[]>([]);
  const [createName, setCreateName] = React.useState('');
  const [createType, setCreateType] = React.useState<RuleType>('Percentage');
  const [createValue, setCreateValue] = React.useState('');
  const [createPriority, setCreatePriority] = React.useState('1');
  const [assignRuleId, setAssignRuleId] = React.useState<string | null>(null);
  const [assignLinkCode, setAssignLinkCode] = React.useState('');

  const handleCreateRule = () => {
    if (!createName.trim() || !createValue.trim()) return;
    const id = `custom-${Date.now()}`;
    setSavedRules((prev) => [
      ...prev,
      {
        id,
        name: createName.trim(),
        ruleType: createType,
        value: createValue.trim(),
        priority: parseInt(createPriority, 10) || 1,
      },
    ]);
    setCreateName('');
    setCreateValue('');
    setCreatePriority('1');
  };

  const handleAssignToLink = (ruleId: string) => {
    if (!assignLinkCode.trim()) return;
    setSavedRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, assignedToLink: assignLinkCode.trim() } : r))
    );
    setAssignRuleId(null);
    setAssignLinkCode('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Programmable revenue share rules</h1>
        <p className="text-muted-foreground">
          Define how earnings are split and when they execute. Unique links can be generated that execute these rules for the assigned partner.
        </p>
        <p className="text-xs text-muted-foreground mt-2 rounded-md bg-muted/60 p-2 max-w-xl">
          Provvypay is non-custodial; the ledger is the real-time source of truth. On clawback or refund we alert you to correct balances; if a partner does not return their portion we can freeze the partner account and apply other controls.
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Rules execute on payment. Create rules, assign them to a link, and give that link to a partner—when customers pay via the link, these rules run automatically.
        </AlertDescription>
      </Alert>

      {/* Create rule (demo) */}
      <Card>
        <CardHeader>
          <CardTitle>Create rule</CardTitle>
          <CardDescription>
            Add a new rule (demo: saved in browser). Assign rules to links so that link executes them for the assigned partner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <Label>Name</Label>
              <Input
                placeholder="e.g. Standard share"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={createType} onValueChange={(v: RuleType) => setCreateType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Percentage">Percentage</SelectItem>
                  <SelectItem value="Fixed Amount">Fixed Amount</SelectItem>
                  <SelectItem value="Tiered">Tiered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                placeholder="e.g. 15% or 50"
                value={createValue}
                onChange={(e) => setCreateValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                min={1}
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleCreateRule} disabled={!createName.trim() || !createValue.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Save rule
          </Button>
        </CardContent>
      </Card>

      {/* Saved rules & assign to link */}
      {savedRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved rules (assign to link)</CardTitle>
            <CardDescription>
              Links execute the rules assigned to them. Generate a unique link and assign one or more rules so that when the partner shares the link, payments run these rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned to link</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><Badge variant="outline">{r.ruleType}</Badge></TableCell>
                    <TableCell>{r.value}</TableCell>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell>
                      {r.assignedToLink ? (
                        <span className="font-mono text-sm flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {r.assignedToLink} (link executes this rule)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignRuleId === r.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            placeholder="Link code"
                            value={assignLinkCode}
                            onChange={(e) => setAssignLinkCode(e.target.value)}
                            className="h-8 w-24"
                          />
                          <Button size="sm" onClick={() => handleAssignToLink(r.id)}>Assign</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAssignRuleId(null); setAssignLinkCode(''); }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setAssignRuleId(r.id)}>
                          Assign to link
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

