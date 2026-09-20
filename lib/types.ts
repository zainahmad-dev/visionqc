// Core domain types — mirrors the data model in CLAUDE.md exactly.

export type Status =
  | "queued"
  | "scanning"
  | "analyzed"
  | "needs_manual_review"
  | "failed"
  | "completed";

export type Severity = "low" | "medium" | "critical";

export type Review = "pending" | "confirmed" | "edited" | "dismissed" | "reviewer_added";

export type BBox = { x: number; y: number; w: number; h: number }; // normalized 0..1

export type Defect = {
  id: string;
  ai_type: string | null; // immutable
  ai_severity: Severity | null; // immutable
  ai_confidence: number | null; // immutable, 0..1
  ai_bbox: BBox | null; // immutable
  review: Review;
  edited?: { type?: string; severity?: Severity; bbox?: BBox };
};

export type ErrorCode = "invalid_json" | "corrupt_image" | "timeout";
export type ResultMode = "auto" | "override_pass" | "override_fail";
export type Recommendation = "pass" | "fail";

export type Inspection = {
  id: string; // VQ-10443
  created_at: number;
  status: Status;
  category: string | null;
  category_confidence: number | null;
  ai_recommendation: Recommendation | null;
  raw_output: string | null; // exact model output, immutable
  error_code: ErrorCode | null;
  file_name: string;
  image_url: string;
  defects: Defect[];
  reviewer_category: string | null;
  result_mode: ResultMode;
  notes: string;
  reviewed_at: number | null;
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  critical: "Critical",
};

export const DEFECT_LABEL: Record<string, string> = {
  scratch: "Scratch",
  dent: "Dent",
  crack: "Crack",
  discoloration: "Discoloration",
  contamination: "Contamination",
  misalignment: "Misalignment",
  corrosion: "Corrosion",
  chip: "Chip",
  scuff: "Scuff",
  warp: "Warping",
};
