"use client";

import { ActiveBadge, ResourceManager } from "@/components/ResourceManager";
import { listAll } from "@/lib/api/catalog";
import { t } from "@/lib/i18n/fa";

type FAQCategory = { id: number; title: string };

const loadFaqCategories = async () =>
  (await listAll<FAQCategory>("admin/faq-categories")).map((category) => ({ value: category.id, label: category.title }));

export default function FaqsPage() {
  return (
    <>
      <h1>{t("nav.faqs")}</h1>
      <ResourceManager
        resource="admin/faqs"
        section="qa"
        permission="admin.faqs.manage"
        emptyForm={{ category: null, question: "", answer: "", is_active: true, sort_order: 0 }}
        fields={[
          { name: "category", label: "field.faq_category", kind: "select", loadOptions: loadFaqCategories },
          { name: "question", label: "field.question", kind: "text" },
          { name: "answer", label: "field.answer", kind: "textarea" },
          { name: "sort_order", label: "field.sort_order", kind: "number" },
          { name: "is_active", label: "field.is_active", kind: "checkbox" },
        ]}
        columns={[
          { label: "field.question", render: (row) => String(row.question) },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
      />
      <h2>{t("field.faq_category")}</h2>
      <ResourceManager
        resource="admin/faq-categories"
        permission="admin.faqs.manage"
        emptyForm={{ title: "", sort_order: 0, is_active: true }}
        fields={[
          { name: "title", label: "field.title", kind: "text" },
          { name: "sort_order", label: "field.sort_order", kind: "number" },
          { name: "is_active", label: "field.is_active", kind: "checkbox" },
        ]}
        columns={[
          { label: "field.title", render: (row) => String(row.title) },
          { label: "field.sort_order", render: (row) => String(row.sort_order) },
          { label: "field.is_active", render: (row) => <ActiveBadge active={row.is_active} /> },
        ]}
      />
    </>
  );
}
