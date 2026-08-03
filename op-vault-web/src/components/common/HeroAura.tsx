/**
 * Ambient motion layer for the dashboard hero cards.
 * Renders a rotating conic beam masked to the border ring, two drifting
 * aurora blobs, and a bobbing straw hat watermark.
 *
 * Must be the FIRST child of a `relative overflow-hidden` Card, and the
 * CardContent after it needs `relative` or the text sits underneath.
 */
export function HeroAura({ label }: { label: string }) {
  // Desync each card off its label so the row never animates in lockstep.
  // Negative delays start mid-cycle — no staggered fade-in on mount.
  const seed = [...label].reduce((a, c) => a + c.charCodeAt(0), 0);
  const beamDelay = -((seed % 70) / 10);
  const driftA = -((seed % 170) / 10);
  const driftB = -((seed % 230) / 10);
  const hatDelay = -((seed % 40) / 10);

  return (
    <>
      <style>{`
        @keyframes hero-beam { to { transform: rotate(360deg); } }
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

      {/* 1. Border beam. Wrapper centers + clips; inner square does the rotating
             so the centering transform can't fight the animation transform. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden rounded-[inherit]">
        <div
          className="hero-anim aspect-square w-[180%]"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, transparent 248deg, rgba(56,160,255,.75) 306deg, rgba(186,232,255,1) 338deg, rgba(56,160,255,.75) 356deg, transparent 360deg)',
            animation: 'hero-beam 7s linear infinite',
            animationDelay: `${beamDelay}s`,
          }}
        />
      </div>

      {/* 2. Mask: covers everything but a 1px ring of the beam. */}
      <div className="pointer-events-none absolute inset-px rounded-[inherit] bg-card" />

      {/* 3. Aurora blobs, inside the mask. */}
      <div className="pointer-events-none absolute inset-px overflow-hidden rounded-[inherit]">
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