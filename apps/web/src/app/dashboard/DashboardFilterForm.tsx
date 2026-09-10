"use client";

import { useState } from "react";
import { DATE_RANGE_PRESETS } from "@/lib/dateRange";

const PRESET_LABELS: Record<(typeof DATE_RANGE_PRESETS)[number], string> = {
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date",
  custom: "Custom range",
};

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
    <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
      <label className="block text-sm">
        Date range
        <select
          name="preset"
          value={selected}
          onChange={(e) => setSelected(e.target.value as (typeof DATE_RANGE_PRESETS)[number])}
          className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block"
        >
          {DATE_RANGE_PRESETS.map((value) => (
            <option key={value} value={value}>
              {PRESET_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      {selected === "custom" && (
        <>
          <label className="block text-sm">
            From
            <input type="date" name="from" defaultValue={from} className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" required />
          </label>
          <label className="block text-sm">
            To
            <input type="date" name="to" defaultValue={to} className="border border-zinc-300 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 focus-visible:border-clay-500 transition-shadow block" required />
          </label>
        </>
      )}

      <button type="submit" className="border border-zinc-300 rounded px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-50 hover:border-clay-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500 transition-colors">
        Apply
      </button>
    </form>
  );
}
