"use client";

import Link from "next/link";

import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";

const SECTIONS: [string, MessageKey, MessageKey, string][] = [
  ["/manage/orders", "nav.orders", "guide.orders.description", "admin.orders.view_all"],
  ["/manage/users", "nav.users", "guide.users.description", "admin.users.view"],
  ["/manage/products", "nav.products", "guide.products.description", "products.view"],
  ["/manage/stock", "nav.stock", "guide.stock.description", "products.edit_stock"],
  ["/manage/pricing", "nav.pricing", "guide.pricing.bulk.description", "products.edit_price"],
  ["/manage/categories", "nav.categories", "guide.categories.description", "categories.manage"],
  ["/manage/tags", "nav.tags", "guide.tags.description", "tags.manage"],
  ["/manage/brands", "nav.brands", "guide.brands.description", "brands.manage"],
  ["/manage/attributes", "nav.attributes", "guide.attributes.description", "attributes.manage"],
  ["/manage/units", "nav.units", "guide.units.description", "units.manage"],
  ["/manage/blog/posts", "nav.blogPosts", "guide.blog.description", "blog.view"],
  ["/manage/reviews", "nav.reviews", "guide.reviews.description", "reviews.view"],
  ["/manage/settings", "nav.settings", "guide.settings.description", "settings.view"],
  ["/manage/access/groups", "nav.accessGroups", "guide.access.groups.description", "access.view"],
  ["/manage/access/users", "nav.accessUsers", "guide.access.users.description", "access.manage_users"],
];

/** Tiles for the sections the user may open; a user without any (no group) sees the "no access" notice. */
export default function DashboardPage() {
  const can = useCan();
  const sections = SECTIONS.filter(([, , , permission]) => can(permission));
  return (
    <>
      <h1>{t("nav.dashboard")}</h1>
      {sections.length === 0 && <p className="card muted">{t("access.noAccess")}</p>}
      <div className="tiles">
        {sections.map(([href, title, description]) => (
          <Link key={href} href={href} className="card tile">
            <strong>{t(title)}</strong>
            <p className="muted">{t(description)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
