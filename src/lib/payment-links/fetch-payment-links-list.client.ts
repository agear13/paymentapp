/**
 * Client-side payment links list fetch — respects API max limit of 100.
 */

export const PAYMENT_LINKS_LIST_MAX_LIMIT = 100;

export type PaymentLinksListFilters = {
  organizationId?: string;
  status?: string;
  currency?: string;
  search?: string;
};

export type PaymentLinksListPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PaymentLinksListResponse<T> = {
  data: T[];
  pagination?: PaymentLinksListPagination;
};

function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return PAYMENT_LINKS_LIST_MAX_LIMIT;
  }
  return Math.min(Math.floor(limit), PAYMENT_LINKS_LIST_MAX_LIMIT);
}

function buildListParams(
  filters: PaymentLinksListFilters & { page: number; limit: number }
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(clampLimit(filters.limit)),
  });
  if (filters.organizationId?.trim()) {
    params.set('organizationId', filters.organizationId.trim());
  }
  if (filters.status?.trim()) params.set('status', filters.status.trim());
  if (filters.currency?.trim()) params.set('currency', filters.currency.trim());
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  return params;
}

export async function fetchPaymentLinksPage<T = unknown>(
  filters: PaymentLinksListFilters & { page?: number; limit?: number },
  init?: RequestInit
): Promise<{ data: T[]; pagination: PaymentLinksListPagination }> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = clampLimit(filters.limit);
  const params = buildListParams({ ...filters, page, limit });
  const response = await fetch(`/api/payment-links?${params.toString()}`, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Failed to fetch payment links');
  }

  const result = (await response.json()) as PaymentLinksListResponse<T>;
  const pagination = result.pagination ?? {
    page,
    limit,
    total: result.data?.length ?? 0,
    totalPages: 1,
  };

  return {
    data: result.data ?? [],
    pagination,
  };
}

/** Fetch every page until all payment links for the org are loaded. */
export async function fetchAllPaymentLinks<T = unknown>(
  filters: PaymentLinksListFilters = {},
  init?: RequestInit
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, pagination } = await fetchPaymentLinksPage<T>(
      { ...filters, page, limit: PAYMENT_LINKS_LIST_MAX_LIMIT },
      init
    );
    all.push(...data);
    totalPages = pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return all;
}
