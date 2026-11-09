import { BlogPostForm } from "@/components/BlogPostForm";
import { t } from "@/lib/i18n/fa";

export default function NewBlogPostPage() {
  return (
    <>
      <h1>{t("blog.newPost")}</h1>
      <BlogPostForm />
    </>
  );
}
