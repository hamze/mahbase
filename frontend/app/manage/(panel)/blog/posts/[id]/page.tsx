import { notFound } from "next/navigation";

import { BlogPostForm } from "@/components/BlogPostForm";
import type { BlogPost } from "@/lib/api/types";
import { serverGet } from "@/lib/server/session";

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await serverGet<BlogPost>(`admin/blog/posts/${encodeURIComponent(id)}/`);
  if (!post) notFound();
  return (
    <>
      <h1>{post.title}</h1>
      <BlogPostForm post={post} />
    </>
  );
}
