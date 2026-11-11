import { cache } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { getBlogPost } from '@/api/content';
import { blogPostQuery } from '@/api/queries';
import { absoluteUrl, jsonLd, prefetchPage, siteUrl, storeSettings } from '@/lib/server-data';
import BlogPost from '@/views/BlogPost';

const loadPost = cache(async (slug) => {
  try {
    return await getBlogPost(slug);
  } catch (error) {
    if (error.status === 404) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  const path = `/blog/${encodeURIComponent(post.slug)}`;
  const description = post.seo_description || post.excerpt || undefined;
  return {
    title: post.seo_title || post.title,
    description,
    alternates: { canonical: post.canonical_url || path },
    openGraph: {
      type: 'article',
      url: path,
      title: post.seo_title || post.title,
      description,
      publishedTime: post.published_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      tags: post.tags,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([loadPost(slug), storeSettings()]);
  const { state } = await prefetchPage([{ ...blogPostQuery(slug), queryFn: () => post }]);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: post.cover_image_url ? [absoluteUrl(post.cover_image_url)] : undefined,
    datePublished: post.published_at || undefined,
    author: post.author_name ? { '@type': 'Person', name: post.author_name } : undefined,
    publisher: { '@type': 'Organization', name: settings.store_name, logo: absoluteUrl(settings.logo_url) || undefined },
    mainEntityOfPage: `${siteUrl()}/blog/${encodeURIComponent(post.slug)}`,
    keywords: post.tags?.join(', ') || undefined,
  };
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
      <BlogPost slug={slug} />
    </HydrationBoundary>
  );
}
