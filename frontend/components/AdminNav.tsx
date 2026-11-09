"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCan } from "@/lib/auth/permissions";
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
  orders: "M6 2h12l2 4v15H4V6zM4 6h16M9 10h6",
  newOrder: "M6 2h12l2 4v15H4V6zM4 6h16M12 10v6M9 13h6",
  refunds: "M3 12a9 9 0 1 0 3-6.7M3 3v5h5",
  users: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  discounts: "M19 5L5 19M7.5 7.5h.01M16.5 16.5h.01",
  shipping: "M1 4h14v12H1zM15 9h4l3 3v4h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  faqs: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  audit: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  access: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  blog: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5",
  reviews: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  notifications: "M18 16V11a6 6 0 0 0-12 0v5l-2 2h16zM10 21h4",
  contact: "M3 5h18v14H3zM3 5l9 7 9-7",
  banners: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
  geo: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.5-1.5L16.7 4l-3-1-1 2h-1.4l-1-2-3 1 .2 2.7L6 8.2 4 8 3 11l2 1v1.4l-2 1 1 3 2-.2 1.5 1.5L7.3 20l3 1 1-2h1.4l1 2 3-1-.2-2.7 1.5-1.5 2 .2 1-3-2-1z",
} as const;

/** Menu manifest: each route declares the RBAC code that shows it (none = any staff user). Hiding is UX only;
 * Django re-checks the permission on every request. */
type Item = { href: string; label: MessageKey; icon: keyof typeof ICONS; permission?: string };

const GROUPS: { label?: MessageKey; items: Item[] }[] = [
  { items: [{ href: "/manage", label: "nav.dashboard", icon: "dashboard" }] },
  {
    label: "nav.groupAccess",
    items: [
      { href: "/manage/access/groups", label: "nav.accessGroups", icon: "access", permission: "access.view" },
      { href: "/manage/access/users", label: "nav.accessUsers", icon: "users", permission: "access.manage_users" },
    ],
  },
  {
    label: "nav.groupCatalog",
    items: [
      { href: "/manage/categories", label: "nav.categories", icon: "categories", permission: "categories.manage" },
      { href: "/manage/tags", label: "nav.tags", icon: "tags", permission: "tags.manage" },
      { href: "/manage/brands", label: "nav.brands", icon: "brands", permission: "brands.manage" },
      { href: "/manage/attributes", label: "nav.attributes", icon: "attributes", permission: "attributes.manage" },
      { href: "/manage/units", label: "nav.units", icon: "units", permission: "units.manage" },
    ],
  },
  {
    label: "nav.groupProducts",
    items: [
      { href: "/manage/products", label: "nav.products", icon: "products", permission: "products.view" },
      { href: "/manage/stock", label: "nav.stock", icon: "stock", permission: "products.edit_stock" },
      { href: "/manage/pricing", label: "nav.pricing", icon: "pricing", permission: "products.edit_price" },
    ],
  },
  {
    label: "nav.groupSales",
    items: [
      { href: "/manage/orders", label: "nav.orders", icon: "orders", permission: "admin.orders.view_all" },
      { href: "/manage/orders/new", label: "nav.newOrder", icon: "newOrder", permission: "admin.orders.create" },
      { href: "/manage/refunds", label: "nav.refunds", icon: "refunds", permission: "admin.orders.view_all" },
      { href: "/manage/returns", label: "nav.returns", icon: "refunds", permission: "admin.orders.view_all" },
      { href: "/manage/discounts", label: "nav.discounts", icon: "discounts", permission: "admin.discounts.manage" },
      { href: "/manage/shipping", label: "nav.shipping", icon: "shipping", permission: "admin.shipping.manage" },
      { href: "/manage/geo", label: "nav.geo", icon: "geo", permission: "geo.manage" },
    ],
  },
  {
    label: "nav.groupCustomers",
    items: [
      { href: "/manage/users", label: "nav.users", icon: "users", permission: "admin.users.view" },
      { href: "/manage/faqs", label: "nav.faqs", icon: "faqs", permission: "admin.faqs.manage" },
      { href: "/manage/questions", label: "nav.questions", icon: "faqs", permission: "admin.product_questions.answer" },
      { href: "/manage/reviews", label: "nav.reviews", icon: "reviews", permission: "reviews.view" },
      { href: "/manage/notifications", label: "nav.notifications", icon: "notifications", permission: "notifications.view" },
      { href: "/manage/contact-messages", label: "nav.contactMessages", icon: "contact", permission: "contact_messages.view" },
      { href: "/manage/audit", label: "nav.audit", icon: "audit", permission: "admin.audit.view" },
    ],
  },
  {
    label: "nav.groupContent",
    items: [
      { href: "/manage/blog/categories", label: "nav.blogCategories", icon: "blog", permission: "blog.manage_categories" },
      { href: "/manage/blog/posts", label: "nav.blogPosts", icon: "blog", permission: "blog.view" },
      { href: "/manage/banners", label: "nav.banners", icon: "banners", permission: "banners.view" },
      { href: "/manage/settings", label: "nav.settings", icon: "settings", permission: "settings.view" },
    ],
  },
];

/** Accordion: only one labelled group is open at a time, initially the one holding the current page. */
export function AdminNav() {
  const pathname = usePathname();
  const can = useCan();
  const matches = (href: string) => (href === "/manage" ? pathname === href : pathname.startsWith(href));
  // The most specific link wins, so /manage/orders/new does not also highlight /manage/orders.
  const activeHref = GROUPS.flatMap((group) => group.items.map((item) => item.href))
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const activeGroup = GROUPS.findIndex((group) => group.items.some((item) => item.href === activeHref));
  const [openGroup, setOpenGroup] = useState<number | null>(activeGroup);
  useEffect(() => {
    setOpenGroup(activeGroup);
  }, [activeGroup]);

  return (
    <nav className="nav">
      {GROUPS.map((group, index) => {
        const items = group.items.filter((item) => !item.permission || can(item.permission));
        if (items.length === 0) return null;
        const open = !group.label || openGroup === index;
        return (
          <div key={index} className="nav-group">
            {group.label && (
              <button
                type="button"
                className={`nav-group-label${open ? " open" : ""}`}
                aria-expanded={open}
                onClick={() => setOpenGroup(open ? null : index)}
              >
                {t(group.label)}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
            {open &&
              items.map((item) => (
                <Link key={item.href} href={item.href} className={item.href === activeHref ? "active" : undefined}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICONS[item.icon]} />
                  </svg>
                  {t(item.label)}
                </Link>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
