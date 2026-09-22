// Small, dependency-free helpers shared by the hand-built SVG charts.

// A "nice" step (1, 2, 5 × 10^k) so axis ticks land on round numbers.
function niceStep(rough: number): number {
  if (rough <= 1) return 1; // counts are whole numbers — never a fractional tick
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

// Y-axis for a non-negative count: `max` is the top tick, `ticks` includes 0.
export function countAxis(dataMax: number, targetTicks = 4): { max: number; ticks: number[] } {
  const step = niceStep(Math.max(dataMax, 1) / targetTicks);
  const max = step * Math.max(1, Math.ceil(Math.max(dataMax, 1) / step));
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
  return { max, ticks };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Every N-th index (always including the last) so labels never collide.
export function labelIndices(count: number, maxLabels: number): Set<number> {
  const keep = new Set<number>();
  if (count === 0) return keep;
  const every = Math.max(1, Math.ceil(count / Math.max(1, maxLabels)));
  // Anchor on the most recent point and walk back, so "today" is always labelled.
  for (let i = count - 1; i >= 0; i -= every) keep.add(i);
  return keep;
}

// One shared formatter per unit, so the chart, its tooltip and its table can
// never disagree about how a number is written.
export const fmtInt = (n: number): string => Math.round(n).toLocaleString();
export const fmtPct1 = (n: number): string => `${n.toFixed(1)}%`;
export const fmtPctOrDash = (n: number | null): string => (n === null ? "—" : fmtPct1(n));

// Top corners rounded, bottom square — for bars that sit on a baseline.
export function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x} ${y + h}`,
    `V${y + rr}`,
    `Q${x} ${y} ${x + rr} ${y}`,
    `H${x + w - rr}`,
    `Q${x + w} ${y} ${x + w} ${y + rr}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

// Locale-dependent — call client-side only (server and browser disagree, which
// would break hydration). The analytics page renders after mount for that reason.
export const fmtDay = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export const fmtDayLong = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export const fmtSpan = (start: number, end: number): string =>
  start === end ? fmtDayLong(start) : `${fmtDay(start)} – ${fmtDay(end)}`;
