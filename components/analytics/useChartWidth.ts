"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// The rendered width of a wrapper, in whole pixels — SVGs are drawn at exactly
// this size (no viewBox scaling), so hover coordinates map 1:1 onto the data and
// text stays the same size at every width. 0 until the first measurement.
export function useChartWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el); // fires once straight away with the initial size
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
