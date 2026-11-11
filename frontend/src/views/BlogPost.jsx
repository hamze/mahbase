'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CalendarDays, User } from 'lucide-react';
import { blogPostQuery } from '@/api/queries';
import { formatJalali } from '@/lib/jalali';
import { Image } from '@/components/ui/image';
import RichText from '@/components/store/RichText';

export default function BlogPost({ slug }) {
  const { data: post, isLoading } = useQuery(blogPostQuery(slug));

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">نوشته مورد نظر یافت نشد.</p>
        <Link href="/blog" className="mt-3 inline-block text-sm text-primary hover:underline">بازگشت به بلاگ</Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">خانه</Link>
        <ChevronRight className="h-3 w-3 rotate-180" />
        <Link href="/blog" className="hover:text-primary">بلاگ</Link>
        {post.category_slug && (
          <>
            <ChevronRight className="h-3 w-3 rotate-180" />
            <Link href={`/blog?category=${encodeURIComponent(post.category_slug)}`} className="hover:text-primary">{post.category_name}</Link>
          </>
        )}
        <ChevronRight className="h-3 w-3 rotate-180" />
        <span className="line-clamp-1 text-foreground">{post.title}</span>
      </nav>

      <h1 className="text-2xl font-bold leading-10 text-foreground md:text-3xl">{post.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {post.author_name && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {post.author_name}</span>}
        {post.published_at && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatJalali(post.published_at)}</span>}
      </div>

      {post.cover_image_url && (
        <div className="mt-6 aspect-video overflow-hidden rounded-2xl bg-muted">
          <Image src={post.cover_image_url} alt={post.title} className="h-full w-full object-cover" />
        </div>
      )}

      {post.excerpt && <p className="mt-6 text-base leading-8 text-muted-foreground">{post.excerpt}</p>}

      <RichText html={post.content} className="mt-6 text-foreground" />

      {(post.tags || []).length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span key={t} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">#{t}</span>
          ))}
        </div>
      )}

      <Link href="/blog" className="mt-10 inline-block text-sm text-primary hover:underline">← بازگشت به بلاگ</Link>
    </article>
  );
}
