"use client";

import { useEffect, useRef, useState } from "react";

import { t } from "@/lib/i18n/fa";

export type MultiSelectOption = { value: number; label: string };

type Props = {
  options: MultiSelectOption[];
  value: number[];
  onChange: (value: number[]) => void;
  /** Shown while nothing is selected, e.g. to explain what an empty selection means. */
  placeholder?: string;
};

/** Select2-style multi-select: removable chips, search, "select all" (of the filtered list) and "clear all". */
export function MultiSelect({ options, value, onChange, placeholder = t("multi.placeholder") }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.filter((option) => value.includes(option.value));
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div className={`multi-select${open ? " open" : ""}`} ref={root} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <div className="multi-control" onClick={() => setOpen(true)}>
        {selected.length === 0 && <span className="multi-placeholder">{placeholder}</span>}
        {selected.map((option) => (
          <span key={option.value} className="chip">
            {option.label}
            <button
              type="button"
              aria-label={t("multi.remove", { label: option.label })}
              onClick={(e) => {
                e.stopPropagation();
                toggle(option.value);
              }}
            >
              ×
            </button>
          </span>
        ))}
        {selected.length > 0 && (
          <button
            type="button"
            className="multi-clear"
            title={t("multi.clearAll")}
            aria-label={t("multi.clearAll")}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="multi-menu">
          <input autoFocus placeholder={t("multi.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="multi-actions">
            <button
              type="button"
              onClick={() => onChange([...value, ...filtered.map((option) => option.value).filter((id) => !value.includes(id))])}
            >
              {t("multi.selectAll")}
            </button>
            <button type="button" onClick={() => onChange([])}>
              {t("multi.clearAll")}
            </button>
          </div>
          <ul>
            {filtered.length === 0 && <li className="muted">{t("multi.noResults")}</li>}
            {filtered.map((option) => (
              <li key={option.value}>
                <label className="inline">
                  <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
                  {option.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
