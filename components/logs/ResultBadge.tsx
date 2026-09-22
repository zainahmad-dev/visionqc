import { CheckCircle2, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import type { ResultBucket } from "@/lib/logs";
import { RESULT_LABEL } from "@/lib/logs";

// Status = colour + icon + text, never colour alone.
export const RESULT_META: Record<ResultBucket, { color: string; icon: LucideIcon }> = {
  pass: { color: "var(--color-pass)", icon: CheckCircle2 },
  fail: { color: "var(--color-fail)", icon: XCircle },
  review: { color: "var(--color-review)", icon: TriangleAlert },
};

export default function ResultBadge({
  result,
  size = "sm",
}: {
  result: ResultBucket;
  size?: "sm" | "lg";
}) {
  const { color, icon: Icon } = RESULT_META[result];
  const large = size === "lg";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${
        large ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      }`}
      style={{ borderColor: color, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Icon size={large ? 16 : 12} strokeWidth={2.5} aria-hidden="true" />
      {RESULT_LABEL[result]}
    </span>
  );
}
