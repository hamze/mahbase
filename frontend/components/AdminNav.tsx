"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MessageKey, t } from "@/lib/i18n/fa";

// 24x24 stroke icon paths.
const ICONS = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  categories: "M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4",
  tags: "M3 12V3h9l9 9-9 9-9-9zM7.5 7.5h.01",
  brands: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  attributes: "M4 6h16M4 12h16M4 18h10",
  units: "M3 17l6-12 6 12M5.5 12h7M17 7v10M15 9l2-2 2 2",
  products: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  stock: "M4 4h16v4H4zM4 10h16v10H4zM9 14h6",
  pricing: "M3 17l6-6 4 4 8-8M15 7h6v6",
} as const;

type Item = { href: string; label: MessageKey; icon: keyof typeof ICONS };

const GROUPS: { label?: MessageKey; items: Item[] }[] = [
  { items: [{ href: "/manage", label: "nav.dashboard", icon: "dashboard" }] },
  {
    label: "nav.groupCatalog",
    items: [
      { href: "/manage/categories", label: "nav.categories", icon: "categories" },
      { href: "/manage/tags", label: "nav.tags", icon: "tags" },
      { href: "/manage/brands", label: "nav.brands", icon: "brands" },
      { href: "/manage/attributes", label: "nav.attributes", icon: "attributes" },
      { href: "/manage/units", label: "nav.units", icon: "units" },
    ],
  },
  {
    label: "nav.groupProducts",
    items: [
      { href: "/manage/products", label: "nav.products", icon: "products" },
      { href: "/manage/stock", label: "nav.stock", icon: "stock" },
      { href: "/manage/pricing", label: "nav.pricing", icon: "pricing" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/manage" ? pathname === href : pathname.startsWith(href));
  return (
    <nav className="nav">
      {GROUPS.map((group, index) => (
        <div key={index} className="nav-group">
          {group.label && <div className="nav-group-label">{t(group.label)}</div>}
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? "active" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS[item.icon]} />
              </svg>
              {t(item.label)}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
