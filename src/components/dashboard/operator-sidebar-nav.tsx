'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import {
  isOperatorNavActive,
  isOperatorSectionActive,
  shouldShowSectionOverviewSubLink,
} from '@/lib/navigation/operator-nav';
import { entitlementForNavHref, NAV_LOCKED_VISIBLE_HREFS } from '@/lib/entitlements/nav-entitlements';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  WORKSPACE_NAVIGATION_REGISTRY,
  type WorkspaceNavigationRegistryChild,
  type WorkspaceNavigationRegistryItem,
} from '@/lib/workspace-features';
import { useWorkspaceFeatures } from '@/components/workspace-features';
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

type RegistrySidebarNavGroupProps = OperatorSidebarNavProps & {
  label: string;
  sections: readonly WorkspaceNavigationRegistryItem[];
};

type WorkspaceNavigationNode = WorkspaceNavigationRegistryItem | WorkspaceNavigationRegistryChild;

function isAdminVisible(
  item: WorkspaceNavigationNode,
  productProfile: DashboardProductProfile
): boolean {
  return !item.adminOnly || productProfile === 'admin';
}

function isWorkspaceFeatureVisible(
  item: WorkspaceNavigationNode,
  hasFeature: ReturnType<typeof useWorkspaceFeatures>['hasFeature']
): boolean {
  return hasFeature(item.requiredFeature);
}

function isEntitlementVisible(
  href: string,
  isAllowed: ReturnType<typeof useEntitlements>['isAllowed'],
  pilotBypass: boolean
): boolean {
  const feature = entitlementForNavHref(href);
  if (!feature || pilotBypass) return true;
  if (NAV_LOCKED_VISIBLE_HREFS.has(href)) return true;
  return isAllowed(feature);
}

function filterRegistrySections({
  sections,
  productProfile,
  hasFeature,
  isAllowed,
  pilotBypass,
}: {
  sections: readonly WorkspaceNavigationRegistryItem[];
  productProfile: DashboardProductProfile;
  hasFeature: ReturnType<typeof useWorkspaceFeatures>['hasFeature'];
  isAllowed: ReturnType<typeof useEntitlements>['isAllowed'];
  pilotBypass: boolean;
}): WorkspaceNavigationRegistryItem[] {
  return sections
    .filter((section) => isAdminVisible(section, productProfile))
    .filter((section) => isWorkspaceFeatureVisible(section, hasFeature))
    .map((section) => ({
      ...section,
      items: section.items
        ?.filter((item) => isAdminVisible(item, productProfile))
        .filter((item) => isWorkspaceFeatureVisible(item, hasFeature))
        .filter((item) => isEntitlementVisible(item.href, isAllowed, pilotBypass)),
    }));
}

export function RegistrySidebarNavGroup({
  productProfile,
  path,
  label,
  sections,
}: RegistrySidebarNavGroupProps) {
  const { isAllowed, pilotBypass } = useEntitlements();
  const { hasFeature } = useWorkspaceFeatures();
  const visibleSections = filterRegistrySections({
    sections,
    productProfile,
    hasFeature,
    isAllowed,
    pilotBypass,
  });

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleSections.map((section) => {
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

export function OperatorSidebarNav({ productProfile, path }: OperatorSidebarNavProps) {
  return (
    <RegistrySidebarNavGroup
      productProfile={productProfile}
      path={path}
      label="Workspace"
      sections={WORKSPACE_NAVIGATION_REGISTRY}
    />
  );
}
