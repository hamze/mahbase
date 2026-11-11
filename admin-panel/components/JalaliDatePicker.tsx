"use client";

import { useEffect, useRef, useState } from "react";

import { t } from "@/lib/i18n/fa";
import {
  formatJalali,
  fromJalali,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  jalaliMonthLength,
  persianDigits,
  toJalali,
} from "@/lib/jalali";

type Props = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Also pick hour and minute (local time). */
  withTime?: boolean;
  /** Text shown while empty (defaults to "choose a date"). */
  placeholder?: string;
};

/** The only date input of the admin panel: a Jalali calendar popover over a local-time ``Date``. Place it in a
 * ``div.field``, not a ``<label>`` (a label would forward clicks inside the popover to its first button). */
export function JalaliDatePicker({ value, onChange, withTime = false, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => toJalali(value ?? new Date()));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    if (!open) setView(toJalali(value ?? new Date()));
    setOpen(!open);
  };

  const shiftMonth = (delta: number) => {
    const index = view.jy * 12 + view.jm - 1 + delta;
    setView({ jy: Math.floor(index / 12), jm: (index % 12) + 1, jd: 1 });
  };

  const hours = value?.getHours() ?? 0;
  const minutes = value?.getMinutes() ?? 0;
  const selected = value && toJalali(value);
  const today = toJalali(new Date());

  const pickDay = (jd: number) => {
    onChange(fromJalali({ jy: view.jy, jm: view.jm, jd }, hours, minutes));
    if (!withTime) setOpen(false);
  };

  const setTime = (nextHours: number, nextMinutes: number) => {
    const day = selected ?? today;
    onChange(fromJalali(day, nextHours, nextMinutes));
  };

  // Saturday-first: JS getDay() is 0 for Sunday, so Saturday (6) maps to column 0.
  const leading = (fromJalali({ ...view, jd: 1 }).getDay() + 1) % 7;
  const days = Array.from({ length: jalaliMonthLength(view.jy, view.jm) }, (_, index) => index + 1);
  const isSame = (day: { jy: number; jm: number; jd: number } | null, jd: number) =>
    day !== null && day.jy === view.jy && day.jm === view.jm && day.jd === jd;

  return (
    <div className="jdp" ref={root}>
      <button type="button" className="jdp-trigger" onClick={toggle}>
        {value ? formatJalali(value, withTime) : <span className="muted">{placeholder ?? t("date.pick")}</span>}
      </button>
      {open && (
        <div className="jdp-popover" role="dialog">
          <div className="jdp-header">
            <button type="button" className="ghost" onClick={() => shiftMonth(-12)} aria-label={t("date.prevYear")}>
              «
            </button>
            <button type="button" className="ghost" onClick={() => shiftMonth(-1)} aria-label={t("date.prevMonth")}>
              ‹
            </button>
            <strong>
              {JALALI_MONTHS[view.jm - 1]} {persianDigits(String(view.jy))}
            </strong>
            <button type="button" className="ghost" onClick={() => shiftMonth(1)} aria-label={t("date.nextMonth")}>
              ›
            </button>
            <button type="button" className="ghost" onClick={() => shiftMonth(12)} aria-label={t("date.nextYear")}>
              »
            </button>
          </div>
          <div className="jdp-grid">
            {JALALI_WEEKDAYS.map((weekday) => (
              <span key={weekday} className="jdp-weekday">
                {weekday}
              </span>
            ))}
            {Array.from({ length: leading }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {days.map((jd) => (
              <button
                key={jd}
                type="button"
                className={`jdp-day${isSame(selected, jd) ? " selected" : ""}${isSame(today, jd) ? " today" : ""}`}
                onClick={() => pickDay(jd)}
              >
                {persianDigits(String(jd))}
              </button>
            ))}
          </div>
          {withTime && (
            <div className="jdp-time" dir="ltr">
              <select value={hours} onChange={(e) => setTime(Number(e.target.value), minutes)} aria-label={t("date.hour")}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {persianDigits(String(hour).padStart(2, "0"))}
                  </option>
                ))}
              </select>
              :
              <select value={minutes} onChange={(e) => setTime(hours, Number(e.target.value))} aria-label={t("date.minute")}>
                {Array.from({ length: 60 }, (_, minute) => (
                  <option key={minute} value={minute}>
                    {persianDigits(String(minute).padStart(2, "0"))}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="row jdp-footer">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange(withTime ? now : fromJalali(toJalali(now)));
                setOpen(false);
              }}
            >
              {t("date.today")}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {t("date.clear")}
            </button>
            {withTime && (
              <button type="button" className="primary" onClick={() => setOpen(false)}>
                {t("date.done")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** ISO timestamp ⇄ picker value, for API datetime fields. */
export const isoToDate = (value: unknown): Date | null => (value ? new Date(String(value)) : null);
export const dateToIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/** "YYYY-MM-DD" (local) ⇄ picker value, for API date-only filters. */
export function ymdToDate(value: string | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateToYmd(value: Date | null): string | undefined {
  if (!value) return undefined;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
