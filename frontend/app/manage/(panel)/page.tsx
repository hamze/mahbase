import Link from "next/link";

import { MessageKey, t } from "@/lib/i18n/fa";

const SECTIONS: [string, MessageKey, MessageKey][] = [
  ["/manage/products", "nav.products", "guide.products.description"],
  ["/manage/stock", "nav.stock", "guide.stock.description"],
  ["/manage/pricing", "nav.pricing", "guide.pricing.bulk.description"],
  ["/manage/categories", "nav.categories", "guide.categories.description"],
  ["/manage/tags", "nav.tags", "guide.tags.description"],
  ["/manage/brands", "nav.brands", "guide.brands.description"],
  ["/manage/attributes", "nav.attributes", "guide.attributes.description"],
  ["/manage/units", "nav.units", "guide.units.description"],
];

export default function DashboardPage() {
  return (
    <>
      <h1>{t("nav.dashboard")}</h1>
      <div className="tiles">
        {SECTIONS.map(([href, title, description]) => (
          <Link key={href} href={href} className="card tile">
            <strong>{t(title)}</strong>
            <p className="muted">{t(description)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
