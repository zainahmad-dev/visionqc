// Sample history for the analytics charts — clearly mock data.
//
// The store holds only the 18 seed inspections (plus whatever gets scanned this
// session), far too little to draw a 90-day trend. This generates a plausible,
// seeded archive of past outcomes to sit alongside them. Phase 10 replaces it
// with real rows; nothing else in the app depends on it.

import type { AFinding, ARecord } from "./analytics";
import { mulberry32 } from "./mock";
import { DEFECT_LABEL } from "./types";

const HISTORY_DAYS = 190; // > 2 × 90, so the previous-period comparison has data
const SEED = 8_128_2024;

// Relative frequency of each defect type, drifting slowly so the ranking and
// its shares actually differ between the 7, 30 and 90 day views.
const BASE_WEIGHT: Record<string, number> = {
  scratch: 22,
  dent: 16,
  discoloration: 12,
  crack: 9,
  contamination: 10,
  misalignment: 8,
  corrosion: 7,
  chip: 6,
  scuff: 6,
  warp: 4,
};

function weightsFor(daysAgo: number): [string, number][] {
  const drift: Record<string, number> = {
    scratch: 1 + 0.35 * Math.cos(daysAgo / 30),
    corrosion: 1 + 0.7 * Math.sin(daysAgo / 40),
    contamination: 1 + 0.5 * Math.sin(daysAgo / 25 + 1),
    crack: 1 + 0.4 * Math.cos(daysAgo / 19 + 2),
  };
  return Object.keys(DEFECT_LABEL).map((k) => [k, BASE_WEIGHT[k] * (drift[k] ?? 1)]);
}

function pickWeighted(rng: () => number, entries: [string, number][]): string {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Never returns a record later than `now`. Today's tail grows as the day goes on;
// everything before today is identical on every call.
export function buildHistory(now: number): ARecord[] {
  const rng = mulberry32(SEED);
  const out: ARecord[] = [];
  const today = new Date(now);
  let seq = 0;

  for (let daysAgo = 0; daysAgo < HISTORY_DAYS; daysAgo++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    const dow = day.getDay(); // 0 = Sunday
    const weekdayLoad = dow === 0 ? 0.25 : dow === 6 ? 0.5 : 1;
    const volume = Math.round(
      (13 + 2.5 * Math.cos(daysAgo / 22) + (rng() - 0.5) * 6) * weekdayLoad * (1 + 0.25 * (1 - daysAgo / HISTORY_DAYS))
    );

    // The pass rate wanders and improves a little toward the present.
    const passP = Math.min(
      0.95,
      Math.max(0.5, 0.71 + 0.07 * Math.sin(daysAgo / 17) + 0.05 * (1 - daysAgo / HISTORY_DAYS) + (rng() - 0.5) * 0.08)
    );
    const weights = weightsFor(daysAgo);

    for (let n = 0; n < volume; n++) {
      // Working hours, 07:00–18:59.
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7 + Math.floor(rng() * 12), Math.floor(rng() * 60)).getTime();

      const isPass = rng() < passP;
      const findings: AFinding[] = [];

      if (!isPass) {
        const r = rng();
        const kept = r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
        for (let k = 0; k < kept; k++) {
          findings.push({
            type: pickWeighted(rng, weights),
            // Triangular around ~76%, so roughly half sit below a 75% threshold.
            confidence: round2(0.52 + 0.47 * ((rng() + rng()) / 2)),
            dismissed: false,
          });
        }
      }
      // False positives the reviewer dismissed — they still carry a confidence.
      if (rng() < (isPass ? 0.22 : 0.15)) {
        findings.push({
          type: pickWeighted(rng, weights),
          confidence: round2(0.55 + 0.33 * rng()),
          dismissed: true,
        });
      }

      seq += 1;
      const record: ARecord = {
        id: `H-${String(seq).padStart(5, "0")}`,
        at,
        result: isPass ? "pass" : "fail",
        confidence: round2(0.7 + 0.29 * rng()),
        findings,
      };
      // Decided only AFTER every random draw for this record, so the stream — and
      // therefore all 190 days of history — is identical whatever the time of day.
      // (Skipping earlier would shift every later record on each visit.)
      if (at <= now - 60_000) out.push(record);
    }
  }
  return out;
}
