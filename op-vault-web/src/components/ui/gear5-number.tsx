import { useEffect, useRef, useState } from 'react';

// "Back" easing: the value blows past the target, then settles onto it.
// That overshoot is the whole point — a linear count-up looks like a loading bar.
function easeOutBack(t: number, overshoot = 1.35) {
  return 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Gear5Number({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const n = Number(value) || 0;
  const [display, setDisplay] = useState(() => (prefersReduced() ? n : 0));
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced()) {
      setDisplay(n);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      if (t < 1) {
        setDisplay(n * easeOutBack(t));
        frame.current = requestAnimationFrame(tick);
      } else {
        setDisplay(n); // land exactly on the real number, never an eased approximation
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [n, duration]);

  return <span className={className}>{format(Math.round(display))}</span>;
}