import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SectionHubLink = {
  title: string;
  description: string;
  href: string;
  icon?: LucideIcon;
};

type SectionHubPageProps = {
  title: string;
  description: string;
  links: SectionHubLink[];
};

export function SectionHubPage({ title, description, links }: SectionHubPageProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {link.icon ? <link.icon className="h-4 w-4 text-muted-foreground" /> : null}
                    {link.title}
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
