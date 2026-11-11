"use client";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import { listCities } from "@/lib/api/commerce";
import { t } from "@/lib/i18n/fa";
import { formatNumber } from "@/lib/pricing";

const loadCities = async () =>
  (await listCities()).map((city) => ({ value: city.id, label: `${city.province_name} › ${city.name}` }));

export default function ShippingPage() {
  return (
    <>
      <h1>{t("nav.shipping")}</h1>
      <ResourceManager
        resource="admin/shipping-methods"
        section="shipping"
        permission="admin.shipping.manage"
        emptyForm={{ name: "", description: "", price: 0, applies_to_all_cities: true, is_active: true, sort_order: 0, cities: [] }}
        fields={[
          { name: "name", label: "field.name", kind: "text" },
          { name: "price", label: "field.price", kind: "number" },
          { name: "sort_order", label: "field.sort_order", kind: "number" },
          { name: "description", label: "field.description", kind: "textarea" },
          { name: "cities", label: "field.cities", kind: "multi", loadOptions: loadCities },
          { name: "applies_to_all_cities", label: "field.applies_to_all_cities", kind: "checkbox" },
          { name: "is_active", label: "field.is_active", kind: "checkbox" },
        ]}
        columns={[
          { label: "field.name", render: (row) => String(row.name) },
          { label: "field.price", render: (row) => formatNumber(String(row.price)) },
          {
            label: "field.cities",
            render: (row) =>
              row.applies_to_all_cities ? <span className="badge">{t("field.applies_to_all_cities")}</span> : (row.cities as number[]).length,
          },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
      />
    </>
  );
}
