import { cn } from '@/lib/utils';

/**
 * Straw hat loading indicator. Bobs and tilts rather than spinning —
 * a flat 2D hat rotating on its own axis reads as a wobbling disc, not a hat.
 * Hat geometry matches the HeroAura watermark; keep the two in sync.
 */
export function StrawHatLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex w-full flex-col items-center justify-center gap-3', className)}>
      <style>{`
        @keyframes hat-bob {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50%      { transform: translateY(-10px) rotate(6deg); }
        }
        @keyframes hat-shadow {
          0%, 100% { transform: scaleX(1);   opacity: .3; }
          50%      { transform: scaleX(.74); opacity: .14; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hat-anim, .hat-shadow-anim { animation: none !important; }
        }
      `}</style>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 120 80" className="hat-anim size-20 origin-center"
          style={{ animation: 'hat-bob 1.6s ease-in-out infinite' }}
          role="img" aria-label={label ?? 'Loading'}>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Brim — tips flick upward, front edge sags. Not a flat ellipse. */}
            <path
              d="M3 52 C10 43 30 39 60 39 C90 39 110 43 117 52 C118 61 92 70 60 70 C28 70 2 61 3 52 Z"
              fill="#f0d3a0" stroke="#8a6a34" strokeWidth="1.6"
            />
            {/* Woven straw — concentric with the brim edge, not straight lines. */}
            <path d="M9 54 C25 63 95 63 111 54" stroke="#8a6a34" strokeWidth="1.1" opacity=".55" />
            <path d="M14 51 C30 59 90 59 106 51" stroke="#8a6a34" strokeWidth="1.1" opacity=".4" />
            {/* Crown — base bows downward so it reads as a dome seated in the brim. */}
            <path
              d="M34 48 C33 23 87 23 86 48 C86 56 34 56 34 48 Z"
              fill="#f6dcac" stroke="#8a6a34" strokeWidth="1.6"
            />
            {/* Band — follows the crown's perspective curve. */}
            <path
              d="M33.5 39 C46 45.5 74 45.5 86.5 39 L86.5 47.5 C74 54 46 54 33.5 47.5 Z"
              fill="#c0392b" stroke="#7d2419" strokeWidth="1"
            />
            {/* Highlight on the crown. */}
            <path d="M44 34 C50 27 66 26 74 30" stroke="#fff3d6" strokeWidth="1.4" opacity=".5" />
          </g>
        </svg>

        {/* Ground shadow, counter-timed to sell the float. */}
        <div className="hat-shadow-anim mt-1 h-1.5 w-12 rounded-full bg-foreground/40 blur-[3px]"
          style={{ animation: 'hat-shadow 1.6s ease-in-out infinite' }} />
      </div>

      {label && <p className="text-[11.5px] text-muted-foreground">{label}</p>}
    </div>
  );
}