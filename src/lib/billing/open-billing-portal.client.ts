export async function openBillingPortal(): Promise<{ url: string } | { error: string }> {
  const res = await fetch('/api/billing/create-portal-session', {
    method: 'POST',
    credentials: 'include',
  });

  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

  if (!res.ok) {
    return { error: json.error ?? 'Could not open billing portal' };
  }

  if (!json.url) {
    return { error: 'Billing portal URL missing' };
  }

  return { url: json.url };
}
