'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Copy,
  Check,
  Star,
  Link2,
  HelpCircle,
  Search,
  MoreHorizontal,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { CollectReviewModal } from './collect-review-modal';
import { CreateAdvocateModal } from './create-advocate-modal';
import { CreateReferralLinkModal } from './create-referral-link-modal';
import { ShareLinkModal } from './share-link-modal';
import { AnalyticsDrawer } from './analytics-drawer';
import { EditAdvocateModal } from './edit-advocate-modal';
import { PayoutDestinationCard } from './payout-destination-card';
import { buildShareTemplates } from '@/lib/referrals/share-templates';

const WATCH_VIDEO_URL = process.env.NEXT_PUBLIC_CONSULTANT_VIDEO_URL || '#';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Approval',
  paid: 'Paid',
  reversed: 'Reversed',
};

const STATUS_TOOLTIPS: Record<string, string> = {
  pending: 'Conversion recorded; payout processing',
  paid: 'Payment sent',
  reversed: 'Entry was reversed',
};

interface AdvocateWithMetrics {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  custom_commission_percent: number;
  status: string;
  clicks: number;
  conversions: number;
  totalEarnings: number;
  lastActivity: string | null;
}

interface EarningsRow {
  id: string;
  source_ref: string;
  gross_amount: number | null;
  earnings_amount: number;
  currency: string;
  status: string;
  created_at: string;
  sourceType: 'advocate' | 'direct';
}

interface ConsultantDashboardProps {
  participant: {
    id: string;
    program_id: string;
    role: string;
    name: string;
    referral_code: string;
  };
  program: {
    id: string;
    slug: string;
    name: string;
  };
  isConsultant: boolean;
  dashboardData: {
    bdPartnerName: string;
    ownerPercent: number;
    advocates: AdvocateWithMetrics[];
    earnings: EarningsRow[];
  };
}

export function ConsultantDashboard({
  participant,
  program,
  isConsultant,
  dashboardData,
}: ConsultantDashboardProps) {
  const [collectReviewOpen, setCollectReviewOpen] = useState(false);
  const [createAdvocateOpen, setCreateAdvocateOpen] = useState(false);
  const [shareModal, setShareModal] = useState<{
    link: string;
    templates: { subject: string; emailBody: string; whatsapp: string; sms: string };
  } | null>(null);
  const [analyticsDrawer, setAnalyticsDrawer] = useState<{
    advocateId: string;
    advocateName: string;
    clicks: number;
    conversions: number;
  } | null>(null);
  const [editAdvocate, setEditAdvocate] = useState<AdvocateWithMetrics | null>(null);
  const [createCommissionLinkOpen, setCreateCommissionLinkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'lastActivity' | 'referrals' | 'earnings'>('lastActivity');
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { organizationId } = useOrganization();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const consultantLink = `${baseUrl}/r/${participant.referral_code}`;

  const { bdPartnerName, ownerPercent, advocates, earnings } = dashboardData;

  const isEmpty = isConsultant && advocates.length === 0 && earnings.length === 0;

  const filteredAdvocates = useMemo(() => {
    let list = [...advocates];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(s) ||
          a.email.toLowerCase().includes(s) ||
          a.referral_code.toLowerCase().includes(s)
      );
    }
    if (sort === 'lastActivity') {
      list.sort((a, b) => {
        const da = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const db = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return db - da;
      });
    } else if (sort === 'referrals') {
      list.sort((a, b) => b.conversions - a.conversions);
    } else {
      list.sort((a, b) => b.totalEarnings - a.totalEarnings);
    }
    return list;
  }, [advocates, search, sort]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const openShareForAdvocate = (adv: AdvocateWithMetrics) => {
    const link = `${baseUrl}/r/${adv.referral_code}`;
    const templates = buildShareTemplates(link, 'advocate', {
      clientName: adv.name,
      serviceLabel: 'my services',
    });
    setShareModal({ link, templates });
  };

  const resendLink = (adv: AdvocateWithMetrics) => openShareForAdvocate(adv);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : 'Never';

  const isStale = (d: string | null) => {
    if (!d) return true;
    const days = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
    return days > 14;
  };

  const estPayoutDate = (createdAt: string) => {
    const d = new Date(createdAt);
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString();
  };

  const handleRefresh = () => router.refresh();

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Consultant Dashboard</h1>
          <p className="text-muted-foreground">
            Share your link, collect reviews, and create client advocate links
          </p>
        </div>

        {isEmpty && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Here&apos;s how it works</CardTitle>
              <CardDescription>
                1. Share your link · 2. Collect reviews · 3. Create a client referral link (they earn a commission)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={() => setCollectReviewOpen(true)}>
                <Star className="h-4 w-4 mr-2" />
                Start by collecting a review
              </Button>
              <Button variant="outline" onClick={() => setCreateAdvocateOpen(true)}>
                <Link2 className="h-4 w-4 mr-2" />
                Create first referral link
              </Button>
              {WATCH_VIDEO_URL !== '#' && (
                <Button variant="ghost" asChild>
                  <a href={WATCH_VIDEO_URL} target="_blank" rel="noopener noreferrer">
                    Watch 2-min video
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Your referral link</CardTitle>
                <CardDescription>
                  Share this link to promote the program. Conversions attributed to you.
                </CardDescription>
              </div>
              {ownerPercent > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                      <HelpCircle className="h-4 w-4" />
                      BD Partner Commission: {ownerPercent}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    This goes to {bdPartnerName} who provided the tools and training for this referral system.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex gap-2 items-center">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded truncate">
              {consultantLink}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(consultantLink)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardContent>
        </Card>

        {isConsultant && organizationId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Payment Link (Commission)</CardTitle>
                <CardDescription>
                  Generate a &quot;Pay Now&quot; link. Customers pay via Stripe; your commission and BD partner share are posted automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setCreateCommissionLinkOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Create Commission Link
                </Button>
              </CardContent>
            </Card>
            <PayoutDestinationCard />
          </>
        )}

        {isConsultant && organizationId && (
          <Card>
            <CardHeader>
              <CardTitle>Payout destination</CardTitle>
              <CardDescription>
                Set your default payout method (PayPal, Wise, etc.) so you can receive commission payouts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/dashboard/partners/payout-methods">
                  <Wallet className="h-4 w-4 mr-2" />
                  Manage payout methods
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isConsultant && (
          <Card>
            <CardHeader>
              <CardTitle>After each session</CardTitle>
              <CardDescription>
                Collect a review and optionally create a referral link for that client.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={() => setCollectReviewOpen(true)}>
                <Star className="h-4 w-4 mr-2" />
                + Collect Review
              </Button>
              <Button variant="outline" onClick={() => setCreateAdvocateOpen(true)}>
                <Link2 className="h-4 w-4 mr-2" />
                + Create Referral Link for Client
              </Button>
            </CardContent>
          </Card>
        )}

        <CollectReviewModal
          open={collectReviewOpen}
          onOpenChange={setCollectReviewOpen}
          programSlug={program.slug}
          onSuccess={handleRefresh}
        />
        {organizationId && (
          <CreateReferralLinkModal
            open={createCommissionLinkOpen}
            onOpenChange={setCreateCommissionLinkOpen}
            organizationId={organizationId}
            userType="CONSULTANT"
            defaultConsultantPct={10}
            defaultBdPartnerPct={ownerPercent || 5}
            onSuccess={handleRefresh}
          />
        )}
        <CreateAdvocateModal
          open={createAdvocateOpen}
          onOpenChange={setCreateAdvocateOpen}
          programSlug={program.slug}
          ownerPercent={ownerPercent}
          onSuccess={handleRefresh}
        />

        {isConsultant && advocates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Client Advocates</CardTitle>
              <CardDescription>
                People you&apos;ve created referral links for
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or code"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastActivity">Last activity</SelectItem>
                    <SelectItem value="referrals">Most referrals</SelectItem>
                    <SelectItem value="earnings">Highest earnings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead>Total Earnings</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdvocates.map((adv) => (
                      <TableRow key={adv.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{adv.name}</div>
                            <div className="text-xs text-muted-foreground">{adv.referral_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{adv.custom_commission_percent}%</TableCell>
                        <TableCell>{adv.conversions}</TableCell>
                        <TableCell>${adv.totalEarnings.toFixed(2)}</TableCell>
                        <TableCell>
                          {adv.clicks > 0 && adv.conversions === 0 ? (
                            <div>
                              <div className="text-destructive/80 text-sm">
                                {adv.clicks} clicks, 0 bookings yet
                              </div>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() =>
                                  setAnalyticsDrawer({
                                    advocateId: adv.id,
                                    advocateName: adv.name,
                                    clicks: adv.clicks,
                                    conversions: adv.conversions,
                                  })
                                }
                              >
                                View analytics
                              </Button>
                            </div>
                          ) : (
                            formatDate(adv.lastActivity)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(`${baseUrl}/r/${adv.referral_code}`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openShareForAdvocate(adv)}>
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditAdvocate(adv)}>
                                  Edit %
                                </DropdownMenuItem>
                                {isStale(adv.lastActivity) && (
                                  <DropdownMenuItem onClick={() => resendLink(adv)}>
                                    Resend link
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {isConsultant && earnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Earnings</CardTitle>
              <CardDescription>
                Your referral payouts from partner ledger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gross</TableHead>
                      <TableHead>Your earnings</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Est. payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.gross_amount != null ? `$${e.gross_amount.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell>
                          {e.currency} ${e.earnings_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {e.sourceType === 'advocate' ? 'Advocate' : 'Direct'}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {STATUS_LABELS[e.status] || e.status}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {STATUS_TOOLTIPS[e.status] || e.status}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {e.status === 'paid' ? '—' : estPayoutDate(e.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {shareModal && (
          <ShareLinkModal
            open={!!shareModal}
            onOpenChange={(o) => !o && setShareModal(null)}
            link={shareModal.link}
            templates={shareModal.templates}
            title="Share advocate link"
            description="Send this link to your client."
          />
        )}

        {editAdvocate && (
          <EditAdvocateModal
            open={!!editAdvocate}
            onOpenChange={(o) => !o && setEditAdvocate(null)}
            advocate={editAdvocate}
            ownerPercent={ownerPercent}
            onSuccess={handleRefresh}
          />
        )}

        {analyticsDrawer && (
          <AnalyticsDrawer
            open={!!analyticsDrawer}
            onOpenChange={(o) => !o && setAnalyticsDrawer(null)}
            advocateId={analyticsDrawer.advocateId}
            advocateName={analyticsDrawer.advocateName}
            clicks={analyticsDrawer.clicks}
            conversions={analyticsDrawer.conversions}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
