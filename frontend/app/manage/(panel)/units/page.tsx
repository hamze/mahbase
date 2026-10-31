"use client";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";

export default function UnitsPage() {
  return (
    <ResourceManager
      resource="units"
      section="units"
      permission="units.manage"
      emptyForm={{ name: "", symbol: "", is_active: true }}
      fields={[
        { name: "name", label: "field.name", kind: "text" },
        { name: "symbol", label: "field.symbol", kind: "text" },
        { name: "is_active", label: "field.is_active", kind: "checkbox" },
      ]}
      columns={[
        { label: "field.name", render: (row) => String(row.name) },
        { label: "field.symbol", render: (row) => String(row.symbol) },
        { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
      ]}
    />
  );
}
