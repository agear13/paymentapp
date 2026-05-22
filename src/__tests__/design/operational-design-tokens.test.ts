import { opTypography } from '@/lib/design/operational-typography';
import { opSpace } from '@/lib/design/operational-spacing';
import { opSurfaceRaised } from '@/lib/design/operational-surfaces';

describe('operational design tokens', () => {
  it('defines readable metadata tier', () => {
    expect(opTypography.meta).toContain('foreground/70');
    expect(opTypography.meta).toContain('text-sm');
  });

  it('defines page spacing cadence', () => {
    expect(opSpace.pageY).toBeTruthy();
    expect(opSpace.sectionY).toBeTruthy();
  });

  it('defines raised surfaces', () => {
    expect(opSurfaceRaised).toContain('border');
  });
});
