// Data Access Layer for the `inspections` / `defects` tables — the only place
// in the app that talks to Postgres or Storage, and the only place that reads
// SUPABASE_SERVICE_ROLE_KEY. `import "server-only"` makes bundling this into a
// Client Component a build error rather than a leaked secret.
//
// Row <-> app-shape mapping lives here too: callers (lib/actions.ts) only ever
// see the same Inspection/Defect shapes as the rest of the app.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FinalizeInput, UpdateReviewInput } from "@/lib/schema";
import type { BBox, Defect, Inspection, Review, Severity, Status } from "@/lib/types";

const BUCKET = "inspection-images";

let cached: SupabaseClient | null = null;

// One client per server process — supabase-js is stateless per call, but
// there's no reason to re-parse the URL/key on every query.
function db(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)."
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export function publicImageUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Storage object keys can't contain "/" from user input (it would nest into a
// nonexistent sub-path) and are friendlier without spaces or unicode.
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "-");
  return cleaned.length > 0 ? cleaned : "image";
}

// ---------------------------------------------------------------------------
// Row shapes (snake_case, matching the SQL exactly) <-> app shapes
// ---------------------------------------------------------------------------

type InspectionRow = {
  id: string;
  created_at: string;
  status: string;
  category: string | null;
  category_confidence: number | null;
  ai_recommendation: string | null;
  raw_output: unknown;
  error_code: string | null;
  file_name: string | null;
  image_path: string | null;
  reviewer_category: string | null;
  result_mode: string;
  notes: string | null;
  reviewed_at: string | null;
};

type DefectRow = {
  id: string;
  inspection_id: string;
  ai_type: string | null;
  ai_severity: string | null;
  ai_confidence: number | null;
  ai_bbox: BBox | null;
  review: string;
  edited_type: string | null;
  edited_severity: string | null;
  edited_bbox: BBox | null;
};

function rowToDefect(row: DefectRow): Defect {
  const hasEdit = row.edited_type !== null || row.edited_severity !== null || row.edited_bbox !== null;
  return {
    id: row.id,
    ai_type: row.ai_type,
    ai_severity: row.ai_severity as Severity | null,
    ai_confidence: row.ai_confidence,
    ai_bbox: row.ai_bbox,
    review: row.review as Review,
    edited: hasEdit
      ? {
          ...(row.edited_type !== null && { type: row.edited_type }),
          ...(row.edited_severity !== null && { severity: row.edited_severity as Severity }),
          ...(row.edited_bbox !== null && { bbox: row.edited_bbox }),
        }
      : undefined,
  };
}

function rowToInspection(row: InspectionRow, defectRows: DefectRow[]): Inspection {
  return {
    id: row.id,
    created_at: new Date(row.created_at).getTime(),
    status: row.status as Status,
    category: row.category,
    category_confidence: row.category_confidence,
    ai_recommendation: row.ai_recommendation as Inspection["ai_recommendation"],
    // Stored as jsonb (an object); the app's raw_output is the exact string the
    // model produced, so round-trip it back to text.
    raw_output: row.raw_output === null ? null : JSON.stringify(row.raw_output),
    error_code: row.error_code as Inspection["error_code"],
    file_name: row.file_name ?? "",
    image_url: row.image_path ? publicImageUrl(row.image_path) : "",
    defects: defectRows.map(rowToDefect),
    reviewer_category: row.reviewer_category,
    result_mode: row.result_mode as Inspection["result_mode"],
    notes: row.notes ?? "",
    reviewed_at: row.reviewed_at === null ? null : new Date(row.reviewed_at).getTime(),
  };
}

async function defectsFor(client: SupabaseClient, inspectionIds: string[]): Promise<Map<string, DefectRow[]>> {
  const byInspection = new Map<string, DefectRow[]>();
  if (inspectionIds.length === 0) return byInspection;
  const { data, error } = await client.from("defects").select("*").in("inspection_id", inspectionIds);
  if (error) throw new Error(`Loading defects failed: ${error.message}`);
  for (const row of (data ?? []) as DefectRow[]) {
    const list = byInspection.get(row.inspection_id) ?? [];
    list.push(row);
    byInspection.set(row.inspection_id, list);
  }
  return byInspection;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchInspections(opts?: { status?: Status[]; limit?: number }): Promise<Inspection[]> {
  const client = db();
  let query = client
    .from("inspections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 500);
  if (opts?.status && opts.status.length > 0) query = query.in("status", opts.status);

  const { data, error } = await query;
  if (error) throw new Error(`Loading inspections failed: ${error.message}`);
  const rows = (data ?? []) as InspectionRow[];
  const defectsByInspection = await defectsFor(client, rows.map((r) => r.id));
  return rows.map((row) => rowToInspection(row, defectsByInspection.get(row.id) ?? []));
}

export async function fetchInspection(id: string): Promise<Inspection | null> {
  const client = db();
  const { data: row, error } = await client.from("inspections").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Loading inspection ${id} failed: ${error.message}`);
  if (!row) return null;
  const defectsByInspection = await defectsFor(client, [id]);
  return rowToInspection(row as InspectionRow, defectsByInspection.get(id) ?? []);
}

// ---------------------------------------------------------------------------
// Writes — only ever called once per record, from Finalize
// ---------------------------------------------------------------------------

export async function insertInspection(input: FinalizeInput, imageBytes: Uint8Array, contentType: string): Promise<Inspection> {
  const client = db();
  const path = `${input.id}/${sanitizeFileName(input.file_name)}`;

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, imageBytes, {
    contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(`Uploading the image failed: ${uploadError.message}`);

  const nowIso = new Date().toISOString();
  const inspectionRow = {
    id: input.id,
    created_at: new Date(input.created_at).toISOString(),
    status: "completed" as const, // the only status a save ever produces — Finalize means resolved
    category: input.category,
    category_confidence: input.category_confidence,
    ai_recommendation: input.ai_recommendation,
    raw_output: input.raw_output === null ? null : JSON.parse(input.raw_output),
    error_code: input.error_code,
    file_name: input.file_name,
    image_path: path,
    reviewer_category: input.reviewer_category,
    result_mode: input.result_mode,
    notes: input.notes,
    reviewed_at: nowIso, // server-authoritative save time, not whatever the client's clock said
  };

  const { error: insertError } = await client.from("inspections").insert(inspectionRow);
  if (insertError) {
    // Don't leave an orphaned file behind for a row that never landed.
    await client.storage.from(BUCKET).remove([path]);
    throw new Error(`Saving the inspection failed: ${insertError.message}`);
  }

  let defectRows: DefectRow[] = [];
  if (input.defects.length > 0) {
    // `id` is intentionally omitted: the app's local ids (e.g. "df-3f9a2b1c")
    // aren't valid uuids, so the database issues real ones (gen_random_uuid()),
    // returned below and used as this record's canonical defect ids from now on.
    const { data, error: defectsError } = await client
      .from("defects")
      .insert(
        input.defects.map((d) => ({
          inspection_id: input.id,
          ai_type: d.ai_type,
          ai_severity: d.ai_severity,
          ai_confidence: d.ai_confidence,
          ai_bbox: d.ai_bbox,
          review: d.review,
          edited_type: d.edited?.type ?? null,
          edited_severity: d.edited?.severity ?? null,
          edited_bbox: d.edited?.bbox ?? null,
        }))
      )
      .select("*");
    if (defectsError) {
      // The inspection row and image are already committed; leave them —
      // partial defect data still beats losing the whole record, and Rule 3
      // ("nothing is discarded") argues against rolling the save back.
      throw new Error(`Saving findings failed (the record itself was saved): ${defectsError.message}`);
    }
    defectRows = (data ?? []) as DefectRow[];
  }

  return rowToInspection({ ...inspectionRow, id: input.id } as InspectionRow, defectRows);
}

// A later, targeted correction to an already-saved record. Never touches
// ai_* columns — the trigger would refuse it even if this code tried.
export async function patchInspection(id: string, patch: UpdateReviewInput): Promise<Inspection | null> {
  const client = db();

  const inspectionPatch: Record<string, unknown> = {};
  if (patch.notes !== undefined) inspectionPatch.notes = patch.notes;
  if (patch.reviewer_category !== undefined) inspectionPatch.reviewer_category = patch.reviewer_category;
  if (patch.result_mode !== undefined) inspectionPatch.result_mode = patch.result_mode;

  if (Object.keys(inspectionPatch).length > 0) {
    const { error, count } = await client
      .from("inspections")
      .update(inspectionPatch, { count: "exact" })
      .eq("id", id);
    if (error) throw new Error(`Updating the inspection failed: ${error.message}`);
    if (count === 0) return null;
  } else {
    const existing = await fetchInspection(id);
    if (!existing) return null;
  }

  for (const d of patch.defects ?? []) {
    const { error } = await client
      .from("defects")
      .update({
        review: d.review,
        edited_type: d.edited?.type ?? null,
        edited_severity: d.edited?.severity ?? null,
        edited_bbox: d.edited?.bbox ?? null,
      })
      .eq("id", d.id)
      .eq("inspection_id", id);
    if (error) throw new Error(`Updating finding ${d.id} failed: ${error.message}`);
  }

  return fetchInspection(id);
}
