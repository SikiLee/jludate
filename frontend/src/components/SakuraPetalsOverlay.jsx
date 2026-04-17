import React, { useMemo } from 'react';

const SakuraPetalsOverlay = React.memo(function SakuraPetalsOverlay({ baseCount = 36, containerClass = 'pointer-events-none fixed inset-0 z-0 overflow-hidden' }) {
  const isReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialCount = useMemo(() => {
    const viewportIsSmall = typeof window !== 'undefined' && window.innerWidth < 640;
    return isReduced ? 0 : (viewportIsSmall ? Math.floor(baseCount * 0.5) : baseCount);
  }, []);

  const petals = useMemo(() => Array.from({ length: initialCount }).map((_, index) => {
    const segment = 100 / Math.max(1, initialCount);
    const segmentStart = index * segment;
    const jitter = (Math.random() * 0.8 + 0.1) * segment;
    const left = Math.min(99.5, segmentStart + jitter);
    const size = 10 + Math.random() * 18;
    const duration = 6 + Math.random() * 9;
    const delay = Math.random() * duration;
    const opacity = 0.3 + Math.random() * 0.4;
    const rotate = Math.random() * 360;
    const sway = Math.random() < 0.5 ? -1 : 1;
    return (
      <svg
        key={`petal-${index}`}
        viewBox="0 0 32 32"
        style={{
          left: `${left}%`,
          width: `${size}px`,
          height: `${size * 1.2}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${-delay}s`,
          opacity,
          transform: `rotate(${rotate}deg)`,
          ['--sway-dir']: sway,
          willChange: 'transform'
        }}
        className="absolute -top-10 animate-[sakura-fall_linear_infinite] text-roseTint/80 select-none"
      >
        <path
          d="M16 2 C12 6, 10 10, 10 14 C10 18, 13 22, 16 30 C19 22, 22 18, 22 14 C22 10, 20 6, 16 2 Z"
          fill="currentColor"
        />
      </svg>
    );
  }), []);

  return isReduced ? null : (
    <>
      <style>{`
        @keyframes sakura-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg) }
          25%  { transform: translate3d(calc(var(--sway-dir, 1) * -10px), 25vh, 0) rotate(90deg) }
          50%  { transform: translate3d(calc(var(--sway-dir, 1) *  10px), 50vh, 0) rotate(180deg) }
          75%  { transform: translate3d(calc(var(--sway-dir, 1) * -10px), 75vh, 0) rotate(270deg) }
          100% { transform: translate3d(calc(var(--sway-dir, 1) *  10px), 110vh, 0) rotate(360deg) }
        }
      `}</style>
      <div className={containerClass}>
        {petals}
      </div>
    </>
  );
});

export default SakuraPetalsOverlay;
