"use client";

import { useState } from "react";
import { DATE_RANGE_PRESETS } from "@/lib/dateRange";
import { ChevronDownIcon } from "./icons";

const PRESET_LABELS: Record<(typeof DATE_RANGE_PRESETS)[number], string> = {
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
  custom: "Custom range",
};

const FIELD =
  "border border-zinc-300 rounded px-3 py-1.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block";

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

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="block text-sm font-medium text-zinc-700">
        <span className="mb-1 block">Date range</span>
        <div className="relative">
          <select
            name="preset"
            value={selected}
            onChange={(e) => setSelected(e.target.value as (typeof DATE_RANGE_PRESETS)[number])}
            className={`${FIELD} appearance-none pr-8`}
          >
            {DATE_RANGE_PRESETS.map((value) => (
              <option key={value} value={value}>
                {PRESET_LABELS[value]}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
      </label>

      {selected === "custom" && (
        <>
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">From</span>
            <input type="date" name="from" defaultValue={from} className={FIELD} required />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            <span className="mb-1 block">To</span>
            <input type="date" name="to" defaultValue={to} className={FIELD} required />
          </label>
        </>
      )}

      <button
        type="submit"
        className="rounded bg-clay-600 px-4 py-1.5 font-medium text-white transition-colors hover:bg-clay-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:ring-offset-1"
      >
        Apply
      </button>
    </form>
  );
}
