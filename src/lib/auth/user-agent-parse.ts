export type ParsedUserAgent = {
  browser: string;
  os: string;
};

export function parseUserAgent(userAgent: string | undefined | null): ParsedUserAgent {
  if (!userAgent) {
    return { browser: 'Unknown browser', os: 'Unknown OS' };
  }

  const ua = userAgent;

  let browser = 'Unknown browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/OPR\//i.test(ua)) browser = 'Opera';

  let os = 'Unknown OS';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os };
}

export function resolveLocationFromRequest(headers: {
  get(name: string): string | null;
}): string | undefined {
  const country = headers.get('cf-ipcountry');
  if (country && country !== 'XX' && country.length === 2) {
    return countryToLabel(country);
  }
  return undefined;
}

const COUNTRY_LABELS: Record<string, string> = {
  AU: 'Australia',
  US: 'United States',
  GB: 'United Kingdom',
  NZ: 'New Zealand',
  DE: 'Germany',
  FR: 'France',
  SG: 'Singapore',
  CA: 'Canada',
};

function countryToLabel(code: string): string {
  return COUNTRY_LABELS[code.toUpperCase()] ?? code.toUpperCase();
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
