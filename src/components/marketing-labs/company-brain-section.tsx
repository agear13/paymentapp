'use client';

import { ArrowRight, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MARKETING_DEMO_BRAND } from '@/lib/marketing-jobs/demo-brand';
import { COMPANY_BRAIN_CATEGORIES } from '@/lib/marketing-labs/placeholder-data';

export function CompanyBrainSection() {
  const categories = COMPANY_BRAIN_CATEGORIES;

  return (
    <section id="company-brain" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Company Brain</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Everything the AI Marketing Team knows about {MARKETING_DEMO_BRAND} — brand, products, customers, and positioning.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in duration-500">
        {categories.map((category) => {
            const Icon = category.icon;
            const isComplete = category.status === 'Complete';

            return (
              <Card key={category.id} className="gap-4 py-5">
                <CardHeader className="gap-3 px-5 pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base">{category.title}</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        isComplete &&
                          'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]'
                      )}
                    >
                      {category.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm leading-relaxed">
                    {category.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5">
                  <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
                    <Upload className="mr-2 size-4" />
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.04] to-transparent animate-in fade-in duration-500">
        <CardHeader>
          <CardTitle>What happens once you submit</CardTitle>
          <CardDescription>
            Our team handles the build so your AI Marketing Team can start producing campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>We build the Company Brain from your uploaded materials</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Configure the AI Marketing Team for your brand and goals</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Notify you when your Company Brain is ready to use</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Campaign generation becomes available in your portal</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
