"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { Messages } from "@/components/Messages";
import { Page } from "@/lib/api/client";
import { listAll } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import { listProducts, ProductFilters } from "@/lib/api/products";
import type { Category, Product } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";

export default function ProductsPage() {
  const can = useCan();
  const [filters, setFilters] = useState<ProductFilters>({});
  const [applied, setApplied] = useState<ProductFilters>({});
  const [page, setPage] = useState<Page<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setPage(await listProducts(applied));
  }, [applied]);

  useEffect(() => {
    load().catch((error) => setErrors(errorMessages(error)));
  }, [load]);

  useEffect(() => {
    listAll<Category>("categories").then(setCategories).catch((error) => setErrors(errorMessages(error)));
  }, []);

  const currentPage = Number(applied.page ?? 1);

  return (
    <>
      <Guide section="products" />
      <div className="spread">
        <h1>{t("nav.products")}</h1>
        {can("products.create") && (
          <Link href="/manage/products/new">
            <button className="primary">{t("product.new")}</button>
          </Link>
        )}
      </div>
      <Messages errors={errors} />
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...filters, page: undefined });
        }}
      >
        <input placeholder={t("common.search")} value={filters.search ?? ""} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select value={filters.category ?? ""} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}>
          <option value="">{t("field.category")}: {t("common.all")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={filters.is_published ?? ""}
          onChange={(e) => setFilters({ ...filters, is_published: e.target.value || undefined })}
        >
          <option value="">{t("field.status")}: {t("common.all")}</option>
          <option value="true">{t("product.published")}</option>
          <option value="false">{t("product.draft")}</option>
        </select>
        <label className="inline">
          <input
            type="checkbox"
            checked={filters.deleted === "true"}
            onChange={(e) => setFilters({ ...filters, deleted: e.target.checked ? "true" : undefined })}
          />
          {t("product.showDeleted")}
        </label>
        <button type="submit">{t("common.filter")}</button>
      </form>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("field.name")}</th>
              <th>{t("field.category")}</th>
              <th>{t("field.brand")}</th>
              <th>{t("product.variants")}</th>
              <th>{t("field.status")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  {t("common.empty")}
                </td>
              </tr>
            )}
            {page?.results.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/manage/products/${product.slug}`}>{product.name}</Link>
                </td>
                <td>{product.category_name}</td>
                <td>{product.brand_name ?? t("common.none")}</td>
                <td>{product.variants.length}</td>
                <td>
                  {product.deleted_at ? (
                    <span className="badge off">{t("product.deleted")}</span>
                  ) : (
                    <span className={`badge ${product.is_published ? "ok" : ""}`}>
                      {product.is_published ? t("product.published") : t("product.draft")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 8 }}>
          <button disabled={!page?.previous} onClick={() => setApplied({ ...applied, page: String(currentPage - 1) })}>
            {t("common.previous")}
          </button>
          <button disabled={!page?.next} onClick={() => setApplied({ ...applied, page: String(currentPage + 1) })}>
            {t("common.next")}
          </button>
        </div>
      </div>
    </>
  );
}
