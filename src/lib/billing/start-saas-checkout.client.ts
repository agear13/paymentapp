export type SaasCheckoutContext = 'onboarding' | 'upgrade';

export type SaasCheckoutPlan = 'professional' | 'growth';

export async function startSaasCheckout(input: {
  plan: SaasCheckoutPlan;
  context?: SaasCheckoutContext;
}): Promise<{ url: string } | { error: string }> {
  const res = await fetch('/api/billing/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plan: input.plan,
      context: input.context ?? 'upgrade',
    }),
  });

  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

  if (!res.ok) {
    return { error: json.error ?? 'Could not start checkout' };
  }

  if (!json.url) {
    return { error: 'Checkout URL missing' };
  }

  return { url: json.url };
}
