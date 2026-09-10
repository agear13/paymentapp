import { opTypography } from '@/lib/design/operational-typography';
import { opSpace } from '@/lib/design/operational-spacing';
import {
  opSurfaceAction,
  opSurfaceCritical,
  opSurfaceIntelligence,
  opSurfaceMetric,
  opSurfacePanel,
  opSurfaceRaised,
  opSurfaceSuccess,
  opToneWarning,
} from '@/lib/design/operational-surfaces';

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

  it('uses theme surfaces instead of light-only paper fills', () => {
    expect(opSurfaceMetric).toContain('bg-card');
    expect(opSurfaceMetric).not.toContain('bg-white');
    expect(opSurfaceIntelligence).toContain('via-card');
    expect(opSurfaceIntelligence).not.toContain('via-white');
    expect(opSurfacePanel).toContain('bg-card/70');
    expect(opSurfacePanel).not.toContain('bg-white');
  });

  it('tints semantic panels with hue-at-low-opacity so dark mode stays dark', () => {
    expect(opSurfaceAction).toMatch(/bg-amber-500\/\[0\.0[46]\]/);
    expect(opSurfaceAction).not.toMatch(/bg-amber-50(?:\/|$|\s)/);
    expect(opSurfaceSuccess).toMatch(/bg-green-500\//);
    expect(opSurfaceCritical).toMatch(/bg-red-500\//);
    expect(opToneWarning).toContain('dark:text-amber-400');
  });
});
