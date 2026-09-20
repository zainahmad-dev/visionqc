import { DEFECT_LABEL, type BBox, type Defect, type ErrorCode, type Inspection, type Review, type Severity } from "./types";

// Deterministic PRNG (mulberry32) so mock data is stable across reloads.
function mulberry32(seed: number) {
  let state = seed;
  return function rng(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20240512;

const CATEGORIES = [
  "Aluminum Bracket",
  "PCB Assembly",
  "Plastic Housing",
  "Glass Panel",
  "Rubber Seal",
  "Weld Joint",
  "Steel Fastener",
  "Painted Panel",
];

const DEFECT_TYPES = Object.keys(DEFECT_LABEL);
const SEVERITIES: Severity[] = ["low", "medium", "critical"];
const THRESHOLD = 0.75;

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function rngInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function buildMockInspections(): Inspection[] {
  const rng = mulberry32(SEED);
  const now = Date.now();
  let idNum = 10403;
  let defectNum = 0;

  function nextId(): string {
    const id = `VQ-${idNum}`;
    idNum += 1;
    return id;
  }

  function nextDefectId(): string {
    defectNum += 1;
    return `DF-${defectNum}`;
  }

  function makeBBox(): BBox {
    return {
      x: round(rng() * 0.7, 3),
      y: round(rng() * 0.7, 3),
      w: round(0.08 + rng() * 0.18, 3),
      h: round(0.08 + rng() * 0.18, 3),
    };
  }

  // Confidences straddle the 75% threshold. A defect below threshold could
  // never have reached "completed" status while still pending (it would
  // have blocked Finalize), so low-confidence defects are always resolved;
  // high-confidence ones are usually left pending (silently accepted).
  function makeDefect(forcedConfidence?: number): Defect {
    const confidence = forcedConfidence ?? round(0.5 + rng() * 0.48, 2);
    const belowThreshold = confidence < THRESHOLD;

    let review: Review;
    if (belowThreshold) {
      review = pick(rng, ["confirmed", "edited", "dismissed"] as Review[]);
    } else {
      review = rng() < 0.65 ? "pending" : pick(rng, ["confirmed", "edited"] as Review[]);
    }

    const defect: Defect = {
      id: nextDefectId(),
      ai_type: pick(rng, DEFECT_TYPES),
      ai_severity: pick(rng, SEVERITIES),
      ai_confidence: confidence,
      ai_bbox: makeBBox(),
      review,
    };

    if (review === "edited") {
      defect.edited = { severity: pick(rng, SEVERITIES) };
    }

    return defect;
  }

  function makeCompleted(forcedConfidences?: number[]): Inspection {
    const id = nextId();
    const category = pick(rng, CATEGORIES);
    const defectCount = forcedConfidences ? forcedConfidences.length : rngInt(rng, 0, 3);
    const defects: Defect[] = [];
    for (let i = 0; i < defectCount; i++) {
      defects.push(makeDefect(forcedConfidences?.[i]));
    }

    const hasActiveFinding = defects.some((d) => d.review !== "dismissed");
    const createdAt = now - rngInt(rng, 30, 4000) * 60_000;

    return {
      id,
      created_at: createdAt,
      status: "completed",
      category,
      category_confidence: round(0.7 + rng() * 0.29, 2),
      ai_recommendation: hasActiveFinding ? "fail" : "pass",
      raw_output: JSON.stringify({
        category,
        defects: defects.map((d) => ({
          type: d.ai_type,
          severity: d.ai_severity,
          confidence: d.ai_confidence,
        })),
      }),
      error_code: null,
      file_name: `cam${rngInt(rng, 1, 4)}_${id.toLowerCase()}.jpg`,
      image_url: `/mock/${id.toLowerCase()}.jpg`,
      defects,
      reviewer_category: category,
      result_mode: "auto",
      notes: "",
      reviewed_at: createdAt + rngInt(rng, 2, 40) * 60_000,
    };
  }

  function makeErrorInspection(
    status: "needs_manual_review" | "failed",
    errorCode: ErrorCode
  ): Inspection {
    const id = nextId();
    const createdAt = now - rngInt(rng, 5, 200) * 60_000;
    const rawOutput =
      errorCode === "invalid_json"
        ? '{"category": "PCB Assembly", "defects": [{"type": "scratch", "severity": "low", "confidence": 0.81}'
        : null;

    return {
      id,
      created_at: createdAt,
      status,
      category: null,
      category_confidence: null,
      ai_recommendation: null,
      raw_output: rawOutput,
      error_code: errorCode,
      file_name: `cam${rngInt(rng, 1, 4)}_${id.toLowerCase()}.jpg`,
      image_url: `/mock/${id.toLowerCase()}.jpg`,
      defects: [],
      reviewer_category: null,
      result_mode: "auto",
      notes: "",
      reviewed_at: null,
    };
  }

  const inspections: Inspection[] = [];

  for (let i = 0; i < 14; i++) {
    if (i === 0) inspections.push(makeCompleted([0.62])); // guaranteed below threshold
    else if (i === 1) inspections.push(makeCompleted([0.88])); // guaranteed above threshold
    else inspections.push(makeCompleted());
  }

  inspections.push(makeErrorInspection("needs_manual_review", "invalid_json"));
  inspections.push(makeErrorInspection("needs_manual_review", "corrupt_image"));
  inspections.push(makeErrorInspection("failed", "timeout"));
  inspections.push(makeCompleted());

  return inspections;
}
