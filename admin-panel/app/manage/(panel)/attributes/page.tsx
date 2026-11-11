"use client";

import { OptionsEditor } from "@/components/OptionsEditor";
import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import type { Attribute } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";

export default function AttributesPage() {
  const can = useCan();
  return (
    <ResourceManager
      resource="attributes"
      section="attributes"
      permission="attributes.manage"
      emptyForm={{ name: "", type: "select", is_filterable: false, is_variant_generator: false, is_active: true, categories: [] }}
      fields={[
        { name: "name", label: "field.name", kind: "text" },
        {
          name: "type",
          label: "field.type",
          kind: "choice",
          choices: [
            { value: "select", label: "attributeType.select" },
            { value: "text", label: "attributeType.text" },
            { value: "number", label: "attributeType.number" },
          ],
        },
        { name: "categories", label: "field.categories", kind: "categories" },
        { name: "is_filterable", label: "field.is_filterable", kind: "checkbox" },
        { name: "is_variant_generator", label: "field.is_variant_generator", kind: "checkbox" },
        { name: "is_active", label: "field.is_active", kind: "checkbox" },
      ]}
      columns={[
        { label: "field.name", render: (row) => String(row.name) },
        { label: "field.type", render: (row) => t(`attributeType.${row.type}` as MessageKey) },
        { label: "field.categories", render: (row, lookup) => (row.categories as number[]).map(lookup).join("، ") },
        { label: "field.is_variant_generator", render: (row) => <ActiveBadge active={row.is_variant_generator} /> },
        { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
      ]}
      rowExtra={(row, reload) =>
        row.type === "select" && can("attributes.manage") ? (
          <OptionsEditor attribute={row as unknown as Attribute} onChange={reload} />
        ) : null
      }
    />
  );
}
