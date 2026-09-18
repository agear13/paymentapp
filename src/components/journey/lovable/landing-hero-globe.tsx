'use client';

import { useEffect, useId, useRef } from 'react';

export function LandingHeroGlobe() {
  const uid = useId().replace(/:/g, '');
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (event: PointerEvent) => {
      targetX = ((event.clientX / window.innerWidth) - 0.72) * 18;
      targetY = ((event.clientY / window.innerHeight) - 0.22) * 12;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.035;
      currentY += (targetY - currentY) * 0.035;
      layer.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const clip = `${uid}-clip`;
  const core = `${uid}-core`;
  const atmosphere = `${uid}-atmosphere`;
  const shade = `${uid}-shade`;
  const land = `${uid}-land`;
  const glow = `${uid}-glow`;

  return (
    <div className="landing-hero-globe pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden="true">
      <div ref={layerRef} className="landing-hero-globe__parallax absolute inset-0">
        <div className="landing-hero-globe__frame">
          <svg viewBox="0 0 512 512" className="h-full w-full" focusable="false">
            <defs>
              <radialGradient id={atmosphere} cx="62%" cy="36%" r="58%">
                <stop offset="52%" stopColor="oklch(0.48 0.18 293)" stopOpacity="0" />
                <stop offset="78%" stopColor="oklch(0.52 0.2 293)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="oklch(0.62 0.2 293)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={core} cx="36%" cy="42%" r="68%">
                <stop offset="0%" stopColor="oklch(0.22 0.05 275)" />
                <stop offset="42%" stopColor="oklch(0.2 0.08 285)" />
                <stop offset="78%" stopColor="oklch(0.28 0.14 293)" />
                <stop offset="100%" stopColor="oklch(0.42 0.18 293)" />
              </radialGradient>
              <radialGradient id={shade} cx="68%" cy="32%" r="62%">
                <stop offset="0%" stopColor="oklch(0.92 0.04 293)" stopOpacity="0.28" />
                <stop offset="28%" stopColor="oklch(0.78 0.1 293)" stopOpacity="0.08" />
                <stop offset="62%" stopColor="oklch(0.18 0.04 275)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="oklch(0.12 0.03 275)" stopOpacity="0.55" />
              </radialGradient>
              <linearGradient id={land} x1="20%" y1="20%" x2="80%" y2="90%">
                <stop offset="0%" stopColor="oklch(0.72 0.14 293)" stopOpacity="0.42" />
                <stop offset="100%" stopColor="oklch(0.55 0.12 280)" stopOpacity="0.22" />
              </linearGradient>
              <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
              <clipPath id={clip}>
                <circle cx="256" cy="256" r="168" />
              </clipPath>
            </defs>

            <g className="landing-hero-globe__drift">
              <circle cx="256" cy="256" r="236" fill={`url(#${atmosphere})`} />
              <ellipse
                className="landing-hero-globe__orbit"
                cx="256"
                cy="256"
                rx="214"
                ry="78"
                fill="none"
                stroke="oklch(0.68 0.18 293)"
                strokeOpacity="0.18"
                strokeWidth="0.8"
              />
              <ellipse
                className="landing-hero-globe__orbit landing-hero-globe__orbit--slow"
                cx="256"
                cy="256"
                rx="198"
                ry="64"
                fill="none"
                stroke="oklch(0.72 0.16 293)"
                strokeOpacity="0.12"
                strokeWidth="0.6"
              />

              <circle cx="256" cy="256" r="168" fill={`url(#${core})`} />

              <g clipPath={`url(#${clip})`}>
                <g className="landing-hero-globe__spin">
                  <g
                    fill="none"
                    stroke="oklch(0.78 0.08 293)"
                    strokeOpacity="0.16"
                    strokeWidth="0.7"
                  >
                    <ellipse cx="256" cy="256" rx="56" ry="168" />
                    <ellipse cx="256" cy="256" rx="108" ry="168" />
                    <ellipse cx="256" cy="256" rx="148" ry="168" />
                    <line x1="256" y1="88" x2="256" y2="424" />
                    <ellipse cx="256" cy="256" rx="168" ry="42" />
                    <ellipse cx="256" cy="184" rx="148" ry="28" />
                    <ellipse cx="256" cy="328" rx="148" ry="28" />
                  </g>

                  <g fill={`url(#${land})`}>
                    <path d="M168 168c18-22 42-28 58-18 14 9 16 28 8 46-6 14-4 30 8 40 10 8 8 24-6 30-18 8-38-2-50-18-14-18-22-38-18-80z" />
                    <path d="M186 292c16 8 22 28 12 44-10 16-32 22-46 12-12-8-12-26-2-36 8-8 22-18 36-20z" />
                    <path d="M252 146c28-8 48 6 62 28 10 16 28 18 40 8 14-10 32-4 38 12 6 18-8 32-22 40-18 10-22 28-12 44 8 12-2 28-18 30-22 4-36-16-48-32-16-22-42-28-58-14-12 10-28 6-34-8-8-18 10-42 24-54 16-14 18-42 28-54z" />
                    <path d="M318 300c22 4 28 26 18 42-12 18-38 22-52 8-12-12-8-30 6-38 12-8 16-14 28-12z" />
                    <path d="M372 214c16-4 28 10 24 24-4 12-18 18-28 12-10-6-12-18-4-26 4-6 4-8 8-10z" />
                  </g>

                  <g fill="oklch(0.82 0.12 293)" filter={`url(#${glow})`}>
                    <circle className="landing-hero-globe__node" cx="196" cy="188" r="2.4" />
                    <circle className="landing-hero-globe__node" cx="228" cy="214" r="1.8" />
                    <circle className="landing-hero-globe__node" cx="274" cy="176" r="2.2" />
                    <circle className="landing-hero-globe__node" cx="318" cy="208" r="2.6" />
                    <circle className="landing-hero-globe__node" cx="348" cy="236" r="1.9" />
                    <circle className="landing-hero-globe__node" cx="292" cy="268" r="2.1" />
                    <circle className="landing-hero-globe__node" cx="246" cy="302" r="1.7" />
                    <circle className="landing-hero-globe__node" cx="204" cy="258" r="1.8" />
                  </g>

                  <g
                    fill="none"
                    stroke="oklch(0.78 0.16 293)"
                    strokeOpacity="0.45"
                    strokeWidth="0.9"
                  >
                    <path d="M196 188C214 170 248 168 274 176" />
                    <path d="M274 176C296 188 310 198 318 208" />
                    <path d="M318 208C338 228 344 248 292 268" />
                    <path d="M228 214C236 248 240 286 246 302" />
                    <path d="M204 258C248 248 286 244 318 208" />
                  </g>
                </g>
                <circle cx="256" cy="256" r="168" fill={`url(#${shade})`} />
              </g>

              <circle
                cx="256"
                cy="256"
                r="168.6"
                fill="none"
                stroke="oklch(0.72 0.16 293)"
                strokeOpacity="0.28"
                strokeWidth="1.1"
              />

              <g fill="oklch(0.8 0.14 293)">
                <circle className="landing-hero-globe__node" cx="412" cy="148" r="2" opacity="0.55" />
                <circle className="landing-hero-globe__node" cx="438" cy="228" r="1.6" opacity="0.4" />
                <circle className="landing-hero-globe__node" cx="398" cy="312" r="1.8" opacity="0.45" />
              </g>
              <g fill="none" stroke="oklch(0.72 0.14 293)" strokeOpacity="0.2" strokeWidth="0.7">
                <path d="M348 176C372 158 392 150 412 148" />
                <path d="M362 236C390 232 418 230 438 228" />
                <path d="M338 292C360 304 380 310 398 312" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
