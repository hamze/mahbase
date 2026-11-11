'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, ShoppingBag } from 'lucide-react';
import { productQuery, relatedProductsQuery } from '@/api/queries';
import { usePriceTier } from '@/lib/AuthContext';
import { useCart } from '@/lib/cart-context';
import { faNum, formatPrice } from '@/lib/format';
import { Image } from '@/components/ui/image';
import Badge from '@/components/store/Badge';
import ProductRow from '@/components/store/ProductRow';
import QuantityStepper from '@/components/store/QuantityStepper';
import RatingStars from '@/components/store/RatingStars';
import RichText from '@/components/store/RichText';
import VariantPicker, { findVariant, selectionOf, variantGroups } from '@/components/store/VariantPicker';
import ProductReviews, { useProductReviews } from '@/components/store/ProductReviews';
import ProductQuestions from '@/components/store/ProductQuestions';
import { cn } from '@/lib/utils';

function Gallery({ product }) {
  const images = product.media.length > 0
    ? product.media.map((m) => ({ id: m.id, url: m.url, alt: m.alt_text || product.name }))
    : [{ id: 'main', url: product.image_url, alt: product.name }];
  const [active, setActive] = useState(0);
  const prev = () => setActive((a) => (a - 1 + images.length) % images.length);
  const next = () => setActive((a) => (a + 1) % images.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted/40">
        <Image key={images[active].id} src={images[active].url} alt={images[active].alt} className="h-full w-full animate-fade-in object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow hover:bg-background" aria-label="تصویر قبلی">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={next} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow hover:bg-background" aria-label="تصویر بعدی">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2', i === active ? 'border-primary' : 'border-transparent')}
            >
              <Image src={img.url} alt={img.alt} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceBox({ price, unit }) {
  if (!price) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
      {price.discount_percentage && <span className="text-lg text-muted-foreground line-through">{formatPrice(price.original_price)}</span>}
      <span className="text-2xl font-bold text-foreground">{formatPrice(price.price)}</span>
      <span className="text-sm text-muted-foreground">تومان{unit ? ` / ${unit}` : ''}</span>
      {price.discount_percentage && <Badge label={`${faNum(price.discount_percentage)}٪ تخفیف`} tone="primary" className="mr-auto" />}
    </div>
  );
}

function PurchaseBox({ product }) {
  const { addItem } = useCart();
  const groups = useMemo(() => variantGroups(product.variants, product.unit_name), [product]);
  const [selection, setSelection] = useState(() =>
    product.variants.length === 1 ? selectionOf(groups, product.variants[0]) : {},
  );
  const [chosen, setChosen] = useState({ variantId: null, quantity: null });
  const [adding, setAdding] = useState(false);

  const variant = findVariant(product.variants, groups, selection);
  const quantity = variant && chosen.variantId === variant.id ? chosen.quantity : variant?.min_purchase;
  const price = variant
    ? { price: variant.price, original_price: variant.original_price, discount_percentage: variant.discount_percentage }
    : product.price;

  const add = async () => {
    setAdding(true);
    await addItem(variant.id, quantity);
    setAdding(false);
  };

  if (product.variants.length === 0) {
    return <Badge label="ناموجود" className="w-fit" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PriceBox price={price} unit={product.unit_name} />
      {product.variants.length > 1 && (
        <VariantPicker variants={product.variants} groups={groups} selection={selection} onChange={setSelection} />
      )}
      {variant && !variant.is_available && <p className="text-sm text-destructive">این گزینه در حال حاضر موجود نیست.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {variant?.is_available && (
          <QuantityStepper
            value={quantity}
            step={variant.purchase_step}
            min={variant.min_purchase}
            max={variant.max_purchase}
            unit={product.unit_symbol || product.unit_name}
            onChange={(q) => setChosen({ variantId: variant.id, quantity: q })}
          />
        )}
        <button
          onClick={add}
          disabled={!variant?.is_available || adding}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
          {variant ? 'افزودن به سبد' : 'ابتدا یک گزینه را انتخاب کنید'}
        </button>
      </div>
    </div>
  );
}

export default function ProductDetail({ slug }) {
  const tier = usePriceTier();
  const product = useQuery(productQuery(slug, tier));
  const related = useQuery(relatedProductsQuery(slug, tier));
  const reviews = useProductReviews(slug);
  const reviewsEnabled = reviews.error?.status !== 403;

  if (product.isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-20"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;
  }
  if (product.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-muted-foreground">
        {product.error.status === 404 ? 'محصول یافت نشد.' : 'دریافت اطلاعات محصول انجام نشد.'}{' '}
        <Link href="/products" className="text-primary hover:underline">مشاهده محصولات</Link>
      </div>
    );
  }

  const p = product.data;
  const sections = [
    p.specifications.length > 0 && { id: 'specs', label: 'مشخصات' },
    p.description_long && { id: 'desc', label: 'توضیحات' },
    reviewsEnabled && { id: 'reviews', label: 'نظرات' },
    { id: 'questions', label: 'پرسش و پاسخ' },
  ].filter(Boolean);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary">خانه</Link><ChevronLeft className="h-3 w-3" />
          <Link href="/products" className="hover:text-primary">محصولات</Link><ChevronLeft className="h-3 w-3" />
          {p.category_slug && (
            <>
              <Link href={`/products?category=${encodeURIComponent(p.category_slug)}`} className="hover:text-primary">{p.category_name}</Link>
              <ChevronLeft className="h-3 w-3" />
            </>
          )}
          <span className="line-clamp-1 text-foreground">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <Gallery key={p.id} product={p} />

          <div className="flex flex-col gap-4">
            <div>
              {p.badges.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">{p.badges.map((badge) => <Badge key={badge} label={badge} />)}</div>
              )}
              <h1 className="text-xl font-bold leading-8 text-foreground md:text-2xl">{p.name}</h1>
              {p.brand_name && <p className="mt-1 text-sm text-muted-foreground">برند: {p.brand_name}</p>}
            </div>
            {p.rating_count > 0 && <RatingStars average={p.rating_average} count={p.rating_count} size="h-4 w-4" />}
            {p.description_short && <p className="text-sm leading-7 text-muted-foreground">{p.description_short}</p>}
            <PurchaseBox key={p.id} product={p} />
          </div>
        </div>

        <div className="sticky top-16 z-20 -mx-4 mt-10 border-b border-border bg-background/90 px-4 backdrop-blur lg:top-[116px]">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto">
            {sections.map((s) => (
              <a key={s.id} href={`#sec-${s.id}`} className="shrink-0 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-10 py-6">
          {p.specifications.length > 0 && (
            <section id="sec-specs" className="scroll-mt-36">
              <h2 className="mb-3 text-lg font-bold text-foreground">مشخصات</h2>
              <div className="overflow-hidden rounded-xl border border-border">
                {p.specifications.map((spec, i) => (
                  <div key={`${spec.attribute}-${spec.value}`} className={cn('flex gap-4 px-4 py-3 text-sm', i % 2 === 0 ? 'bg-card/50' : 'bg-background')}>
                    <span className="w-1/3 text-muted-foreground">{spec.attribute_name}</span>
                    <span className="flex-1 text-foreground">{spec.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {p.description_long && (
            <section id="sec-desc" className="scroll-mt-36">
              <h2 className="mb-3 text-lg font-bold text-foreground">توضیحات</h2>
              <RichText html={p.description_long} />
            </section>
          )}

          {reviewsEnabled && (
            <section id="sec-reviews" className="scroll-mt-36">
              <ProductReviews slug={slug} average={p.rating_average} count={p.rating_count} />
            </section>
          )}

          <section id="sec-questions" className="scroll-mt-36">
            <ProductQuestions productId={p.id} />
          </section>
        </div>
      </div>

      <div className="pb-12">
        <ProductRow title="محصولات مرتبط" products={related.data || []} />
      </div>
    </>
  );
}
