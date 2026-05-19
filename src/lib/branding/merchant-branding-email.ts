/**
 * Email-safe merchant branding markup (server-rendered; no client onError).
 */

export function buildMerchantBrandingEmailMarkup(options: {
  merchantName: string;
  logoUrl: string | null;
  initials: string;
}): string {
  const safeMerchant = escapeHtmlAttribute(options.merchantName || 'Merchant');
  const safeInitials = escapeHtmlAttribute(options.initials || '?');

  if (options.logoUrl && /^https?:\/\//i.test(options.logoUrl)) {
    const safeLogoUrl = escapeHtmlAttribute(options.logoUrl);
    return `<p style="margin:0 0 12px 0"><img src="${safeLogoUrl}" alt="${safeMerchant} logo" style="max-height:56px;max-width:220px;width:auto;height:auto;display:block;object-fit:contain"/></p>`;
  }

  return `<p style="margin:0 0 12px 0"><span style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:14px;font-weight:600;text-align:center">${safeInitials}</span></p>`;
}

function escapeHtmlAttribute(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
