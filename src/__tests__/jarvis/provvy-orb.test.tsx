/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ProvvyOrb } from '@/components/jarvis/provvy-orb';
import { JARVIS_ORB_STATES } from '@/lib/jarvis/jarvis-orb-states';

describe('ProvvyOrb', () => {
  it('exposes each orb state for transition styling', () => {
    const { rerender } = render(<ProvvyOrb state="idle" />);
    for (const state of JARVIS_ORB_STATES) {
      rerender(<ProvvyOrb state={state} />);
      const orb = screen.getByRole('img');
      expect(orb).toHaveAttribute('data-state', state);
    }
  });

  it('uses one fluid orb for mobile and desktop', () => {
    render(<ProvvyOrb state="listening" size="fluid" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-orb-size', 'fluid');
    expect(screen.getByRole('img').className).toMatch(/sm:h-44/);
  });
});
