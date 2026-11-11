"use client";

import Link from "next/link";

import { Guide } from "@/components/Guide";
import { Label } from "@/components/Label";
import { Messages } from "@/components/Messages";
import { Pager } from "@/components/Pager";
import { deleteBlogPost, listBlogPosts, setBlogPostStatus } from "@/lib/api/blog";
import { useCan } from "@/lib/auth/permissions";
import { usePagedList } from "@/lib/hooks/usePagedList";
import { t } from "@/lib/i18n/fa";

export default function BlogPostsPage() {
  const can = useCan();
  const { page, query, setQuery, run, errors, notice } = usePagedList(listBlogPosts);

  return (
    <>
      <Guide section="blog" />
      <h1>{t("nav.blogPosts")}</h1>
      <Messages errors={errors} notice={notice} />
      <div className="card row">
        <input
          className="grow"
          placeholder={t("common.search")}
          value={query.search ?? ""}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined, page: undefined })}
        />
        <select value={query.status ?? ""} onChange={(e) => setQuery({ ...query, status: e.target.value || undefined, page: undefined })}>
          <option value="">{t("field.status")}: {t("common.all")}</option>
          <option value="DRAFT">{t("blogStatus.DRAFT")}</option>
          <option value="PUBLISHED">{t("blogStatus.PUBLISHED")}</option>
        </select>
        <select
          value={query.is_internal_page ?? ""}
          onChange={(e) => setQuery({ ...query, is_internal_page: e.target.value || undefined, page: undefined })}
        >
          <option value="">{t("common.all")}</option>
          <option value="false">{t("blog.posts")}</option>
          <option value="true">{t("blog.internalPages")}</option>
        </select>
        {can("blog.create") && (
          <Link className="button" href="/manage/blog/posts/new">
            {t("common.add")}
          </Link>
        )}
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("field.title")}</th>
              <th>{t("field.category")}</th>
              <th>{t("field.status")}</th>
              <th>{t("blog.publishedAt")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {page?.results.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">{t("common.empty")}</td>
              </tr>
            )}
            {page?.results.map((post) => (
              <tr key={post.id}>
                <td>
                  <div className="row">
                    {post.title}
                    {post.is_internal_page && <span className="badge">{t("blog.internal")}</span>}
                  </div>
                </td>
                <td>{post.category_name}</td>
                <td>
                  <Label prefix="blogStatus" value={post.status} tone={post.status === "PUBLISHED" ? "ok" : undefined} />
                </td>
                <td dir="ltr">{post.published_at ? new Date(post.published_at).toLocaleString("fa-IR") : t("common.none")}</td>
                <td>
                  <div className="row">
                    {can("blog.edit") && (
                      <Link className="button" href={`/manage/blog/posts/${post.id}`}>
                        {t("common.edit")}
                      </Link>
                    )}
                    {can("blog.publish") && (
                      <button
                        onClick={() =>
                          run(() => setBlogPostStatus(post.id, post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"))
                        }
                      >
                        {post.status === "PUBLISHED" ? t("blog.unpublish") : t("blog.publish")}
                      </button>
                    )}
                    {can("blog.delete") && (
                      <button className="danger" onClick={() => run(() => deleteBlogPost(post.id), t("common.deleted"))}>
                        {t("common.delete")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} query={query} setQuery={setQuery} />
    </>
  );
}
