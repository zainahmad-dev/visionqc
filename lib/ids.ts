import type { Inspection } from "./types";

// New uploads continue the mock data's VQ-###### sequence so ids never collide.
const BASE_ID = 10402;

export function nextInspectionIds(existing: Inspection[], count: number): string[] {
  const nums = existing
    .map((i) => /^VQ-(\d+)$/.exec(i.id)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  let next = (nums.length > 0 ? Math.max(...nums) : BASE_ID) + 1;

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(`VQ-${next}`);
    next += 1;
  }
  return ids;
}
