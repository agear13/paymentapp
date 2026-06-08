'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import {
  getOperatorNavSections,
  isOperatorNavActive,
  isOperatorSectionActive,
  shouldShowSectionOverviewSubLink,
} from '@/lib/navigation/operator-nav';
import { entitlementForNavHref, NAV_LOCKED_VISIBLE_HREFS } from '@/lib/entitlements/nav-entitlements';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type OperatorSidebarNavProps = {
  productProfile: DashboardProductProfile;
  path: string;
};

export function OperatorSidebarNav({ productProfile, path }: OperatorSidebarNavProps) {
  const { isAllowed, pilotBypass } = useEntitlements();
  const sections = getOperatorNavSections(productProfile).map((section) => ({
    ...section,
    items: section.items?.filter((item) => {
      const feature = entitlementForNavHref(item.href);
      if (!feature || pilotBypass) return true;
      if (NAV_LOCKED_VISIBLE_HREFS.has(item.href)) return true;
      return isAllowed(feature);
    }),
  }));

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {sections.map((section) => {
            const childItems = section.items ?? [];
            const useCollapsible = childItems.length > 0;
            const sectionActive = isOperatorSectionActive(path, section);
            const showOverviewSubLink = shouldShowSectionOverviewSubLink(section, childItems);

            if (!useCollapsible) {
              const active = isOperatorNavActive(path, section.href, section.id);
              return (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton asChild isActive={active}>
                    <Link href={section.href}>
                      <section.icon className="size-4" />
                      <span>{section.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <Collapsible key={section.id} asChild defaultOpen={sectionActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={sectionActive}>
                      <section.icon className="size-4" />
                      <span>{section.title}</span>
                      <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {showOverviewSubLink ? (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isOperatorNavActive(path, section.href, section.id)}
                          >
                            <Link href={section.href}>
                              <span>Overview</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ) : null}
                      {childItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isOperatorNavActive(path, item.href, section.id)}
                          >
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
