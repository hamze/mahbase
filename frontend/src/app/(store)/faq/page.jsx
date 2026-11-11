import { HydrationBoundary } from '@tanstack/react-query';
import { faqCategoriesQuery, faqsQuery } from '@/api/queries';
import { jsonLd, prefetchPage } from '@/lib/server-data';
import FAQ from '@/views/FAQ';

export const metadata = { title: 'سوالات متداول', alternates: { canonical: '/faq' } };

export default async function FaqPage() {
  const { data: faqs, state } = await prefetchPage([faqCategoriesQuery()], faqsQuery());
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
  return (
    <HydrationBoundary state={state}>
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />}
      <FAQ />
    </HydrationBoundary>
  );
}
