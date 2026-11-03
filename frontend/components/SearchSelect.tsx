"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

import { t } from "@/lib/i18n/fa";

type Props<T> = {
  /** Server-side search; called with "" when the menu opens so the first results show without typing. */
  search: (query: string) => Promise<T[]>;
  optionKey: (option: T) => number;
  renderOption: (option: T) => ReactNode;
  onSelect: (option: T) => void;
  placeholder: string;
  /** Changing it drops cached results (e.g. prices depend on the selected customer's tier). */
  resetKey?: string;
  /** Options already picked elsewhere; shown disabled. */
  disabledKeys?: number[];
};

/** Async combobox: debounced search, arrow keys + Enter to pick, Escape to close. The input clears after each pick. */
export function SearchSelect<T>({ search, optionKey, renderOption, onSelect, placeholder, resetKey, disabledKeys = [] }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    const timer = setTimeout(() => {
      searchRef
        .current(query.trim())
        .then((results) => {
          if (!current) return;
          setOptions(results);
          setActive(0);
        })
        .catch(() => current && setOptions([]))
        .finally(() => current && setLoading(false));
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query, resetKey]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (option: T | undefined) => {
    if (!option || disabledKeys.includes(optionKey(option))) return;
    onSelect(option);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (options.length ? (index + step + options.length) % options.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open) pick(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`search-select${open ? " open" : ""}`} ref={root}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} className="search-menu" role="listbox">
          {loading && options.length === 0 && <li className="muted">{t("common.loading")}</li>}
          {!loading && options.length === 0 && <li className="muted">{t("common.empty")}</li>}
          {options.map((option, index) => {
            const disabled = disabledKeys.includes(optionKey(option));
            return (
              <li
                key={optionKey(option)}
                role="option"
                aria-selected={index === active}
                aria-disabled={disabled}
                className={`${index === active ? "active" : ""}${disabled ? " disabled" : ""}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
              >
                {renderOption(option)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
