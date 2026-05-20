import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function TeamSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team management</h1>
          <p className="text-muted-foreground">
            Manage your team members and their permissions.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Assign finance, operations, or admin access when inviting team members.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            People who have access to this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No team members yet. Invite your first team member to get started. Assign finance,
            operations, or admin access when you send the invite.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}













