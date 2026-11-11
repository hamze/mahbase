'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { internalPageQuery } from '@/api/queries';
import { Image } from '@/components/ui/image';
import PageNotFound from '@/lib/PageNotFound';
import RichText from '@/components/store/RichText';

/** Store pages managed in the blog's internal category (about, terms, …) at ``/pages/:slug``. */
export default function InternalPage({ slug }) {
  const { data: page, isLoading, error } = useQuery(internalPageQuery(slug));

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;

  if (!page) {
    if (error?.status === 404) return <PageNotFound />;
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">دریافت صفحه انجام نشد.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-primary hover:underline">بازگشت به صفحه اصلی</Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold leading-10 text-foreground md:text-3xl">{page.title}</h1>
      {page.cover_image_url && (
        <div className="mt-6 aspect-video overflow-hidden rounded-2xl bg-muted">
          <Image src={page.cover_image_url} alt={page.title} className="h-full w-full object-cover" />
        </div>
      )}
      <RichText html={page.content} className="mt-6 text-foreground" />
    </article>
  );
}
