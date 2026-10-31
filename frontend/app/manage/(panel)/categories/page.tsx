"use client";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import { uploadCategoryIcon } from "@/lib/api/media";

export default function CategoriesPage() {
  return (
    <ResourceManager
      resource="categories"
      section="categories"
      permission="categories.manage"
      showExample
      emptyForm={{ name: "", slug: "", parent: null, is_active: true, sort_order: 0, seo_title: "", seo_description: "" }}
      fields={[
        { name: "name", label: "field.name", kind: "text" },
        { name: "slug", label: "field.slug", kind: "text" },
        { name: "parent", label: "field.parent", kind: "parentCategory" },
        { name: "sort_order", label: "field.sort_order", kind: "number" },
        { name: "seo_title", label: "field.seo_title", kind: "text" },
        { name: "seo_description", label: "field.seo_description", kind: "textarea" },
        { name: "icon", label: "field.icon", kind: "image" },
        { name: "is_active", label: "field.is_active", kind: "checkbox" },
      ]}
      columns={[
        { label: "field.name", render: (row) => String(row.name) },
        { label: "field.slug", render: (row) => <span dir="ltr">{String(row.slug)}</span> },
        { label: "field.parent", render: (row, lookup) => lookup(row.parent as number | null) },
        // eslint-disable-next-line @next/next/no-img-element
        { label: "field.icon", render: (row) => (row.icon_url ? <img src={String(row.icon_url)} alt="" width={32} /> : null) },
        { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
      ]}
      afterSave={async (saved, files) => {
        if (files.icon) await uploadCategoryIcon(saved.id, files.icon);
      }}
    />
  );
}
