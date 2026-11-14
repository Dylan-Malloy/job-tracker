"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Analytics", tip: "Your application history: counts, funnel, timing and trends" },
  { href: "/admin/ai", label: "AI spend", tip: "Claude tokens and estimated cost, by day, feature and user" },
  { href: "/admin/helpers", label: "Helpers", tip: "People with access to your hub and what they've done" },
  { href: "/admin/users", label: "Users", tip: "Every account on the site: add, edit, suspend or delete" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-2 border-b border-border pb-3">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} data-tip={t.tip}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-primary/20 text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function RangeTabs({ base, current, options }: { base: string; current: string; options: { key: string; label: string }[] }) {
  return (
    <div className="flex gap-1 text-sm" role="group" aria-label="Time range">
      {options.map((o) => (
        <Link key={o.key} href={`${base}?range=${o.key}`} aria-current={current === o.key ? "true" : undefined}
          className={`rounded-md px-2.5 py-1 ${current === o.key ? "bg-surface-2 text-accent" : "text-muted hover:text-text"}`}>{o.label}</Link>
      ))}
    </div>
  );
}
