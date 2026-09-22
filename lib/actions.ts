"use server";

// The server actions named in phases/phase10.md. Kept thin: parse and
// authorize the untrusted input, delegate the actual query/mutation to the
// Data Access Layer (lib/data/inspections.ts), and shape what goes back to
// the client. See that file for anything involving Postgres or Storage
// directly, and lib/schema.ts for what "valid input" means.

import { revalidatePath } from "next/cache";
import { fetchInspection, fetchInspections, insertInspection, patchInspection } from "@/lib/data/inspections";
import { finalizeBlockers } from "@/lib/rules";
import { FinalizeInputSchema, UpdateReviewSchema } from "@/lib/schema";
import type { Inspection, Status } from "@/lib/types";

export type ActionResult<T> = { ok: true; inspection: T } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected server error.";
}

// Bytes actually written to Storage. Comfortably under the 10MB the bucket
// and next.config.ts's serverActions.bodySizeLimit both allow, leaving room
// for multipart overhead and a clearer error than a raw size-limit rejection.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function listInspections(filters?: { status?: Status[]; limit?: number }): Promise<Inspection[]> {
  return fetchInspections(filters);
}

export async function getInspection(id: string): Promise<Inspection | null> {
  if (typeof id !== "string" || id.trim().length === 0) return null;
  return fetchInspection(id);
}

// The only path anything ever reaches the database: Finalize, and only
// Finalize. `formData` carries the reviewed record as JSON (validated below),
// the reviewer's current confidence threshold (the rule that decides whether
// a finding may be silently accepted — the database has no column for it, so
// it must travel with the save to be checked here), and the real image bytes
// (a blob: URL only exists in the browser tab that created it, so the actual
// File has to make the trip, not its URL).
export async function saveInspection(formData: FormData): Promise<ActionResult<Inspection>> {
  try {
    const image = formData.get("image");
    const raw = formData.get("inspection");
    const thresholdRaw = formData.get("threshold");

    if (!(image instanceof File)) return { ok: false, error: "Missing image file." };
    if (typeof raw !== "string") return { ok: false, error: "Missing inspection data." };
    const threshold = Number(thresholdRaw);
    if (!Number.isFinite(threshold)) return { ok: false, error: "Missing confidence threshold." };

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Malformed inspection data." };
    }
    const parsed = FinalizeInputSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, error: `Invalid inspection: ${parsed.error.issues[0]?.message ?? "unknown shape"}` };
    }
    const input = parsed.data;

    // The same rule the Finalize button enforces client-side (CLAUDE.md rule
    // 2 and the reviewer-note-on-override rule) — checked again here because
    // a Server Action is a public endpoint, reachable by more than the button
    // that happens to render it disabled.
    const blockers = finalizeBlockers(input, threshold);
    if (blockers.length > 0) return { ok: false, error: blockers.join(" ") };

    if (image.size === 0) return { ok: false, error: "The image file is empty." };
    if (image.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: `Image is too large (max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB).` };
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    const saved = await insertInspection(input, bytes, image.type || "application/octet-stream");

    revalidatePath("/logs");
    revalidatePath("/analytics");
    return { ok: true, inspection: saved };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// A later, targeted correction to an already-saved record (notes, category,
// override, or a defect's review/edited_* fields). No screen calls this yet —
// the Logs drawer is read-only — but it's here per spec, and it goes through
// the same DAL path (and the same ai_*-immutability trigger) as saveInspection.
export async function updateReview(id: string, patch: unknown): Promise<ActionResult<Inspection>> {
  try {
    if (typeof id !== "string" || id.trim().length === 0) return { ok: false, error: "Missing record id." };
    const parsed = UpdateReviewSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: `Invalid update: ${parsed.error.issues[0]?.message ?? "unknown shape"}` };
    }
    const updated = await patchInspection(id, parsed.data);
    if (!updated) return { ok: false, error: `${id} was not found.` };

    revalidatePath("/logs");
    revalidatePath("/analytics");
    return { ok: true, inspection: updated };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
