'use client';

import { CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCreativeRequirementsCatalog } from '@/lib/marketing-jobs';

export function CreativeRequirementsSection() {
  const requirements = getCreativeRequirementsCatalog();

  return (
    <section id="creative-requirements" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Creative Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Production requirements per asset — sourced from the canonical asset catalogue.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {requirements.map((item) => (
          <Card key={item.assetType} className="gap-4 py-5">
            <CardHeader className="gap-2 px-5 pb-0">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{item.label}</CardTitle>
                {item.canvaReady ? (
                  <Badge variant="outline">Ready for Canva</Badge>
                ) : null}
              </div>
              <CardDescription>Requires</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <ul className="space-y-2">
                {item.requirements.map((requirement) => (
                  <li key={requirement} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                    {requirement}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
