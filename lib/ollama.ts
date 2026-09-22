// The only code in the app that talks to Ollama — imported solely by
// app/api/analyze/route.ts (a Route Handler, always server-side). "server-only"
// makes that a build error rather than a leaked host/model if anything ever
// tried to import this from a Client Component.
import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { DEFECT_LABEL } from "@/lib/types";
import type { BBox, Defect, Inspection, Severity } from "@/lib/types";

const DEFECT_TYPES = Object.keys(DEFECT_LABEL) as [string, ...string[]];
const SEVERITIES = ["low", "medium", "critical"] as const;

// Never NEXT_PUBLIC_ — read only here, never sent to the client.
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "moondream";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);

const PROMPT = `You are an industrial quality-control vision inspector. Examine this product photo for visible manufacturing defects.

Identify the product category, and list every defect you can see. For each one give:
- type: one of ${DEFECT_TYPES.join(", ")}
- severity: low, medium, or critical
- confidence: how sure you are, from 0 to 1
- bbox: a bounding box around the defect, normalized to 0..1 of the image width/height (x,y = top-left corner, w,h = width/height as a fraction of the image)

If the part looks defect-free, return an empty defects array. Respond with JSON only, matching the given schema.`;

// Passed as Ollama's `format` — constrained decoding, far more reliable than
// asking for "json" in the prompt and hoping.
const RESPONSE_FORMAT = {
  type: "object",
  properties: {
    category: { type: "string" },
    category_confidence: { type: "number" },
    defects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: DEFECT_TYPES },
          severity: { type: "string", enum: SEVERITIES },
          confidence: { type: "number" },
          bbox: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
            required: ["x", "y", "w", "h"],
          },
        },
        required: ["type", "severity", "confidence", "bbox"],
      },
    },
  },
  required: ["category", "category_confidence", "defects"],
};

// Mirrors RESPONSE_FORMAT — this is what actually gates "did the model's
// output parse", which is rule 3 made real. A grammar-constrained model can
// still emit a value outside expectations in ways JSON Schema's `enum` alone
// doesn't strictly forbid at the sampler level for every backend, so this is
// checked independently rather than trusted just because `format` was passed.
const BBoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const AnalysisSchema = z.object({
  category: z.string().min(1),
  category_confidence: z.number().min(0).max(1),
  defects: z.array(
    z.object({
      type: z.enum(DEFECT_TYPES),
      severity: z.enum(SEVERITIES),
      confidence: z.number().min(0).max(1),
      bbox: BBoxSchema,
    })
  ),
});

export class CorruptImageError extends Error {}
export class OllamaTimeoutError extends Error {}

export type Decoded = { bytes: Buffer; width: number; height: number };

// "ingesting" — a real decode (not just a header sniff), which is also how a
// genuinely corrupt/unsupported file is told apart from a fine one, and where
// the real pixel dimensions come from for the bbox conversion below.
export async function decodeImage(bytes: Buffer): Promise<Decoded> {
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
    return { bytes, width: meta.width, height: meta.height };
  } catch (err) {
    throw new CorruptImageError(err instanceof Error ? err.message : "decode failed");
  }
}

// "analyzing" — the model call. Ollama's own JSON-mode guarantees syntactic
// validity, not that the model behaved; a killed server, a cold-start that
// outruns TIMEOUT_MS, or Ollama not running at all are all unremarkable
// failures here, not crashes — the caller maps every one of them to the same
// "timeout" outcome (CLAUDE.md rule 3).
export async function callOllama(decoded: Decoded, clientSignal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // If the browser gave up (StrictMode's dev-only double-invoke, a closed tab,
  // a superseded scan), stop paying for a model call nobody will read the
  // result of.
  const onClientAbort = () => controller.abort();
  clientSignal?.addEventListener("abort", onClientAbort);
  try {
    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: PROMPT,
        images: [decoded.bytes.toString("base64")],
        format: RESPONSE_FORMAT,
        stream: false,
        keep_alive: "10m", // avoid paying the model-load cost between every scan
        options: { temperature: 0.2 }, // favor consistent structured extraction over variety
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new OllamaTimeoutError(`Ollama responded ${res.status}`);
    const data = (await res.json()) as { response?: string };
    if (typeof data.response !== "string") throw new OllamaTimeoutError("Ollama returned no response text");
    return data.response;
  } catch (err) {
    if (err instanceof OllamaTimeoutError) throw err;
    // AbortError (our own timeout) and connection failures (Ollama not
    // running, or killed mid-request) land here — both are "timeout" to the
    // reviewer; the raw cause still goes to the server console for debugging.
    console.error("Ollama request failed:", err);
    throw new OllamaTimeoutError(err instanceof Error ? err.message : "request failed");
  } finally {
    clearTimeout(timer);
    clientSignal?.removeEventListener("abort", onClientAbort);
  }
}

let liveDefectSeq = 0;
function nextDefectId(): string {
  liveDefectSeq += 1;
  return `DF-live-${liveDefectSeq}`;
}

// A value > 1 can't be a normalized fraction — treat the whole box as pixels
// and divide through by the real image dimensions decoded above.
function normalizeBBox(bbox: BBox, width: number, height: number): BBox {
  const looksLikePixels = bbox.x > 1 || bbox.y > 1 || bbox.w > 1 || bbox.h > 1;
  const box = looksLikePixels ? { x: bbox.x / width, y: bbox.y / height, w: bbox.w / width, h: bbox.h / height } : bbox;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return { x: clamp(box.x), y: clamp(box.y), w: clamp(Math.min(box.w, 1 - box.x)), h: clamp(Math.min(box.h, 1 - box.y)) };
}

// "validating" — parse, then validate against the same shape RESPONSE_FORMAT
// described. Either outcome keeps the model's exact text as raw_output,
// verbatim: that's the "exact model output, immutable" CLAUDE.md promises,
// so it's never reformatted even when it parses cleanly.
export function validateAnalysis(
  rawText: string,
  decoded: Decoded
): { ok: true; result: Partial<Inspection> } | { ok: false; raw_output: string } {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, raw_output: rawText };
  }

  const parsed = AnalysisSchema.safeParse(json);
  if (!parsed.success) return { ok: false, raw_output: rawText };

  const defects: Defect[] = parsed.data.defects.map((d) => ({
    id: nextDefectId(),
    ai_type: d.type,
    ai_severity: d.severity as Severity,
    ai_confidence: d.confidence,
    ai_bbox: normalizeBBox(d.bbox, decoded.width, decoded.height),
    review: "pending",
  }));

  return {
    ok: true,
    result: {
      category: parsed.data.category,
      category_confidence: parsed.data.category_confidence,
      ai_recommendation: defects.length > 0 ? "fail" : "pass",
      raw_output: rawText,
      error_code: null,
      defects,
    },
  };
}
