'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { bannersQuery, categoriesQuery, faqsQuery, productRowQuery } from '@/api/queries';
import { usePriceTier } from '@/lib/AuthContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import HeroSlider from '@/components/store/HeroSlider';
import PromoBanner from '@/components/store/PromoBanner';
import CategoryStrip from '@/components/store/CategoryStrip';
import ProductRow from '@/components/store/ProductRow';
import RichText from '@/components/store/RichText';

function useProductRow(sort) {
  const tier = usePriceTier();
  return useQuery({ ...productRowQuery(sort, tier), select: (page) => page.results });
}

function HomeFaqs({ faqs }) {
  if (faqs.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6 text-center md:p-10">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">سوالات متداول</h2>
        <Accordion type="single" collapsible className="w-full text-right">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={String(faq.id)}>
              <AccordionTrigger className="text-right hover:no-underline">{faq.question}</AccordionTrigger>
              <AccordionContent>
                <RichText html={faq.answer} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Link href="/faq" className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
          مشاهده همه سوالات
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  const hero = useQuery(bannersQuery('HERO'));
  const promos = useQuery(bannersQuery('SIDEBAR'));
  const categories = useQuery(categoriesQuery());
  const faqs = useQuery(faqsQuery(true));
  const newest = useProductRow('newest');
  const discounted = useProductRow('discount');
  const popular = useProductRow('popular');

  return (
    <div className="pb-6">
      <HeroSlider banners={hero.data || []} />
      <CategoryStrip categories={categories.data || []} />
      <ProductRow
        title="تخفیف‌دارها"
        to="/products?sort=discount"
        products={(discounted.data || []).filter((p) => p.price?.discount_percentage)}
      />
      <ProductRow title="جدیدترین محصولات" to="/products?sort=newest" products={newest.data || []} />
      <PromoBanner banners={promos.data || []} />
      <ProductRow title="محبوب‌ترین محصولات" to="/products?sort=popular" products={popular.data || []} />
      <HomeFaqs faqs={faqs.data || []} />
    </div>
  );
}
