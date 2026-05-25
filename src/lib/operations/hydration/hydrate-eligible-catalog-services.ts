export type HydratedCatalogService = {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  currency: string;
};

export type RawCatalogServiceInput = {
  id: string;
  name?: string | null;
  description?: string | null;
  currency?: string | null;
  price?: number | string | null;
};

/** Canonical catalog service hydration — no surface may render raw UUIDs. */
export function hydrateEligibleCatalogServices(
  serviceIds: string[],
  catalog: RawCatalogServiceInput[] = [],
  fallbackCurrency = 'AUD'
): HydratedCatalogService[] {
  if (serviceIds.length === 0) return [];

  const byId = new Map(catalog.map((s) => [s.id, s] as const));

  return serviceIds.map((id) => {
    const raw = byId.get(id);
    const name = raw?.name?.trim() || `Service ${id.slice(0, 8)}`;
    return {
      id,
      name,
      category: inferCategory(raw?.description),
      sku: id.slice(0, 8).toUpperCase(),
      currency: (raw?.currency ?? fallbackCurrency).toUpperCase(),
    };
  });
}

export function hydrateAllCatalogServices(
  catalog: RawCatalogServiceInput[],
  fallbackCurrency = 'AUD'
): HydratedCatalogService[] {
  return catalog.map((s) => ({
    id: s.id,
    name: s.name?.trim() || `Service ${s.id.slice(0, 8)}`,
    category: inferCategory(s.description),
    sku: s.id.slice(0, 8).toUpperCase(),
    currency: (s.currency ?? fallbackCurrency).toUpperCase(),
  }));
}

function inferCategory(description?: string | null): string | null {
  if (!description?.trim()) return null;
  const first = description.trim().split(/[.\n]/)[0]?.trim();
  return first && first.length <= 48 ? first : null;
}

/** Map hydrated services to commission-scope catalog refs. */
export function catalogRefsFromHydrated(services: HydratedCatalogService[]) {
  return services.map((s) => ({ id: s.id, name: s.name }));
}
