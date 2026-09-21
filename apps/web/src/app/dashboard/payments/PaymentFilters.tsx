"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDownIcon } from "../icons";

const SEGMENT_SELECT =
  "appearance-none cursor-pointer border-none bg-transparent py-3 pl-5 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay-500";

function segmentTextClass(isSet: boolean): string {
  return isSet
    ? "font-semibold text-zinc-900"
    : "font-medium text-zinc-700 transition-colors hover:text-clay-700";
}

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
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="relative">
        <label className="sr-only" htmlFor="payment-filter-status">
          Status
        </label>
        <select
          id="payment-filter-status"
          value={status}
          onChange={(e) => navigate({ status: e.target.value })}
          className={`${SEGMENT_SELECT} ${segmentTextClass(status !== "")}`}
        >
          <option value="">Status</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
      </div>

      <div className="my-2.5 hidden w-px shrink-0 bg-zinc-200 sm:block" />

      <label className="flex items-center gap-2 px-5 py-3">
        <span className="text-sm font-medium text-zinc-500">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => navigate({ from: e.target.value })}
          className="border-none bg-transparent text-sm text-zinc-900 focus-visible:outline-none"
        />
      </label>

      <div className="my-2.5 hidden w-px shrink-0 bg-zinc-200 sm:block" />

      <label className="flex items-center gap-2 px-5 py-3">
        <span className="text-sm font-medium text-zinc-500">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => navigate({ to: e.target.value })}
          className="border-none bg-transparent text-sm text-zinc-900 focus-visible:outline-none"
        />
      </label>

      {(from || to) && (
        <>
          <div className="my-2.5 hidden w-px shrink-0 bg-zinc-200 sm:block" />
          <button
            type="button"
            onClick={() => navigate({ from: "", to: "" })}
            className="px-5 py-3 text-sm font-medium text-zinc-500 transition-colors hover:text-clay-700"
          >
            Clear dates
          </button>
        </>
      )}
    </div>
  );
}
