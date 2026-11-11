import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Star } from 'lucide-react';
import { createReview } from '@/api/catalog';
import { reviewsQuery } from '@/api/queries';
import { useAuth } from '@/lib/AuthContext';
import { formatJalali } from '@/lib/jalali';
import { faNum } from '@/lib/format';
import RatingStars from './RatingStars';

const inputCls = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';
const EMPTY = { rating: 5, title: '', body: '' };

/** Approved reviews of a product; 403 means the store disabled reviews (the section is hidden). */
export function useProductReviews(slug) {
  return useQuery(reviewsQuery(slug));
}

function ReviewForm({ slug }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      await createReview(slug, form);
      setForm(EMPTY);
      setResult({ ok: true, text: 'نظر شما ثبت شد و پس از تایید نمایش داده می‌شود.' });
      queryClient.invalidateQueries({ queryKey: ['reviews', slug] });
    } catch (error) {
      setResult({ ok: false, text: error.messages?.[0] || 'ثبت نظر انجام نشد.' });
    }
    setSending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="mb-1 block text-sm text-foreground">امتیاز</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button type="button" key={star} onClick={() => setForm({ ...form, rating: star })} aria-label={`${faNum(star)} ستاره`}>
              <Star className={star <= form.rating ? 'h-6 w-6 fill-warning text-warning' : 'h-6 w-6 text-muted-foreground/30'} />
            </button>
          ))}
        </div>
      </div>
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان نظر" className={inputCls} />
      <textarea
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        placeholder="متن نظر"
        rows={4}
        required
        className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
      />
      {result && <p className={result.ok ? 'rounded-xl bg-success/10 p-3 text-xs text-success' : 'rounded-xl bg-destructive/10 p-3 text-xs text-destructive'}>{result.text}</p>}
      <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} ثبت نظر
      </button>
    </form>
  );
}

export default function ProductReviews({ slug, average, count }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const reviews = useProductReviews(slug);
  const list = reviews.data?.results || [];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h2 className="mb-4 text-lg font-bold text-foreground">نظرات کاربران</h2>
        {count > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="text-3xl font-bold text-foreground">{faNum(Number(average))}</span>
            <RatingStars average={average} count={count} size="h-4 w-4" />
          </div>
        )}
        <div className="space-y-3">
          {reviews.isLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز نظری برای این محصول ثبت نشده است.</p>
          ) : (
            list.map((review) => (
              <div key={review.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{review.user_name}</span>
                  <RatingStars average={review.rating} count={0} />
                </div>
                <span className="text-xs text-muted-foreground">{formatJalali(review.created_at)}</span>
                {review.title && <p className="mt-2 text-sm font-medium text-foreground">{review.title}</p>}
                <p className="mt-1 whitespace-pre-line text-sm leading-7 text-muted-foreground">{review.body}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="h-fit rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-4 text-lg font-bold text-foreground">ثبت نظر</h3>
        {isAuthenticated ? (
          <ReviewForm slug={slug} />
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            برای ثبت نظر ابتدا{' '}
            <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`} className="text-primary hover:underline">وارد حساب کاربری</Link>{' '}
            شوید.
          </p>
        )}
      </div>
    </div>
  );
}
