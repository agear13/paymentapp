/**
 * Share template utilities for referral links
 */

export const MAX_ADVOCATE_PERCENT = 50;
export const DEFAULT_ADVOCATE_PERCENT = 10;

export function isIOSUserAgent(ua: string): boolean {
  return /iPad|iPhone|iPod/.test(ua);
}

export function isMobileUserAgent(ua: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Build SMS URL for share. Uses ?body= for non-iOS, &body= for iOS when phone provided.
 * Without phone: sms:?body=... (valid on mobile).
 */
export function buildSmsUrl(
  body: string,
  phoneNumber?: string | null,
  userAgent?: string
): string {
  const encoded = encodeURIComponent(body);
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isIOS = isIOSUserAgent(ua);

  if (!phoneNumber || phoneNumber.trim() === '') {
    return `sms:?body=${encoded}`;
  }
  const num = phoneNumber.replace(/\D/g, '');
  return isIOS ? `sms:${num}&body=${encoded}` : `sms:${num}?body=${encoded}`;
}

export interface ShareTemplates {
  review: {
    subject: string;
    emailBody: string;
    whatsapp: string;
    sms: string;
  };
  advocate: {
    subject: string;
    emailBody: string;
    whatsapp: string;
    sms: string;
  };
}

export function buildShareTemplates(
  link: string,
  type: 'review' | 'advocate',
  options?: { clientName?: string; serviceLabel?: string }
): ShareTemplates[typeof type] {
  const { clientName, serviceLabel = 'my services' } = options ?? {};
  const greeting = clientName ? `Hi ${clientName},` : 'Hi,';

  if (type === 'review') {
    return {
      subject: 'Quick review request',
      emailBody: `${greeting}\n\nThanks for working with me — would you mind leaving a quick review? It helps a lot.\n\n${link}\n\nThanks!`,
      whatsapp: `Thanks for working with me — would you mind leaving a quick review? ${link}`,
      sms: `Thanks for working with me! Would you mind leaving a quick review? ${link}`,
    };
  }

  return {
    subject: `Referral link for ${serviceLabel}`,
    emailBody: `${greeting}\n\nHere's your referral link for ${serviceLabel}. Share it with anyone who might benefit — you'll earn a commission when they convert.\n\n${link}\n\nLet me know if you have questions!`,
    whatsapp: `Here's your referral link for ${serviceLabel}. Share it with anyone who might benefit — you'll earn a commission: ${link}`,
    sms: `Your referral link for ${serviceLabel}: ${link}. Share it and earn when they convert!`,
  };
}

export function validateAdvocatePercent(
  advocatePercent: number,
  ownerPercent: number
): { valid: boolean; consultantRemainder: number; error?: string } {
  const consultantRemainder = 100 - ownerPercent - advocatePercent;
  if (advocatePercent < 0 || advocatePercent > MAX_ADVOCATE_PERCENT) {
    return {
      valid: false,
      consultantRemainder: 0,
      error: `Advocate percent must be between 0 and ${MAX_ADVOCATE_PERCENT}`,
    };
  }
  if (consultantRemainder <= 0) {
    return {
      valid: false,
      consultantRemainder,
      error: `Consultant remainder would be ${consultantRemainder.toFixed(1)}%. Must be positive.`,
    };
  }
  return { valid: true, consultantRemainder };
}

export function computeSplitPreview(
  grossAmount: number,
  ownerPercent: number,
  advocatePercent: number
): { ownerAmount: number; advocateAmount: number; consultantAmount: number; ownerPct: number; advocatePct: number; consultantPct: number } {
  const ownerAmount = Math.round((grossAmount * ownerPercent) / 100 * 100) / 100;
  const advocateAmount = Math.round((grossAmount * advocatePercent) / 100 * 100) / 100;
  const consultantAmount = Math.round((grossAmount - ownerAmount - advocateAmount) * 100) / 100;
  const consultantPct = 100 - ownerPercent - advocatePercent;
  return {
    ownerAmount,
    advocateAmount,
    consultantAmount: Math.max(0, consultantAmount),
    ownerPct: ownerPercent,
    advocatePct: advocatePercent,
    consultantPct,
  };
}
