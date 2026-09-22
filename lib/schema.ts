// Zod mirror of lib/types.ts — the one source of truth for what crosses the
// client -> server boundary. A Server Action is a public POST endpoint (see
// lib/actions.ts); this is what turns its `unknown` input back into something
// typed, rather than trusting whatever shape the caller happened to send.
//
// Keep this in step with lib/types.ts by hand — TypeScript won't catch drift
// between the two, since z.infer produces its own independent type.

import { z } from "zod";

export const BBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const SeveritySchema = z.enum(["low", "medium", "critical"]);
export const ReviewSchema = z.enum(["pending", "confirmed", "edited", "dismissed", "reviewer_added"]);
export const StatusSchema = z.enum([
  "queued",
  "scanning",
  "analyzed",
  "needs_manual_review",
  "failed",
  "completed",
]);
export const ErrorCodeSchema = z.enum(["invalid_json", "corrupt_image", "timeout"]);
export const ResultModeSchema = z.enum(["auto", "override_pass", "override_fail"]);
export const RecommendationSchema = z.enum(["pass", "fail"]);

export const DefectSchema = z.object({
  id: z.string().min(1),
  ai_type: z.string().nullable(),
  ai_severity: SeveritySchema.nullable(),
  ai_confidence: z.number().min(0).max(1).nullable(),
  ai_bbox: BBoxSchema.nullable(),
  review: ReviewSchema,
  edited: z
    .object({
      type: z.string().optional(),
      severity: SeveritySchema.optional(),
      bbox: BBoxSchema.optional(),
    })
    .optional(),
});

export const InspectionSchema = z.object({
  id: z.string().min(1),
  created_at: z.number(),
  status: StatusSchema,
  category: z.string().nullable(),
  category_confidence: z.number().min(0).max(1).nullable(),
  ai_recommendation: RecommendationSchema.nullable(),
  raw_output: z.string().nullable(),
  error_code: ErrorCodeSchema.nullable(),
  file_name: z.string().min(1),
  image_url: z.string(), // ignored by saveInspection — the real bytes travel as a separate File
  defects: z.array(DefectSchema),
  reviewer_category: z.string().nullable(),
  result_mode: ResultModeSchema,
  notes: z.string(),
  reviewed_at: z.number().nullable(),
});

// What Finalize may submit: any status a reviewer can act on from the Review
// screen. The saved row always ends up "completed" regardless — that
// transition is the server's decision (lib/data/inspections.ts), not the
// client's, so a tampered "status" in the payload can't change what gets
// written.
export const FinalizeInputSchema = InspectionSchema.extend({
  status: z.enum(["analyzed", "needs_manual_review", "failed"]),
});
export type FinalizeInput = z.infer<typeof FinalizeInputSchema>;

// A later, targeted correction to an already-saved record (see updateReview
// in lib/actions.ts) — never the ai_* fields, which the defects_reject_ai_
// column_update trigger also refuses at the database level.
export const UpdateReviewSchema = z.object({
  notes: z.string().optional(),
  reviewer_category: z.string().nullable().optional(),
  result_mode: ResultModeSchema.optional(),
  defects: z
    .array(
      z.object({
        id: z.string().min(1),
        review: ReviewSchema,
        edited: z
          .object({
            type: z.string().optional(),
            severity: SeveritySchema.optional(),
            bbox: BBoxSchema.optional(),
          })
          .optional(),
      })
    )
    .optional(),
});
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
