"use client";

import { ActiveBadge, categoryList, ResourceManager } from "@/components/ResourceManager";
import { uploadTemporaryImage } from "@/lib/api/media";

export default function BrandsPage() {
  return (
    <ResourceManager
      resource="brands"
      section="brands"
      permission="brands.manage"
      showExample
      emptyForm={{ name: "", slug: "", logo: null, is_active: true, categories: [] }}
      fields={[
        { name: "name", label: "field.name", kind: "text" },
        { name: "slug", label: "field.slug", kind: "text" },
        {
          name: "categories",
          label: "field.categories",
          kind: "categories",
          help: "brand_categories",
          placeholder: "common.allCategories",
        },
        { name: "logo", label: "field.logo", kind: "image" },
        { name: "is_active", label: "field.is_active", kind: "checkbox" },
      ]}
      columns={[
        // eslint-disable-next-line @next/next/no-img-element
        { label: "field.logo", render: (row) => (row.logo_url ? <img src={String(row.logo_url)} alt="" width={40} /> : null) },
        { label: "field.name", render: (row) => String(row.name) },
        { label: "field.slug", render: (row) => <span dir="ltr">{String(row.slug)}</span> },
        { label: "field.categories", render: (row, lookup) => categoryList(row.categories as number[], lookup) },
        { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
      ]}
      beforeSave={async (form, files) => {
        // The new logo is uploaded as TEMPORARY and claimed by the brand when it is saved.
        if (!files.logo) return form;
        const asset = await uploadTemporaryImage(files.logo, String(form.name ?? ""));
        return { ...form, logo: asset.id };
      }}
    />
  );
}
