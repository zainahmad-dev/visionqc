import { CATEGORIES } from "./mock";
import { DEFECT_LABEL, type Defect, type ErrorCode, type Inspection, type Severity } from "./types";

export type ScanPhase = "ingesting" | "analyzing" | "validating";

export const PHASE_ORDER: ScanPhase[] = ["ingesting", "analyzing", "validating"];

export const PHASE_LABEL: Record<ScanPhase, string> = {
  ingesting: "Ingesting Image",
  analyzing: "Running Vision Vector Analysis",
  validating: "Validating Schema",
};

// Rough durations from the phase spec — ingesting ~1.3s, analyzing ~4.6s, validating ~1.5s.
export const PHASE_DURATION_MS: Record<ScanPhase, number> = {
  ingesting: 1300,
  analyzing: 4600,
  validating: 1500,
};

export const TOTAL_SCAN_MS = PHASE_ORDER.reduce((sum, p) => sum + PHASE_DURATION_MS[p], 0);

// Elapsed ms at which a completed phase's time contributes to overall progress.
export function phaseStartOffset(phase: ScanPhase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER.slice(0, idx).reduce((sum, p) => sum + PHASE_DURATION_MS[p], 0);
}

const SEVERITIES: Severity[] = ["low", "medium", "critical"];
const DEFECT_TYPES = Object.keys(DEFECT_LABEL);

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

let defectSeq = 0;
function nextDefectId(): string {
  defectSeq += 1;
  return `DF-live-${defectSeq}`;
}

// A plausible, freshly "analyzed" result — the AI proposal, immutable once produced.
export function generateAnalysis(): Partial<Inspection> {
  const category = pick(CATEGORIES);
  const defectCount = Math.floor(Math.random() * 4); // 0-3
  const defects: Defect[] = Array.from({ length: defectCount }, () => ({
    id: nextDefectId(),
    ai_type: pick(DEFECT_TYPES),
    ai_severity: pick(SEVERITIES),
    ai_confidence: round(0.5 + Math.random() * 0.48, 2),
    ai_bbox: {
      x: round(Math.random() * 0.7, 3),
      y: round(Math.random() * 0.7, 3),
      w: round(0.08 + Math.random() * 0.18, 3),
      h: round(0.08 + Math.random() * 0.18, 3),
    },
    review: "pending",
  }));

  return {
    category,
    category_confidence: round(0.7 + Math.random() * 0.29, 2),
    ai_recommendation: defects.length > 0 ? "fail" : "pass",
    raw_output: JSON.stringify(
      {
        category,
        defects: defects.map((d) => ({ type: d.ai_type, severity: d.ai_severity, confidence: d.ai_confidence })),
      },
      null,
      2
    ),
    error_code: null,
    defects,
  };
}

export const BROKEN_JSON_SAMPLE =
  '{"category": "Steel Fastener", "defects": [{"type": "dent", "severity": "medium", "confidence": 0.69}';

export const ERROR_REASON: Record<ErrorCode, string> = {
  invalid_json: "The model's output could not be parsed as valid JSON.",
  corrupt_image: "This image failed to decode — the file may be corrupted or unsupported.",
  timeout: "The scan timed out before it could finish.",
};

export function errorResult(errorCode: ErrorCode, rawOutput: string | null): Partial<Inspection> {
  return {
    error_code: errorCode,
    raw_output: rawOutput,
    category: null,
    category_confidence: null,
    ai_recommendation: null,
    defects: [],
  };
}

// Real decode check — lets a genuinely corrupt/non-image file fail on its own merits.
export function checkImageDecodes(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(
          () => resolve(true),
          () => resolve(false)
        );
      } else {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
