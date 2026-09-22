// POST /api/analyze — server-side only. The browser never talks to Ollama
// directly; it talks to this route, which reads the uploaded image, calls the
// local model, and validates what comes back. Streams newline-delimited JSON
// so the existing 3-stage stepper (lib/scan.ts) reflects real progress instead
// of a fake timer.
import { CorruptImageError, OllamaTimeoutError, callOllama, decodeImage, validateAnalysis } from "@/lib/ollama";
import type { ErrorCode, Inspection } from "@/lib/types";

export const runtime = "nodejs"; // sharp's native bindings aren't Edge-compatible

type StreamEvent =
  | { type: "phase"; phase: "ingesting" | "analyzing" | "validating" }
  | { type: "done"; result: Partial<Inspection> };

function errorResult(error_code: ErrorCode, raw_output: string | null): Partial<Inspection> {
  return { error_code, raw_output, category: null, category_confidence: null, ai_recommendation: null, defects: [] };
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The client (a superseded scan, a closed tab, React Strict Mode's
      // dev-only double-invoke) can disconnect at any point; enqueueing to a
      // controller whose reader is gone throws, and there's nothing useful to
      // do about it beyond not letting that crash the rest of the handler.
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };

      try {
        const formData = await request.formData();
        const image = formData.get("image");
        if (!(image instanceof File)) {
          send({ type: "done", result: errorResult("corrupt_image", null) });
          return;
        }

        send({ type: "phase", phase: "ingesting" });
        const bytes = Buffer.from(await image.arrayBuffer());
        let decoded;
        try {
          decoded = await decodeImage(bytes);
        } catch (err) {
          if (err instanceof CorruptImageError) {
            send({ type: "done", result: errorResult("corrupt_image", null) });
            return;
          }
          throw err;
        }

        send({ type: "phase", phase: "analyzing" });
        let rawText: string;
        try {
          rawText = await callOllama(decoded, request.signal);
        } catch (err) {
          if (err instanceof OllamaTimeoutError) {
            send({ type: "done", result: errorResult("timeout", null) });
            return;
          }
          throw err;
        }

        send({ type: "phase", phase: "validating" });
        const validated = validateAnalysis(rawText, decoded);
        send({
          type: "done",
          result: validated.ok ? validated.result : errorResult("invalid_json", validated.raw_output),
        });
      } catch (err) {
        // Anything unanticipated (a bug here, formData parsing blowing up on a
        // malformed request, ...) still ends the stream with a result the
        // client can act on, never a raw 500 the UI has no path for.
        console.error("POST /api/analyze failed:", err);
        send({ type: "done", result: errorResult("timeout", null) });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Already closed by the client disconnecting — nothing to do.
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
