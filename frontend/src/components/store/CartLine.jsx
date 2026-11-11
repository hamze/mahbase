import React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useCart } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import QuantityStepper from './QuantityStepper';
import { cn } from '@/lib/utils';

/** One cart line (backend prices and warnings); quantity changes go through the cart context. */
export default function CartLine({ item, compact = false, onNavigate }) {
  const { updateQuantity, removeItem } = useCart();
  const to = `/product/${item.product_slug}`;
  const discounted = Number(item.original_unit_price) > Number(item.unit_price);

  return (
    <li className={cn('flex rounded-2xl border border-border bg-card', compact ? 'gap-3 p-2' : 'gap-4 p-3')}>
      <Link href={to} onClick={onNavigate} className={cn('shrink-0 overflow-hidden rounded-xl bg-muted', compact ? 'h-16 w-16' : 'h-24 w-24')}>
        <Image src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={to} onClick={onNavigate} className="line-clamp-1 text-sm font-medium text-foreground hover:text-primary">
              {item.product_name}
            </Link>
            {item.variant_label && <p className="text-xs text-muted-foreground">{item.variant_label}</p>}
          </div>
          <button onClick={() => removeItem(item.variant)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="حذف">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {discounted && <span className="ml-1 line-through">{formatPrice(item.original_unit_price)}</span>}
          {formatPrice(item.unit_price)} تومان{item.unit_name ? ` / ${item.unit_name}` : ''}
        </span>
        {item.warnings.map((warning) => (
          <p key={warning} className="text-xs text-warning">{warning}</p>
        ))}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <QuantityStepper
            value={item.quantity}
            step={item.purchase_step}
            min={item.min_purchase}
            max={item.max_purchase}
            onChange={(quantity) => updateQuantity(item.variant, quantity)}
            size={compact ? 'sm' : 'md'}
          />
          <span className={cn('font-bold text-foreground', compact && 'text-sm')}>{formatPrice(item.line_total)} تومان</span>
        </div>
      </div>
    </li>
  );
}
