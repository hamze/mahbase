"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Messages } from "@/components/Messages";
import { ProductForm } from "@/components/ProductForm";
import { VariantsPanel } from "@/components/VariantsPanel";
import { listAll } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import { deleteProduct, restoreProduct, togglePublish } from "@/lib/api/products";
import type { Attribute, Product } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n/fa";

export function ProductEditor({ product }: { product: Product }) {
  const router = useRouter();
  const can = useCan();
  const [generators, setGenerators] = useState<Attribute[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    listAll<Attribute>("attributes", product.category)
      .then((attributes) => setGenerators(attributes.filter((attribute) => attribute.is_variant_generator)))
      .catch((error) => setErrors(errorMessages(error)));
  }, [product.category]);

  const run = async (action: () => Promise<unknown>) => {
    setErrors([]);
    try {
      await action();
      router.refresh();
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  return (
    <>
      <div className="spread">
        <h1>{t("product.edit")}: {product.name}</h1>
        <div className="row">
          {product.deleted_at ? (
            <span className="badge off">{t("product.deleted")}</span>
          ) : (
            <span className={`badge ${product.is_published ? "ok" : ""}`}>
              {product.is_published ? t("product.published") : t("product.draft")}
            </span>
          )}
          {can("products.publish") && (
            <button onClick={() => run(() => togglePublish(product.id))}>
              {product.is_published ? t("product.unpublish") : t("product.publish")}
            </button>
          )}
          {can("products.delete") &&
            (product.deleted_at ? (
              <button onClick={() => run(() => restoreProduct(product.id))}>{t("product.restore")}</button>
            ) : (
              <button className="danger" onClick={() => run(() => deleteProduct(product.id))}>
                {t("common.delete")}
              </button>
            ))}
        </div>
      </div>
      <Messages errors={errors} />
      <ProductForm key={product.updated_at} product={product} />
      <VariantsPanel key={`variants-${product.updated_at}-${product.variants.map((v) => `${v.id}:${v.combination_hash}:${v.stock_quantity}`).join()}`} product={product} generators={generators} />
    </>
  );
}
