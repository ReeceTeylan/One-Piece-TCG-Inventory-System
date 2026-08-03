import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Straw hat loading indicator. Bobs and tilts rather than spinning —
 * a flat 2D hat rotating on its own axis reads as a wobbling disc, not a hat.
 */
export function StrawHatLoader({ label, className }: { label?: string; className?: string }) {
  // Unique per instance so two loaders on one page don't share a clipPath.
  const uid = useId().replace(/:/g, '');
  const crown = `M28 46 C28 17 72 17 72 46 Z`;

  return (
    <div className={cn('flex w-full flex-col items-center justify-center gap-3', className)}>
      <style>{`
        @keyframes hat-bob {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%      { transform: translateY(-9px) rotate(5deg); }
        }
        @keyframes hat-shadow {
          0%, 100% { transform: scaleX(1);   opacity: .32; }
          50%      { transform: scaleX(.78); opacity: .16; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hat-anim, .hat-shadow-anim { animation: none !important; }
        }
      `}</style>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 100 70" className="hat-anim size-16 origin-center"
          style={{ animation: 'hat-bob 1.6s ease-in-out infinite' }}
          role="img" aria-label={label ?? 'Loading'}>
          <defs>
            <clipPath id={`crown-${uid}`}><path d={crown} /></clipPath>
          </defs>
          {/* brim */}
          <ellipse cx="50" cy="46" rx="44" ry="14" fill="#e2bd7f" />
          <ellipse cx="50" cy="46" rx="44" ry="14" fill="none" stroke="#b08b4f" strokeWidth="1.5" />
          {/* straw grain */}
          <path d="M12 46 Q50 38 88 46" fill="none" stroke="#c9a straw" strokeWidth="0" />
          <path d="M14 44 Q50 36 86 44" fill="none" stroke="#c9a469" strokeWidth="1" opacity=".7" />
          <path d="M14 49 Q50 57 86 49" fill="none" stroke="#c9a469" strokeWidth="1" opacity=".7" />
          {/* crown */}
          <path d={crown} fill="#eccb92" />
          <path d={crown} fill="none" stroke="#b08b4f" strokeWidth="1.5" />
          {/* red band */}
          <rect x="24" y="36" width="52" height="10" fill="#c0392b" clipPath={`url(#crown-${uid})`} />
        </svg>

        {/* ground shadow, counter-timed to sell the float */}
        <div className="hat-shadow-anim mt-0.5 h-1.5 w-10 rounded-full bg-foreground/40 blur-[3px]"
          style={{ animation: 'hat-shadow 1.6s ease-in-out infinite' }} />
      </div>

      {label && <p className="text-[11.5px] text-muted-foreground">{label}</p>}
    </div>
  );
}