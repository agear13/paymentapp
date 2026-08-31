/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { JarvisRecordFrame } from '@/components/jarvis/jarvis-record-frame';
import { JARVIS_RECORDING_PATH } from '@/lib/jarvis/jarvis-recording-mode';

describe('JarvisRecordFrame', () => {
  it('renders a compact demo without page chrome', () => {
    const { container } = render(<JarvisRecordFrame />);
    const frame = container.querySelector('[data-jarvis-recording="true"]');
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute('data-recording-path', JARVIS_RECORDING_PATH);
    expect(container.querySelector('.jarvis-demo-engine--compact')).not.toBeNull();
    expect(container.querySelector('[data-hero-scenario="invoice-execution"]')).not.toBeNull();
  });
});
