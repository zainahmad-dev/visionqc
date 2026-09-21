"use client";

const SIZE = 92;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A single-value meter: gradient fill on the accent ramp, unfilled track a
// step lighter (the border color) — no series/legend needed for one value.
export default function ConfidenceGauge({ confidence }: { confidence: number }) {
  const pct = Math.max(0, Math.min(1, confidence));
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Overall AI confidence ${Math.round(pct * 100)}%`}
    >
      <defs>
        <linearGradient id="confidence-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent-cyan)" />
          <stop offset="100%" stopColor="var(--color-accent-indigo)" />
        </linearGradient>
      </defs>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={STROKE}
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="url(#confidence-gauge-gradient)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={{ transition: "stroke-dashoffset 300ms ease" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-[var(--color-text-primary)]"
        style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-ui)" }}
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
