"use client";

import { ActiveBadge, categoryList, ResourceManager } from "@/components/ResourceManager";

export default function TagsPage() {
  return (
    <ResourceManager
      resource="tags"
      section="tags"
      permission="tags.manage"
      showExample
      emptyForm={{ name: "", slug: "", is_featured: false, is_active: true, categories: [] }}
      fields={[
        { name: "name", label: "field.name", kind: "text" },
        { name: "slug", label: "field.slug", kind: "text" },
        {
          name: "categories",
          label: "field.categories",
          kind: "categories",
          help: "tag_categories",
          placeholder: "common.allCategories",
        },
        { name: "is_featured", label: "field.is_featured", kind: "checkbox" },
        { name: "is_active", label: "field.is_active", kind: "checkbox" },
      ]}
      columns={[
        { label: "field.name", render: (row) => String(row.name) },
        { label: "field.slug", render: (row) => <span dir="ltr">{String(row.slug)}</span> },
        { label: "field.categories", render: (row, lookup) => categoryList(row.categories as number[], lookup) },
        { label: "field.is_featured", render: (row) => <ActiveBadge active={row.is_featured} /> },
        { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
      ]}
    />
  );
}
