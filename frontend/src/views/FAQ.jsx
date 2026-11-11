'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, Phone } from 'lucide-react';
import { faqCategoriesQuery, faqsQuery } from '@/api/queries';
import { cn } from '@/lib/utils';
import RichText from '@/components/store/RichText';

const stripTags = (html) => html.replace(/<[^>]*>/g, ' ');

export default function FAQ() {
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [open, setOpen] = useState({});

  const { data: categories = [] } = useQuery(faqCategoriesQuery());
  const { data: items = [], isLoading } = useQuery(faqsQuery());

  const query = q.trim();
  const filtered = items.filter((i) => {
    const matchCat = activeCat === null || i.category === activeCat;
    const matchQ = !query || i.question.includes(query) || stripTags(i.answer).includes(query);
    return matchCat && matchQ;
  });

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">سوالات متداول</h1>
        <p className="mt-2 text-sm text-muted-foreground">پاسخ پرسش‌های رایج درباره سفارش، پرداخت و ارسال را اینجا بیابید.</p>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در سوالات..." className="h-12 w-full rounded-xl border border-border bg-muted/50 pr-10 pl-4 text-sm outline-none focus:border-primary focus:bg-background" />
      </div>

      {categories.length > 0 && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {[{ id: null, title: 'همه' }, ...categories].map((c) => (
            <button key={c.id ?? 'all'} onClick={() => setActiveCat(c.id)} className={cn('shrink-0 rounded-full border px-4 py-1.5 text-sm transition', activeCat === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted')}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            سوالی مرتبط با جستجوی شما یافت نشد.
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button onClick={() => toggle(item.id)} className="flex w-full items-center justify-between gap-2 p-4 text-right">
                <span className="text-sm font-medium text-foreground">{item.question}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open[item.id] && 'rotate-180')} />
              </button>
              {open[item.id] && <RichText html={item.answer} className="border-t border-border px-4 py-3 leading-7" />}
            </div>
          ))
        )}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center">
        <Phone className="h-8 w-8 text-primary" />
        <h2 className="text-lg font-bold text-foreground">پاسخ خود را نیافتید؟</h2>
        <p className="text-sm text-muted-foreground">تیم پشتیبانی ما آماده پاسخگویی به شماست.</p>
        <Link href="/contact" className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">تماس با پشتیبانی</Link>
      </div>
    </div>
  );
}
