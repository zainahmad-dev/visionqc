"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

// A number that counts up on mount and re-counts from where it stands when the
// value changes (switching range, finalizing a record). The animated text is
// written straight to the DOM — no React state per frame — and hidden from
// assistive tech; a static copy carries the real value, so a screen reader never
// hears 40 intermediate numbers.
export default function CountUp({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const reduceMotion = useReducedMotion();

  const format = (n: number) =>
    `${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) =>
      `${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

    if (reduceMotion) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
  }, [value, decimals, suffix, reduceMotion]);

  return (
    <>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
