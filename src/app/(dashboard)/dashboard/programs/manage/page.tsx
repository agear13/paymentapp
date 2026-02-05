import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, TrendingUp, Star } from 'lucide-react';
import Link from 'next/link';

export default async function ProgramsManagePage() {
  const supabase = await createClient();

  // Fetch programs with aggregated stats
  const { data: programs } = await supabase
    .from('programs')
    .select('*')
    .order('created_at', { ascending: false });

  // For each program, get participant counts
  const programsWithStats = await Promise.all(
    (programs || []).map(async (program) => {
      const { count: participantCount } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('program_id', program.id);

      const { count: conversionCount } = await supabase
        .from('conversions')
        .select('*', { count: 'exact', head: true })
        .eq('program_id', program.id)
        .eq('status', 'approved');

      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('program_id', program.id)
        .eq('status', 'published');

      const avgRating = reviews && reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : null;

      return {
        ...program,
        participantCount: participantCount || 0,
        conversionCount: conversionCount || 0,
        avgRating,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Programs</h1>
          <p className="text-gray-600">Manage referral and consultant programs</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Program
        </Button>
      </div>

      {programsWithStats.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No programs yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first referral program to get started
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Program
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {programsWithStats.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{program.name}</CardTitle>
                      <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
                        {program.status}
                      </Badge>
                    </div>
                    {program.description && (
                      <CardDescription>{program.description}</CardDescription>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{program.participantCount}</p>
                      <p className="text-sm text-gray-600">Participants</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{program.conversionCount}</p>
                      <p className="text-sm text-gray-600">Conversions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 rounded-lg">
                      <Star className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {program.avgRating ? `${program.avgRating} ⭐` : '—'}
                      </p>
                      <p className="text-sm text-gray-600">Avg Rating</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/programs/participants">
                      View Participants
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/programs/conversions">
                      View Conversions
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/programs/reviews">
                      View Reviews
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
