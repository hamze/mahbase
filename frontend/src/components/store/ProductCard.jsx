import React from 'react';
import Link from 'next/link';
import { Image } from '@/components/ui/image';
import Badge from './Badge';
import RatingStars from './RatingStars';
import { faNum, formatPrice } from '@/lib/format';

/** Product card from the list API; products are bought from the detail page (a variant must be chosen there). */
export default function ProductCard({ product }) {
  const { price } = product;
  const to = `/product/${product.slug}`;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-sm">
      <Link href={to} className="relative block aspect-square overflow-hidden bg-muted/40">
        <Image
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badges.length > 0 && (
          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
            {product.badges.map((badge) => <Badge key={badge} label={badge} />)}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={to} className="line-clamp-1 font-semibold leading-7 text-foreground hover:text-primary">
          {product.name}
        </Link>
        {product.description_short && (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{product.description_short}</p>
        )}
        {product.rating_count > 0 && <RatingStars average={product.rating_average} count={product.rating_count} />}

        <div className="mt-auto pt-2">
          {!product.in_stock || !price ? (
            <Badge label="ناموجود" />
          ) : (
            <div className="flex flex-col">
              {price.discount_percentage && (
                <span className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(price.original_price)}</span>
                  <Badge label={`${faNum(price.discount_percentage)}٪`} tone="primary" className="text-[11px]" />
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-foreground">{formatPrice(price.price)}</span>
                <span className="text-xs text-muted-foreground">
                  تومان{product.unit_name ? ` / ${product.unit_name}` : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
