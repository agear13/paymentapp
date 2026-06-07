'use client';

import * as React from 'react';
import { Check, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_AGREEMENT_TEMPLATES,
  ONBOARDING_TEMPLATE_CATEGORIES,
  type OnboardingTemplateId,
} from '@/lib/onboarding/operator-onboarding-types';

type OnboardingTemplateGalleryProps = {
  selectedTemplateId: OnboardingTemplateId | null;
  onSelectTemplate: (templateId: OnboardingTemplateId) => void;
  className?: string;
};

export function OnboardingTemplateGallery({
  selectedTemplateId,
  onSelectTemplate,
  className,
}: OnboardingTemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = React.useState<string>('All');

  const filteredTemplates =
    activeCategory === 'All'
      ? ONBOARDING_AGREEMENT_TEMPLATES
      : ONBOARDING_AGREEMENT_TEMPLATES.filter((t) => t.category === activeCategory);

  return (
    <div className={cn('space-y-5', className)}>
      <div>
        <p className="text-muted-foreground text-sm">
          Templates are a fast-start mechanism — pre-configured agreements you can customize after
          Agreement Intelligence review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory('All')}
          className={cn(
            'rounded-full border px-3 py-1 text-xs transition-colors',
            activeCategory === 'All'
              ? 'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.08)] text-primary'
              : 'border-[rgba(124,92,255,0.12)] text-muted-foreground hover:border-[rgba(124,92,255,0.25)]'
          )}
        >
          All
        </button>
        {ONBOARDING_TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              activeCategory === category
                ? 'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.08)] text-primary'
                : 'border-[rgba(124,92,255,0.12)] text-muted-foreground hover:border-[rgba(124,92,255,0.25)]'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filteredTemplates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectTemplate(template.id)}
              className={cn(
                'relative rounded-xl border p-5 text-left transition-all duration-200 hover:border-[rgba(124,92,255,0.25)] hover:shadow-sm',
                isSelected &&
                  'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.06)] ring-2 ring-[rgba(124,92,255,0.12)] shadow-sm',
                !isSelected && 'border-[rgba(124,92,255,0.12)] bg-white'
              )}
            >
              {isSelected ? (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 mb-2 pr-8">
                <p className="font-medium">{template.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  {template.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Participants:</span>{' '}
                  {template.participantSummary}
                </p>
                <p>
                  <span className="font-medium text-foreground">Settlement:</span>{' '}
                  {template.settlementModel}
                </p>
                <p className="sm:col-span-2">
                  <span className="font-medium text-foreground">Typical use:</span>{' '}
                  {template.typicalUseCase}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                <Clock className="h-3.5 w-3.5" />
                Setup time: {template.setupTimeMinutes} minutes
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
