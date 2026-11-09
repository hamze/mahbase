"use client";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import { Label } from "@/components/Label";
import { uploadTemporaryImage } from "@/lib/api/media";
import { t } from "@/lib/i18n/fa";

const POSITIONS = ["TOP_HEADER", "HERO", "SIDEBAR"] as const;

export default function BannersPage() {
  return (
    <>
      <h1>{t("nav.banners")}</h1>
      <ResourceManager
        resource="admin/banners"
        section="banners"
        permission="banners.manage"
        emptyForm={{ title: "", image: null, link_url: "", position: "HERO", start_at: null, end_at: null, is_active: true, sort_order: 0 }}
        fields={[
          { name: "title", label: "field.title", kind: "text" },
          { name: "image", label: "field.image", kind: "image" },
          { name: "link_url", label: "field.link_url", kind: "text" },
          {
            name: "position",
            label: "field.position",
            kind: "choice",
            choices: POSITIONS.map((position) => ({ value: position, label: `bannerPosition.${position}` as const })),
          },
          { name: "start_at", label: "field.start_at", kind: "datetime" },
          { name: "end_at", label: "field.end_at", kind: "datetime" },
          { name: "sort_order", label: "field.sort_order", kind: "number" },
          { name: "is_active", label: "field.is_active", kind: "checkbox" },
        ]}
        columns={[
          // eslint-disable-next-line @next/next/no-img-element
          { label: "field.image", render: (row) => <img src={String(row.image_url)} alt="" width={80} /> },
          { label: "field.title", render: (row) => String(row.title) },
          { label: "field.position", render: (row) => <Label prefix="bannerPosition" value={String(row.position)} /> },
          {
            label: "field.start_at",
            render: (row) => (row.start_at ? new Date(String(row.start_at)).toLocaleString("fa-IR") : t("common.none")),
          },
          {
            label: "field.end_at",
            render: (row) => (row.end_at ? new Date(String(row.end_at)).toLocaleString("fa-IR") : t("common.none")),
          },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
        beforeSave={async (form, files) => {
          // A new image is uploaded as TEMPORARY and claimed by the banner when it is saved.
          if (!files.image) return form;
          const asset = await uploadTemporaryImage(files.image, String(form.title ?? ""));
          return { ...form, image: asset.id };
        }}
      />
    </>
  );
}
