/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { JarvisDemoEngine } from '@/components/jarvis/jarvis-demo-engine';
import {
  JARVIS_DEMO_SCENARIOS,
  type JarvisDemoScenario,
} from '@/lib/jarvis/jarvis-demo-scenarios';

const invoice = JARVIS_DEMO_SCENARIOS.find((scenario) => scenario.id === 'invoice-execution')!;

const fastScenarios: readonly JarvisDemoScenario[] = JARVIS_DEMO_SCENARIOS.map((scenario) => ({
  ...scenario,
  audioResponse: null,
  orbSequence: scenario.orbSequence.map((step) => ({
    ...step,
    durationMs: step.state === 'success' ? 0 : 10,
  })),
}));

describe('JarvisDemoEngine', () => {
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    HTMLMediaElement.prototype.play = originalPlay;
    jest.useRealTimers();
  });

  it('selects a predetermined instruction and completes as a simulated run', () => {
    render(<JarvisDemoEngine scenarios={fastScenarios} />);

    const engine = document.querySelector('.jarvis-demo-engine');
    expect(engine).toHaveAttribute('data-orb-state', 'idle');
    expect(engine).toHaveAttribute('data-execution', 'simulated');
    expect(screen.queryByText(/simulates you speaking/i)).not.toBeInTheDocument();
    expect(screen.getByText(/try an instruction/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: invoice.userInstruction })).toBeInTheDocument();

    const play = jest.spyOn(HTMLMediaElement.prototype, 'play');
    expect(play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: invoice.userInstruction }));
    expect(engine).toHaveAttribute('data-orb-state', 'listening');
    expect(screen.getByText(`“${invoice.userInstruction}”`)).toBeInTheDocument();
    expect(screen.queryByText(invoice.successResponse)).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-orb-state', 'thinking');
    expect(screen.queryByText(invoice.spokenResponse)).not.toBeInTheDocument();
    expect(screen.queryByText(invoice.successResponse)).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-orb-state', 'speaking');
    expect(screen.getByTestId('jarvis-demo-assistant-line')).toHaveTextContent(invoice.spokenResponse);
    expect(screen.queryByText(invoice.successResponse)).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-orb-state', 'executing');
    expect(screen.getByTestId('jarvis-demo-executing')).toBeInTheDocument();
    expect(screen.getByTestId('jarvis-demo-assistant-line')).toHaveTextContent(invoice.spokenResponse);
    expect(screen.queryByText(invoice.successResponse)).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(engine).toHaveAttribute('data-session-status', 'complete');
    expect(engine).toHaveAttribute('data-completed', 'true');
    expect(engine).toHaveAttribute('data-orb-state', 'success');
    expect(screen.getByTestId('jarvis-demo-assistant-line')).toHaveTextContent(invoice.successResponse);
  });

  it('continues when spoken audio is missing', async () => {
    const play = jest
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new Error('no clip'));
    const withBrokenAudio: readonly JarvisDemoScenario[] = JARVIS_DEMO_SCENARIOS.map((scenario) => ({
      ...scenario,
      audioResponse: { src: '/jarvis-demo/missing.mp3', mimeType: 'audio/mpeg' },
      orbSequence: scenario.orbSequence.map((step) => ({
        ...step,
        durationMs: 10,
      })),
    }));

    render(<JarvisDemoEngine scenarios={withBrokenAudio} />);
    fireEvent.click(screen.getByRole('button', { name: invoice.userInstruction }));

    const engine = document.querySelector('.jarvis-demo-engine');
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-orb-state', 'thinking');

    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-orb-state', 'speaking');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-orb-state', 'executing');

    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(engine).toHaveAttribute('data-session-status', 'complete');
    play.mockRestore();
  });

  it('does not play audio until a scenario is started', async () => {
    const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined as never);
    const withAudio: readonly JarvisDemoScenario[] = fastScenarios.map((scenario) => ({
      ...scenario,
      audioResponse: { src: `/jarvis-demo/${scenario.id}.mp3`, mimeType: 'audio/mpeg' },
    }));

    render(<JarvisDemoEngine scenarios={withAudio} />);
    expect(play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: invoice.userInstruction }));
    expect(play).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(play).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(play).toHaveBeenCalled();
  });

  it('starts the invoice scenario from the orb', () => {
    render(<JarvisDemoEngine scenarios={fastScenarios} />);
    fireEvent.click(screen.getByRole('button', { name: /start generate an invoice demo/i }));
    expect(document.querySelector('.jarvis-demo-engine')).toHaveAttribute(
      'data-orb-state',
      'listening'
    );
    expect(screen.getByText(`“${invoice.userInstruction}”`)).toBeInTheDocument();
  });

  it('renders the same engine for compact and desktop widths', () => {
    const { container } = render(<JarvisDemoEngine scenarios={fastScenarios} />);
    const engine = container.querySelector('.jarvis-demo-engine');
    expect(engine?.className).toMatch(/max-w-xl/);
    expect(engine?.className).toMatch(/sm:max-w-2xl/);
    expect(container.querySelector('[data-orb-size="fluid"]')).not.toBeNull();
  });

  it('hides the scenario picker in compact recording while the demo runs', () => {
    render(<JarvisDemoEngine scenarios={fastScenarios} compact />);
    expect(screen.getByText(/try an instruction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start generate an invoice demo/i }));
    expect(screen.queryByText(/try an instruction/i)).not.toBeInTheDocument();
  });
});
