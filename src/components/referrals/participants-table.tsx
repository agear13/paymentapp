'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  email: string | null;
  role: string;
  referral_code: string;
  status: string;
  created_at: string;
  referral_programs: { name: string };
}

export function ParticipantsTable({ participants }: { participants: Participant[] }) {
  const copyReferralLink = (code: string) => {
    const url = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(url);
    alert('Referral link copied to clipboard!');
  };

  const openReferralPage = (code: string) => {
    window.open(`${window.location.origin}/r/${code}`, '_blank');
  };

  const getRoleBadge = (role: string) => {
    return role === 'CONSULTANT' ? (
      <Badge>Consultant</Badge>
    ) : (
      <Badge variant="secondary">Client Advocate</Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge variant="default">Active</Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Program</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Referral Code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-gray-500">
              No participants found
            </TableCell>
          </TableRow>
        )}
        {participants.map((participant) => (
          <TableRow key={participant.id}>
            <TableCell className="font-medium">{participant.name}</TableCell>
            <TableCell>{participant.email || '—'}</TableCell>
            <TableCell>{participant.referral_programs.name}</TableCell>
            <TableCell>{getRoleBadge(participant.role)}</TableCell>
            <TableCell>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                {participant.referral_code}
              </code>
            </TableCell>
            <TableCell>{getStatusBadge(participant.status)}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyReferralLink(participant.referral_code)}
                  title="Copy referral link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReferralPage(participant.referral_code)}
                  title="Open referral page"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
