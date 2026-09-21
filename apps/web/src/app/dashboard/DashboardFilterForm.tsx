"use client";

import { useEffect, useRef, useState } from "react";
import { DATE_RANGE_PRESETS } from "@/lib/dateRange";
import { CalendarIcon, CheckIcon, ChevronDownIcon } from "./icons";

const PRESET_LABELS: Record<(typeof DATE_RANGE_PRESETS)[number], string> = {
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
  custom: "Custom range",
};

const DATE_SEGMENT =
  "border-none bg-transparent text-sm text-zinc-900 focus-visible:outline-none";

export function DashboardFilterForm({
  preset,
  from,
  to,
}: {
  preset: (typeof DATE_RANGE_PRESETS)[number];
  from?: string;
  to?: string;
}) {
  const [selected, setSelected] = useState<(typeof DATE_RANGE_PRESETS)[number]>(preset);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <form method="get" className="flex flex-col items-end gap-1.5">
      <span className="text-xs font-medium text-zinc-500">Date range</span>
      <div ref={menuRef} className="relative">
        <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
          <input type="hidden" name="preset" value={selected} />

          <div className="relative flex">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={open}
              className="flex h-full items-center gap-2 bg-zinc-50 py-2.5 pl-4 pr-8 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              <span className="text-zinc-500">
                <CalendarIcon className="h-4 w-4" />
              </span>
              <span>{PRESET_LABELS[selected]}</span>
            </button>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
          </div>

          {selected === "custom" && (
            <>
              <div className="w-px shrink-0 bg-zinc-200" />
              <label className="flex items-center gap-2 bg-white px-4">
                <span className="text-sm font-medium text-zinc-500">From</span>
                <input type="date" name="from" defaultValue={from} className={DATE_SEGMENT} required />
              </label>
              <div className="w-px shrink-0 bg-zinc-200" />
              <label className="flex items-center gap-2 bg-white px-4">
                <span className="text-sm font-medium text-zinc-500">To</span>
                <input type="date" name="to" defaultValue={to} className={DATE_SEGMENT} required />
              </label>
            </>
          )}

          <button
            type="submit"
            className="border-l border-zinc-200 bg-clay-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
          >
            Apply
          </button>
        </div>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full z-20 mt-1.5 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {DATE_RANGE_PRESETS.map((value) => {
              const isSelected = value === selected;
              return (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelected(value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? "bg-clay-50 font-semibold text-clay-700" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {PRESET_LABELS[value]}
                  {isSelected && <CheckIcon className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </form>
  );
}
