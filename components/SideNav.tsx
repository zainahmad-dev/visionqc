"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "@/lib/nav-items";

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] p-4 md:block">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="side-nav-indicator"
                  className="absolute inset-0 rounded-[var(--radius-control)] border border-[var(--color-border-strong)]"
                  style={{ background: "var(--color-surface-raised)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon size={17} strokeWidth={2} className="relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
