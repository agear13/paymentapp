import fs from 'fs';
import path from 'path';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';
import { COMMERCIAL_WALKTHROUGH_COMPLETION } from '@/lib/journey/commercial-walkthrough-steps';

const STALE_CALENDLY_CONSULTATION_URL = 'https://calendly.com/provvy/consultation';

const PRODUCTION_CONSULTATION_SURFACES = [
  'components/journey/lovable/journey-landing-page.tsx',
  'components/journey/lovable/commercial-walkthrough.tsx',
  'components/labs/labs-nav.tsx',
  'components/labs/labs-footer.tsx',
  'components/labs/labs-hero.tsx',
  'components/labs/labs-final-cta.tsx',
  'components/labs/labs-company-brain.tsx',
  'components/labs/labs-ai-marketing-team.tsx',
  'lib/journey/commercial-walkthrough-steps.ts',
  'lib/config/calendly-consultation-url.ts',
] as const;

describe('CALENDLY_CONSULTATION_URL', () => {
  it('points to the active Calendly booking page', () => {
    expect(CALENDLY_CONSULTATION_URL).toBe('https://calendly.com/alisha-provvypay/30min');
  });

  it('does not use the stale broken consultation URL', () => {
    expect(CALENDLY_CONSULTATION_URL).not.toBe(STALE_CALENDLY_CONSULTATION_URL);
  });
});

describe('consultation CTA configuration', () => {
  it('walkthrough completion uses the canonical consultation URL', () => {
    const consultationAction = COMMERCIAL_WALKTHROUGH_COMPLETION.actions.find(
      (action) => action.label === 'Book a Consultation'
    );

    expect(consultationAction).toEqual(
      expect.objectContaining({
        href: CALENDLY_CONSULTATION_URL,
        external: true,
      })
    );
  });

  it('production marketing surfaces do not reference the stale consultation URL', () => {
    const projectRoot = fs.existsSync(path.join(process.cwd(), 'components'))
      ? process.cwd()
      : path.join(process.cwd(), 'src');

    for (const relativePath of PRODUCTION_CONSULTATION_SURFACES) {
      const absolutePath = path.join(projectRoot, relativePath);
      const contents = fs.readFileSync(absolutePath, 'utf8');

      expect(contents).not.toContain(STALE_CALENDLY_CONSULTATION_URL);
    }
  });
});
