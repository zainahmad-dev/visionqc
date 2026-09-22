import type { ErrorCode, Inspection } from "./types";

export type ScanPhase = "ingesting" | "analyzing" | "validating";

export const PHASE_ORDER: ScanPhase[] = ["ingesting", "analyzing", "validating"];

export const PHASE_LABEL: Record<ScanPhase, string> = {
  ingesting: "Ingesting Image",
  analyzing: "Running Vision Vector Analysis",
  validating: "Validating Schema",
};

export const ERROR_REASON: Record<ErrorCode, string> = {
  invalid_json: "The model's output could not be parsed as valid JSON.",
  corrupt_image: "This image failed to decode — the file may be corrupted or unsupported.",
  timeout: "The scan timed out before it could finish — Ollama may be slow, unreachable, or not running.",
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

// A canned "the model returned invalid JSON" result for the Hub's dev-only
// "Simulate invalid JSON" toggle — lets the Needs Manual Review path be
// demonstrated without needing Ollama running, or waiting on a real (slow,
// CPU-bound) inference call. Real invalid-JSON handling is exercised by
// app/api/analyze/route.ts against whatever the model actually returns.
export const BROKEN_JSON_SAMPLE =
  '{"category": "Steel Fastener", "defects": [{"type": "dent", "severity": "medium", "confidence": 0.69}';
