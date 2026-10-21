import { useEffect, useMemo, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

/**
 * Nautical motion pieces. Keyframes live in styles/index.css ("Grand Line
 * motion") and all switch off under prefers-reduced-motion. Palette matches
 * the straw-hat SVGs in HeroAura / StrawHatLoader.
 */
const STRAW = '#f0d3a0';
const STRAW_DARK = '#8a6a34';
const BAND_RED = '#c0392b';

/** A repeating wave line. Width must stay a multiple of `period` for a seamless loop. */
function wavePath(width: number, period: number, amp: number, mid: number) {
  let d = `M0 ${mid} Q${period / 4} ${mid - amp} ${period / 2} ${mid}`;
  for (let x = period; x <= width; x += period / 2) d += ` T${x} ${mid}`;
  return d;
}

/** Generic two-sail boat with a red pennant. Drawn facing right. */
export function Sailboat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M15 4 L15 23" stroke={STRAW_DARK} strokeWidth="1.4" />
        <path d="M15 3 L20 5 L15 7 Z" fill={BAND_RED} />
        <path d="M16 7 C22 11 23 17 22 21 L16 21 Z" fill={STRAW} stroke={STRAW_DARK} strokeWidth="1" />
        <path d="M14 10 C10 13 9 17 10 20 L14 20 Z" fill={STRAW} stroke={STRAW_DARK} strokeWidth="1" opacity=".9" />
        <path d="M4 22 L28 22 C27 26 24 28 20 28 L11 28 C8 28 5 26 4 22 Z" fill={STRAW_DARK} stroke="#5e4622" strokeWidth="1" />
      </g>
    </svg>
  );
}

/** Horizontally drifting wave strip. Place inside a `relative overflow-hidden` box. */
export function WaveStrip({ className, speed = '4s', amp = 2.5, strokeWidth = 1.5, fill }: {
  className?: string; speed?: string; amp?: number; strokeWidth?: number; fill?: string;
}) {
  const d = wavePath(200, 20, amp, 6);
  return (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"
      className={cn('gl-wave-drift absolute left-0 w-[200%]', className)}
      style={{ ['--gl-speed' as string]: speed }}>
      {fill
        ? <path d={`${d} L200 12 L0 12 Z`} fill={fill} />
        : <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/**
 * Global loading indicator: a ship sails along a wave under the top bar while
 * data loads or saves. Delayed 300ms so quick requests don't flash it, and the
 * 60s notification poll is ignored so it doesn't sail by itself every minute.
 */
export function SailingProgress() {
  const fetching = useIsFetching({ predicate: (q) => q.queryKey[0] !== 'notifications' });
  const mutating = useIsMutating();
  const busy = fetching + mutating > 0;
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(busy), busy ? 300 : 250);
    return () => clearTimeout(t);
  }, [busy]);

  return (
    <div aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 h-6 overflow-hidden transition-opacity duration-300',
        show ? 'opacity-100' : 'opacity-0')}>
      {show && (
        <>
          <WaveStrip className="bottom-0 h-3 text-sky-500/60" speed="3s" />
          <div className="gl-sail absolute bottom-[3px]">
            <Sailboat className="gl-rock size-5" />
          </div>
        </>
      )}
    </div>
  );
}

/** One-shot burst of gold coins from the centre of its `relative` parent. */
export function TreasureBurst({ count = 22 }: { count?: number }) {
  const coins = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (-80 + Math.random() * 160) * (Math.PI / 180); // mostly upward fan
    const dist = 70 + Math.random() * 90;
    return {
      key: i,
      tx: `${Math.sin(angle) * dist}px`,
      ty: `${-Math.cos(angle) * dist}px`,
      rot: `${(Math.random() - 0.5) * 720}deg`,
      delay: `${Math.random() * 0.18}s`,
      dur: `${1.1 + Math.random() * 0.5}s`,
      size: 10 + Math.round(Math.random() * 7),
    };
  }), [count]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-0" aria-hidden="true">
      {coins.map((c) => (
        <span key={c.key} className="gl-coin absolute left-0 top-0"
          style={{ ['--tx' as string]: c.tx, ['--ty' as string]: c.ty, ['--rot' as string]: c.rot,
            ['--delay' as string]: c.delay, ['--dur' as string]: c.dur }}>
          <span className="gl-coin-flip block rounded-full"
            style={{
              width: c.size, height: c.size,
              background: 'radial-gradient(circle at 35% 30%, #fff3c4 0 18%, #f2c94c 35%, #c99a2e 75%, #8a6a34 100%)',
              boxShadow: 'inset 0 0 0 1.5px rgba(138,106,52,.65)',
              animationDelay: c.delay,
            }} />
        </span>
      ))}
    </div>
  );
}

/** Message in a bottle bobbing on a little sea — used by EmptyState. */
export function BottleAtSea({ className }: { className?: string }) {
  return (
    <div className={cn('relative h-14 w-24 overflow-hidden text-muted-foreground', className)} aria-hidden="true">
      {/* Centring lives on the wrapper: the bob animation owns the svg's transform. */}
      <div className="absolute left-1/2 top-0.5 -translate-x-1/2">
      <svg viewBox="-2 -2 54 36" className="gl-bob block h-10 w-16">
        <g transform="rotate(-12 26 16)" strokeLinejoin="round">
          <rect x="8" y="10" width="26" height="13" rx="5" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeOpacity=".7" strokeWidth="1.2" />
          <rect x="34" y="13" width="6" height="7" rx="1.5" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeOpacity=".7" strokeWidth="1.2" />
          <rect x="39.5" y="13.5" width="4" height="6" rx="1" fill={STRAW_DARK} />
          <rect x="13" y="13" width="15" height="7" rx="2.5" fill={STRAW} />
          <path d="M16 15.5 H25 M16 17.5 H23" stroke={STRAW_DARK} strokeWidth=".8" strokeLinecap="round" />
          <path d="M11 12.5 C14 11.5 18 11.5 21 12" stroke="#fff" strokeOpacity=".45" strokeWidth="1" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      </div>
      <WaveStrip className="bottom-2 h-3 text-sky-500/50" speed="5s" amp={2} />
      <WaveStrip className="bottom-0 h-3 text-sky-500/30" speed="7s" amp={1.5} />
    </div>
  );
}

/** Full-screen sea backdrop for the login page: stars (dark mode), a ship on the
 *  horizon, and three wave layers drifting at different speeds for depth. */
export function SeaScene() {
  const stars = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    key: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 55}%`,
    size: Math.random() < 0.2 ? 2 : 1,
    tw: `${2.5 + Math.random() * 3}s`,
    delay: `${-Math.random() * 5}s`,
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-sky-50 to-sky-100 dark:from-background dark:to-sky-950/50" aria-hidden="true">
      <div className="hidden dark:block">
        {stars.map((s) => (
          <span key={s.key} className="gl-twinkle absolute rounded-full bg-white"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size,
              ['--tw' as string]: s.tw, ['--delay' as string]: s.delay }} />
        ))}
      </div>
      {/* Back wave line sits at half its 18vh height; -6px seats the hull in it. */}
      <div className="absolute left-[64%] bottom-[calc(9vh-6px)]">
        <Sailboat className="gl-rock size-10 opacity-90" />
      </div>
      <WaveStrip className="bottom-0 h-[18vh]" speed="22s" amp={2.2} fill="rgba(14,165,233,.12)" />
      <WaveStrip className="bottom-0 h-[12vh]" speed="15s" amp={2.6} fill="rgba(14,165,233,.18)" />
      <WaveStrip className="bottom-0 h-[7vh]" speed="9s" amp={3} fill="rgba(14,165,233,.28)" />
    </div>
  );
}
