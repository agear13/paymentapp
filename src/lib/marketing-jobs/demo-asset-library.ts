/**
 * Demo-only static asset library for Thirsty Turtl campaign imports.
 * Simulates future automated sync from AI Creative Team output folders.
 */
export const MARKETING_DEMO_ASSET_LIBRARY_SLUG = 'thirsty-turtl/gentle-cleanser';

export const MARKETING_DEMO_ASSET_LIBRARY_BASE = `/demo-assets/${MARKETING_DEMO_ASSET_LIBRARY_SLUG}`;

const DEMO_ASSET_PATH_PREFIXES = ['Preview Images/', 'Assets/'] as const;

function normalizeRelativeAssetPath(path: string): string {
  return path.trim().replace(/\\/g, '/');
}

/**
 * Rewrites AI Creative Team relative paths to web-accessible demo library URLs.
 * Leaves absolute URLs and already-rooted paths unchanged.
 */
export function rewriteDemoAssetPath(path: string | undefined): string | undefined {
  if (path == null) return undefined;

  const trimmed = path.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;

  const normalized = normalizeRelativeAssetPath(trimmed);
  const matchesDemoPrefix = DEMO_ASSET_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!matchesDemoPrefix) return trimmed;

  return `${MARKETING_DEMO_ASSET_LIBRARY_BASE}/${normalized}`;
}

/** Canonical demo filenames aligned with AI Creative Team production output. */
export const MARKETING_DEMO_ASSET_FILES = {
  preview: {
    instagramCarousel: 'Preview Images/Instagram Carousel.png',
    facebookPost: 'Preview Images/Facebook Post.png',
    pinterestPins: 'Preview Images/Pinterest Pins.png',
    instagramStories: 'Preview Images/Instagram Stories.png',
    newsletterHeader: 'Preview Images/Newsletter Header.png',
  },
  download: {
    instagramCarousel: 'Assets/Instagram Carousel.png',
    facebookPost: 'Assets/Facebook Post.png',
    pinterestPins: 'Assets/Pinterest Pins.png',
    instagramStories: 'Assets/Instagram Stories.png',
    newsletterHeader: 'Assets/Newsletter Header.png',
  },
} as const;
