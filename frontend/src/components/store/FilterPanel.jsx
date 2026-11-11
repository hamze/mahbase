import React, { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const csv = (value) => (value ? value.split(',') : []);
const toggleCsv = (value, item) => {
  const list = csv(value);
  return (list.includes(item) ? list.filter((v) => v !== item) : [...list, item]).join(',');
};

function CheckboxList({ title, options, selected, onToggle }) {
  if (options.length === 0) return null;
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function PriceRange({ min, max, onApply }) {
  const [from, setFrom] = useState(min);
  const [to, setTo] = useState(max);
  const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary';
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-foreground">محدوده قیمت (تومان)</h4>
      <div className="flex items-center gap-2">
        <input type="number" min="0" placeholder="از" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <span className="text-muted-foreground">—</span>
        <input type="number" min="0" placeholder="تا" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
      </div>
      <button onClick={() => onApply(from, to)} className="mt-2 w-full rounded-lg border border-border py-2 text-xs text-foreground hover:bg-muted">
        اعمال قیمت
      </button>
    </div>
  );
}

/**
 * Product filters bound to the URL query: ``values`` are the current query params and ``onChange(changes)`` merges
 * new params (empty = removed). Brand and attribute options come from the selected category's filters.
 */
export default function FilterPanel({ categories, activeCategory, options, values, onChange, onClose }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between lg:hidden">
        <h3 className="font-bold text-foreground">فیلترها</h3>
        {onClose && (
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">دسته‌بندی</h4>
          <ul className="space-y-1 text-sm">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className={cn('block py-1 hover:text-primary', activeCategory === category.slug ? 'font-semibold text-primary' : 'text-foreground')}
                >
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <ul className="mr-3 border-r border-border pr-3">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/products?category=${encodeURIComponent(child.slug)}`}
                          className={cn('block py-1 text-xs hover:text-primary', activeCategory === child.slug ? 'font-semibold text-primary' : 'text-muted-foreground')}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
        <input
          type="checkbox"
          checked={values.in_stock === 'true'}
          onChange={(e) => onChange({ in_stock: e.target.checked ? 'true' : '' })}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        فقط کالاهای موجود
      </label>

      <PriceRange
        key={`${values.min_price || ''}-${values.max_price || ''}`}
        min={values.min_price || ''}
        max={values.max_price || ''}
        onApply={(min, max) => onChange({ min_price: min, max_price: max })}
      />

      {options && (
        <>
          <CheckboxList
            title="برند"
            options={options.brands.map((b) => ({ value: String(b.id), label: b.name }))}
            selected={csv(values.brand)}
            onToggle={(id) => onChange({ brand: toggleCsv(values.brand, id) })}
          />
          {options.attributes.map((attribute) => {
            const key = `attr_${attribute.id}`;
            return (
              <CheckboxList
                key={attribute.id}
                title={attribute.name}
                options={attribute.values.map((v) => ({ value: v, label: v }))}
                selected={csv(values[key])}
                onToggle={(v) => onChange({ [key]: toggleCsv(values[key], v) })}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
