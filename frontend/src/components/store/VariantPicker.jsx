import React from 'react';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';

const attributeValue = (variant, attributeId) => variant.attributes.find((a) => a.attribute === attributeId)?.value;

const variantLabel = (variant, unit) =>
  variant.attributes.map((a) => a.value).join(' / ') || `${formatQuantity(variant.pack_size)} ${unit || ''}`.trim() || variant.sku;

/**
 * Option groups for the variants: one group per attribute when every variant has a value for each attribute,
 * otherwise a single group listing the variants themselves.
 */
export function variantGroups(variants, unit) {
  const groups = [];
  variants.forEach((variant) =>
    variant.attributes.forEach((a) => {
      let group = groups.find((g) => g.id === a.attribute);
      if (!group) {
        group = { id: a.attribute, name: a.attribute_name, values: [], valueOf: (v) => attributeValue(v, a.attribute) };
        groups.push(group);
      }
      if (!group.values.includes(a.value)) group.values.push(a.value);
    }),
  );
  const combinations = new Set(variants.map((v) => groups.map((g) => g.valueOf(v)).join('|')));
  const byAttributes =
    groups.length > 0 && variants.every((v) => v.attributes.length === groups.length) && combinations.size === variants.length;
  if (byAttributes) return groups;
  return [{ id: 'variant', name: 'انتخاب نوع', values: variants.map((v) => variantLabel(v, unit)), valueOf: (v) => variantLabel(v, unit) }];
}

export const selectionOf = (groups, variant) => Object.fromEntries(groups.map((g) => [g.id, g.valueOf(variant)]));

export const findVariant = (variants, groups, selection) =>
  variants.find((v) => groups.every((g) => g.valueOf(v) === selection[g.id]));

/**
 * Buttons per option group. A value no available variant has is disabled; picking a value whose combination with the
 * current choice is unavailable switches to an available variant with that value.
 */
export default function VariantPicker({ variants, groups, selection, onChange }) {
  const matchesOthers = (variant, group) =>
    groups.every((g) => g.id === group.id || selection[g.id] === undefined || g.valueOf(variant) === selection[g.id]);

  const pick = (group, value) => {
    const next = { ...selection, [group.id]: value };
    const exact = variants.find((v) => v.is_available && groups.every((g) => next[g.id] === undefined || g.valueOf(v) === next[g.id]));
    const fallback = variants.find((v) => v.is_available && group.valueOf(v) === value);
    onChange(exact ? next : selectionOf(groups, fallback));
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.id}>
          <span className="mb-2 block text-sm font-medium text-foreground">{group.name}</span>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const withValue = variants.filter((v) => group.valueOf(v) === value);
              const available = withValue.some((v) => v.is_available);
              const fits = withValue.some((v) => v.is_available && matchesOthers(v, group));
              const selected = selection[group.id] === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pick(group, value)}
                  disabled={!available}
                  className={cn(
                    'rounded-xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-40',
                    selected ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:border-primary/40',
                    !fits && !selected && 'opacity-60',
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
