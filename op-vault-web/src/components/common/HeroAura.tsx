/**
 * Ambient motion layer for the dashboard hero cards.
 *
 * The border light is a RELAY: one shared 6s timeline, each card lit during
 * its own 2s slot, so the beam appears to travel across the row card-to-card.
 * `index` must match the card's left-to-right position or the relay breaks.
 *
 * Must be the FIRST child of a `relative overflow-hidden` Card, and the
 * CardContent after it needs `relative` or the text sits underneath.
 */
const TOTAL = 6; // full relay cycle, seconds
const SEGMENT = 2; // per-card lit slot

export function HeroAura({ index }: { index: number }) {
  // Negative delay starts each card mid-timeline: no staggered fade-in on mount.
  const sweepDelay = -(TOTAL - index * SEGMENT);
  const driftA = -(index * 5.5);
  const driftB = -(index * 8.5);
  const hatDelay = -(index * 1.7);

  return (
    <>
      <style>{`
        @keyframes hero-sweep {
          0%   { transform: translateX(-120%) skewX(-14deg); }
          33%  { transform: translateX(220%)  skewX(-14deg); }
          100% { transform: translateX(220%)  skewX(-14deg); }
        }
        @keyframes hero-drift-a {
          0%, 100% { transform: translate3d(-14%, -6%, 0) scale(1); }
          33%      { transform: translate3d(34%, 14%, 0) scale(1.3); }
          66%      { transform: translate3d(10%, -20%, 0) scale(.85); }
        }
        @keyframes hero-drift-b {
          0%, 100% { transform: translate3d(40%, 16%, 0) scale(1.15); }
          50%      { transform: translate3d(-18%, -12%, 0) scale(.8); }
        }
        @keyframes hero-hat {
          0%, 100% { transform: translateY(0) rotate(-9deg); }
          50%      { transform: translateY(-6px) rotate(9deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-anim { animation: none !important; }
        }
      `}</style>

      {/* 1. The travelling light. Rendered full-bleed, then masked to the ring. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="hero-anim absolute inset-y-0 left-0 w-1/2"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(56,160,255,.55) 38%, rgba(200,240,255,1) 52%, rgba(56,160,255,.55) 66%, transparent 100%)',
            animation: `hero-sweep ${TOTAL}s linear infinite`,
            animationDelay: `${sweepDelay}s`,
          }}
        />
      </div>

      {/* 2. Mask — leaves only a 1px ring of the light above. */}
      <div className="pointer-events-none absolute inset-px rounded-[inherit] bg-card" />

      {/* 3. Interior: aurora drift + a soft echo of the sweep, all inside the mask. */}
      <div className="pointer-events-none absolute inset-px overflow-hidden rounded-[inherit]">
        <div
          className="hero-anim absolute inset-y-0 left-0 w-1/2 bg-sky-300/[.13] blur-2xl"
          style={{ animation: `hero-sweep ${TOTAL}s linear infinite`, animationDelay: `${sweepDelay}s` }}
        />
        <div
          className="hero-anim absolute -left-10 -top-10 size-44 rounded-full bg-sky-500/25 blur-3xl"
          style={{ animation: 'hero-drift-a 17s ease-in-out infinite', animationDelay: `${driftA}s` }}
        />
        <div
          className="hero-anim absolute -bottom-16 right-0 size-40 rounded-full bg-violet-500/20 blur-3xl"
          style={{ animation: 'hero-drift-b 23s ease-in-out infinite', animationDelay: `${driftB}s` }}
        />
      </div>

      {/* 4. Straw hat watermark. */}
      <svg
        viewBox="0 0 100 70"
        className="hero-anim pointer-events-none absolute -bottom-1 right-3 size-14 opacity-[.07]"
        style={{ animation: 'hero-hat 5s ease-in-out infinite', animationDelay: `${hatDelay}s` }}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="46" rx="44" ry="14" fill="#f3d9a4" />
        <path d="M28 46 C28 17 72 17 72 46 Z" fill="#f3d9a4" />
        <path d="M28 46 C28 17 72 17 72 46 Z" fill="none" stroke="#8a6a34" strokeWidth="2" />
        <path d="M14 44 Q50 36 86 44" fill="none" stroke="#8a6a34" strokeWidth="1.5" />
      </svg>
    </>
  );
}