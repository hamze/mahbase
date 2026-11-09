"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Guide } from "@/components/Guide";
import { FieldLabel } from "@/components/InfoTip";
import { Messages } from "@/components/Messages";
import { MultiSelect } from "@/components/MultiSelect";
import { RichTextEditor } from "@/components/RichTextEditor";
import { listBlogCategories, saveBlogPost } from "@/lib/api/blog";
import { listAll } from "@/lib/api/catalog";
import { errorMessages } from "@/lib/api/errors";
import { uploadTemporaryImage } from "@/lib/api/media";
import type { BlogCategory, BlogPost, BlogPostWrite, Tag } from "@/lib/api/types";
import { t } from "@/lib/i18n/fa";

type TextField = "title" | "slug" | "excerpt" | "seo_title" | "seo_description" | "canonical_url";

const EMPTY: BlogPostWrite = {
  title: "",
  slug: "",
  category: 0,
  excerpt: "",
  content: "",
  cover_image: null,
  content_images: [],
  seo_title: "",
  seo_description: "",
  canonical_url: null,
  tags: [],
};

/** Create/edit a blog post or internal page. Django sanitizes the HTML and claims the cover and editor images. */
export function BlogPostForm({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const [form, setForm] = useState<BlogPostWrite>(post ? { ...post, content_images: [] } : EMPTY);
  // Editor images (existing and newly uploaded); only those still in the content are kept on save.
  const [images, setImages] = useState<{ id: number; url: string }[]>(post?.content_images ?? []);
  const [coverFile, setCoverFile] = useState<File>();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    Promise.all([listBlogCategories(), listAll<Tag>("tags")])
      .then(([loadedCategories, loadedTags]) => {
        setCategories(loadedCategories);
        setTags(loadedTags);
      })
      .catch((error) => setErrors(errorMessages(error)));
  }, []);

  const set = <K extends keyof BlogPostWrite>(name: K, value: BlogPostWrite[K]) => setForm((current) => ({ ...current, [name]: value }));

  const save = async () => {
    setErrors([]);
    try {
      const cover = coverFile ? (await uploadTemporaryImage(coverFile, form.title)).id : form.cover_image;
      // Match on the unique file name so an absolute/relative or re-encoded src in the HTML still keeps its image.
      const contentImages = images.filter((image) => form.content.includes(image.url.split("/").pop()!)).map((image) => image.id);
      const saved = await saveBlogPost(post?.id ?? null, { ...form, cover_image: cover, content_images: contentImages });
      setCoverFile(undefined);
      setNotice(t("common.saved"));
      if (!post) router.push(`/manage/blog/posts/${saved.id}`);
      else {
        setForm({ ...saved, content_images: [] });
        setImages(saved.content_images);
      }
    } catch (error) {
      setErrors(errorMessages(error));
    }
  };

  const text = (name: TextField, multiline = false) => (
    <label key={name}>
      <FieldLabel field={name}>{t(`field.${name}`)}</FieldLabel>
      {multiline ? (
        <textarea value={form[name] ?? ""} onChange={(e) => set(name, e.target.value)} />
      ) : (
        <input dir={name === "slug" || name === "canonical_url" ? "ltr" : undefined} value={form[name] ?? ""} onChange={(e) => set(name, e.target.value)} />
      )}
    </label>
  );

  return (
    <>
      <Guide section="blog" />
      <Messages errors={errors} notice={notice} />
      <div className="card">
        <div className="form-grid">
          {text("title")}
          {text("slug")}
          <label>
            <FieldLabel field="category">{t("field.category")}</FieldLabel>
            <select value={form.category || ""} onChange={(e) => set("category", Number(e.target.value))}>
              <option value="">{t("common.none")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.is_internal ? `${category.name} (${t("blog.internal")})` : category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <FieldLabel field="tags">{t("field.tags")}</FieldLabel>
            <MultiSelect
              options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
              value={form.tags}
              onChange={(ids) => set("tags", ids)}
            />
          </div>
          {text("excerpt", true)}
          <label>
            <FieldLabel field="cover_image">{t("field.cover_image")}</FieldLabel>
            {post?.cover_image_url && !coverFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt="" width={120} />
            )}
            <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0])} />
          </label>
          {text("seo_title")}
          {text("seo_description", true)}
          {text("canonical_url")}
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <span className="field-label">{t("field.content")}</span>
          <RichTextEditor
            value={form.content}
            onChange={(html) => set("content", html)}
            onImageUploaded={(asset) => setImages((current) => [...current, { id: asset.id, url: asset.url }])}
            onError={(error) => setErrors(errorMessages(error))}
          />
        </div>
        <div className="form-actions">
          <button className="primary" onClick={save}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </>
  );
}
