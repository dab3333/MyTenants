"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon } from "../icons";

const FIELD =
  "block w-full rounded border border-zinc-300 px-3 py-1.5 text-zinc-900 transition-shadow focus-visible:border-clay-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-500";

export function PaymentFilters({ status, from, to }: { status: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(next: { status?: string; from?: string; to?: string }) {
    const merged = { status, from, to, ...next };
    const params = new URLSearchParams();
    if (merged.status) params.set("status", merged.status);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    // Changing any filter invalidates the current page of results.
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Status</span>
          <div className="relative w-48">
            <select
              value={status}
              onChange={(e) => navigate({ status: e.target.value })}
              className={`${FIELD} appearance-none pr-8`}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Due from</span>
          <input type="date" value={from} onChange={(e) => navigate({ from: e.target.value })} className={FIELD} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          <span className="mb-1 block">Due to</span>
          <input type="date" value={to} onChange={(e) => navigate({ to: e.target.value })} className={FIELD} />
        </label>
        {(from || to) && (
          <button
            type="button"
            onClick={() => navigate({ from: "", to: "" })}
            className="px-2 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
