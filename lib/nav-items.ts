import type { LucideIcon } from "lucide-react";
import { Radar, ClipboardCheck, ScrollText, BarChart3 } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/hub", label: "Live Hub", icon: Radar },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];
