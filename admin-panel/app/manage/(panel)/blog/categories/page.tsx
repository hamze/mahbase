"use client";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import { listBlogCategories } from "@/lib/api/blog";
import { t } from "@/lib/i18n/fa";

const loadParents = async () =>
  (await listBlogCategories())
    .filter((category) => category.parent === null && !category.is_internal)
    .map((category) => ({ value: category.id, label: category.name }));

export default function BlogCategoriesPage() {
  return (
    <>
      <h1>{t("nav.blogCategories")}</h1>
      <ResourceManager
        resource="admin/blog/categories"
        section="blog"
        permission="blog.manage_categories"
        emptyForm={{
          name: "",
          slug: "",
          parent: null,
          description_short: "",
          is_active: true,
          sort_order: 0,
          seo_title: "",
          seo_description: "",
          canonical_url: null,
        }}
        fields={[
          { name: "name", label: "field.name", kind: "text" },
          { name: "slug", label: "field.slug", kind: "text" },
          { name: "parent", label: "field.parent", kind: "select", loadOptions: loadParents },
          { name: "description_short", label: "field.description_short", kind: "textarea" },
          { name: "sort_order", label: "field.sort_order", kind: "number" },
          { name: "seo_title", label: "field.seo_title", kind: "text" },
          { name: "seo_description", label: "field.seo_description", kind: "textarea" },
          { name: "canonical_url", label: "field.canonical_url", kind: "text" },
          { name: "is_active", label: "field.is_active", kind: "checkbox" },
        ]}
        columns={[
          {
            label: "field.name",
            render: (row) => (
              <div className="row">
                {String(row.name)}
                {Boolean(row.is_internal) && <span className="badge">{t("blog.internal")}</span>}
              </div>
            ),
          },
          { label: "field.slug", render: (row) => <span dir="ltr">{String(row.slug)}</span> },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
      />
    </>
  );
}
