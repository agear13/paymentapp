import { JARVIS_ORB_STATES, type JarvisOrbState } from '@/lib/jarvis/jarvis-orb-states';
import '@/components/jarvis/provvy-orb.css';

const SIZE_CLASS = {
  sm: 'h-24 w-24',
  md: 'h-32 w-32',
  lg: 'h-40 w-40',
  fluid: 'h-[min(42vw,11rem)] w-[min(42vw,11rem)] sm:h-44 sm:w-44',
} as const;

export type ProvvyOrbSize = keyof typeof SIZE_CLASS;

const STATE_LABEL: Record<JarvisOrbState, string> = {
  idle: 'Provvy is ready',
  listening: 'Provvy is listening',
  thinking: 'Provvy is thinking',
  speaking: 'Provvy is speaking',
  executing: 'Provvy is working',
  success: 'Provvy finished',
};

export function ProvvyOrb({
  state = 'idle',
  size = 'fluid',
  className = '',
}: {
  state?: JarvisOrbState;
  size?: ProvvyOrbSize;
  className?: string;
}) {
  const resolved = JARVIS_ORB_STATES.includes(state) ? state : 'idle';

  return (
    <div
      className={`provvy-orb ${SIZE_CLASS[size]} ${className}`.trim()}
      data-state={resolved}
      data-orb-size={size}
      role="img"
      aria-label={STATE_LABEL[resolved]}
    >
      <span className="provvy-orb__bloom" aria-hidden />
      <span className="provvy-orb__ring" aria-hidden />
      <span className="provvy-orb__ring provvy-orb__ring--late" aria-hidden />
      <span className="provvy-orb__halo" aria-hidden />
      <span className="provvy-orb__orbit" aria-hidden />
      <span className="provvy-orb__core" aria-hidden />
      <span className="provvy-orb__sheen" aria-hidden />
      <span className="provvy-orb__voice" aria-hidden />
    </div>
  );
}
