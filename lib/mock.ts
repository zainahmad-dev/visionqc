// The product-category list offered wherever a reviewer or the (still-mocked)
// vision model picks one — Hub's mock analysis, the reviewer-category select,
// and the Logs category filter. Seeded demo *inspections* used to live here
// too; since Phase 10, the store's initial data comes from Supabase instead
// (see lib/data/inspections.ts), so that generator was removed.

export const CATEGORIES = [
  "Aluminum Bracket",
  "PCB Assembly",
  "Plastic Housing",
  "Glass Panel",
  "Rubber Seal",
  "Weld Joint",
  "Steel Fastener",
  "Painted Panel",
];
