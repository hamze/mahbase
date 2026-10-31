"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { MultiSelect } from "@/components/MultiSelect";
import { RichTextEditor } from "@/components/RichTextEditor";
import { DEFAULT_ROWS, GeneratedVariant, VariantGenerator } from "@/components/VariantGenerator";
import { listAll } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import { uploadTemporaryImage } from "@/lib/api/media";
import { createProduct, updateProduct } from "@/lib/api/products";
import type { Attribute, Brand, Category, MediaAsset, MediaClaim, Product, ProductInput, Tag, Unit } from "@/lib/api/types";
import { useCan } from "@/lib/auth/permissions";
import { MessageKey, t } from "@/lib/i18n/fa";

type BaseForm = Omit<ProductInput, "category" | "unit" | "attribute_values" | "variants" | "media"> & {
  category: number | null;
  unit: number | null;
};

type PendingMedia = MediaClaim & { url: string };

const GALLERY_TYPES: MediaClaim["image_type"][] = ["main", "thumbnail", "gallery"];

function initialForm(product?: Product): BaseForm {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    category: product?.category ?? null,
    brand: product?.brand ?? null,
    unit: product?.unit ?? null,
    description_short: product?.description_short ?? "",
    description_long: product?.description_long ?? "",
    tags: product?.tags ?? [],
  };
}

/** Category-driven product form: create (with generated variants) or edit base info, attributes and media. */
export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const can = useCan();
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [form, setForm] = useState<BaseForm>(() => initialForm(product));
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries((product?.attribute_values ?? []).map((item) => [item.attribute, item.value])),
  );
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [removedMedia, setRemovedMedia] = useState<number[]>([]);
  const [uploadType, setUploadType] = useState<MediaClaim["image_type"]>("gallery");
  const [descriptionImages, setDescriptionImages] = useState<MediaAsset[]>([]);
  const [rows, setRows] = useState<GeneratedVariant[]>(DEFAULT_ROWS);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);

  const canSave = product ? can("products.edit") : can("products.create");

  useEffect(() => {
    Promise.all([listAll<Category>("categories"), listAll<Unit>("units")])
      .then(([categoryList, unitList]) => {
        setCategories(categoryList);
        setUnits(unitList);
      })
      .catch((error) => setErrors(errorMessages(error)));
  }, []);

  useEffect(() => {
    if (!form.category) return;
    Promise.all([
      listAll<Brand>("brands", form.category),
      listAll<Tag>("tags", form.category),
      listAll<Attribute>("attributes", form.category),
    ])
      .then(([brandList, tagList, attributeList]) => {
        setBrands(brandList);
        setTags(tagList);
        setAttributes(attributeList);
        // Drop selections that do not belong to the newly selected category.
        setForm((current) => ({
          ...current,
          brand: brandList.some((brand) => brand.id === current.brand) ? current.brand : null,
          tags: current.tags.filter((id) => tagList.some((tag) => tag.id === id)),
        }));
        setRows(DEFAULT_ROWS);
      })
      .catch((error) => setErrors(errorMessages(error)));
  }, [form.category]);

  const set = <K extends keyof BaseForm>(name: K, value: BaseForm[K]) => setForm((current) => ({ ...current, [name]: value }));
  // Inactive entries remain visible only where they are already assigned.
  const selectable = <T extends { id: number; is_active: boolean }>(items: T[], assigned: number[]) =>
    items.filter((item) => item.is_active || assigned.includes(item.id));
  const descriptive = attributes.filter((attribute) => !attribute.is_variant_generator);
  const generators = attributes.filter((attribute) => attribute.is_variant_generator && attribute.is_active);
  // Uploads run in parallel; successful ones are kept in the chosen order, failures are reported together.
  const uploadGalleryImages = async (files: File[]) => {
    setUploading(files.length);
    const results = await Promise.allSettled(files.map((file) => uploadTemporaryImage(file, form.name)));
    setUploading(0);
    const uploaded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    setMedia((current) => [...current, ...uploaded.map((asset) => ({ id: asset.id, image_type: uploadType, url: asset.url }))]);
    setErrors(results.flatMap((result) => (result.status === "rejected" ? errorMessages(result.reason) : [])));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.category || !form.unit) {
      setErrors([t("product.selectCategoryFirst")]);
      return;
    }
    const payload: ProductInput = {
      ...form,
      category: form.category,
      unit: form.unit,
      attribute_values: descriptive
        .filter((attribute) => values[attribute.id]?.trim())
        .map((attribute) => ({ attribute: attribute.id, value: values[attribute.id] })),
      media: [
        ...media.map(({ id, image_type }) => ({ id, image_type })),
        // Only images still present in the description are claimed; removed ones expire as temporary uploads.
        ...descriptionImages
          .filter((asset) => form.description_long.includes(asset.url))
          .map((asset) => ({ id: asset.id, image_type: "description" as const })),
      ],
    };
    setSaving(true);
    setErrors([]);
    try {
      if (product) {
        const saved = await updateProduct(product.id, { ...payload, remove_media: removedMedia });
        setMedia([]);
        setRemovedMedia([]);
        setDescriptionImages([]);
        setNotice(t("common.saved"));
        if (saved.slug !== product.slug) router.replace(`/manage/products/${saved.slug}`);
        router.refresh();
      } else {
        payload.variants = rows.filter((row) => row.enabled).map(({ enabled: _enabled, label: _label, ...variant }) => variant);
        const saved = await createProduct(payload);
        router.push(`/manage/products/${saved.slug}`);
      }
    } catch (error) {
      setErrors(errorMessages(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Guide section="products" />
      <div className="card">
        <h3 className="card-title">{t("guide.products.title")}</h3>
        <div className="form-grid">
          <label>
            <FieldLabel field="category">{t("field.category")}</FieldLabel>
            <select
              required
              value={form.category ?? ""}
              onChange={(e) => set("category", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("common.none")}</option>
              {selectable(categories, product ? [product.category] : []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parent ? `${categories.find((c) => c.id === category.parent)?.name} › ` : ""}
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel field="name">{t("field.name")}</FieldLabel>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            <FieldLabel field="slug">{t("field.slug")}</FieldLabel>
            <input required dir="ltr" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </label>
          <label>
            <FieldLabel field="unit">{t("field.unit")}</FieldLabel>
            <select required value={form.unit ?? ""} onChange={(e) => set("unit", e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t("common.none")}</option>
              {selectable(units, product ? [product.unit] : []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.symbol})
                </option>
              ))}
            </select>
          </label>
          {form.category && brands.length > 0 && (
            <label>
              <FieldLabel field="brand">{t("field.brand")}</FieldLabel>
              <select value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t("common.none")}</option>
                {selectable(brands, product?.brand ? [product.brand] : []).map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.category && tags.length > 0 && (
            <div className="field">
              <FieldLabel field="tags">{t("field.tags")}</FieldLabel>
              <MultiSelect
                options={selectable(tags, product?.tags ?? []).map((tag) => ({ value: tag.id, label: tag.name }))}
                value={form.tags}
                onChange={(ids) => set("tags", ids)}
              />
            </div>
          )}
        </div>
        <label style={{ marginTop: 16 }}>
          <FieldLabel field="description_short">{t("field.description_short")}</FieldLabel>
          <textarea value={form.description_short} onChange={(e) => set("description_short", e.target.value)} />
        </label>
        <div className="field" style={{ marginTop: 16 }}>
          <span className="field-label">{t("field.description_long")}</span>
          <RichTextEditor
            value={form.description_long}
            onChange={(html) => set("description_long", html)}
            onImageUploaded={(asset) => setDescriptionImages((current) => [...current, asset])}
            onError={(error) => setErrors(errorMessages(error))}
          />
        </div>
      </div>

      {form.category && descriptive.length > 0 && (
        <div className="card">
          <h3 className="card-title">{t("product.attributes")}</h3>
          <div className="form-grid">
            {descriptive.map((attribute) => (
              <label key={attribute.id}>
                {attribute.name}
                {attribute.type === "select" ? (
                  <select
                    value={values[attribute.id] ?? ""}
                    onChange={(e) => setValues((current) => ({ ...current, [attribute.id]: e.target.value }))}
                  >
                    <option value="">{t("common.none")}</option>
                    {attribute.options
                      .filter((option) => option.is_active || option.value === values[attribute.id])
                      .map((option) => (
                        <option key={option.id} value={option.value}>
                          {option.value}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    inputMode={attribute.type === "number" ? "decimal" : undefined}
                    value={values[attribute.id] ?? ""}
                    onChange={(e) => setValues((current) => ({ ...current, [attribute.id]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      <Guide section="media" />
      <div className="card">
        <h3 className="card-title">{t("product.media")}</h3>
        <div className="thumbs">
          {[...(product?.media ?? []).filter((asset) => !removedMedia.includes(asset.id)), ...media].map((asset) => (
            <figure key={asset.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt="" />
              <figcaption className="muted">{t(`imageType.${asset.image_type}` as MessageKey)}</figcaption>
              {/* Description images are kept or dropped through the description text, not here. */}
              {can("media.manage") && asset.image_type !== "description" && (
                <button
                  type="button"
                  className="danger small"
                  onClick={() =>
                    media.some((item) => item.id === asset.id)
                      ? setMedia((current) => current.filter((item) => item.id !== asset.id))
                      : setRemovedMedia((current) => [...current, asset.id])
                  }
                >
                  {t("common.delete")}
                </button>
              )}
            </figure>
          ))}
        </div>
        {can("media.manage") && (
          <div className="row" style={{ marginTop: 12 }}>
            <select value={uploadType} onChange={(e) => setUploadType(e.target.value as MediaClaim["image_type"])}>
              {GALLERY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`imageType.${type}` as MessageKey)}
                </option>
              ))}
            </select>
            <label className="file-button">
              {t("common.uploadMany")}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading > 0}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) uploadGalleryImages(files);
                  e.target.value = "";
                }}
              />
            </label>
            {uploading > 0 && <span className="muted">{t("common.uploading", { count: uploading })}</span>}
          </div>
        )}
      </div>

      {!product && form.category && (
        <>
          <Guide section="variants" />
          {can("products.edit_price") && <Guide section="pricing" />}
          <VariantGenerator key={form.category} attributes={generators} rows={rows} onRowsChange={setRows} />
        </>
      )}

      <Messages errors={errors} notice={notice} />
      {canSave && (
        <div className="form-actions">
          <button className="primary" type="submit" disabled={saving || uploading > 0}>
            {t("common.save")}
          </button>
        </div>
      )}
    </form>
  );
}
