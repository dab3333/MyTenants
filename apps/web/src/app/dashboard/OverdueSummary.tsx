import type { OverdueSummary as OverdueSummaryData } from "@/lib/dashboardMetrics";

export function OverdueSummary({ summary }: { summary: OverdueSummaryData }) {
  return (
    <div className="flex gap-4">
      <div data-testid="overdue-count" className="rounded bg-red-100 px-4 py-3">
        <p className="text-sm text-zinc-600">Overdue invoices</p>
        <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{summary.count}</p>
      </div>
      <div data-testid="overdue-amount" className="rounded bg-red-100 px-4 py-3">
        <p className="text-sm text-zinc-600">Total owed</p>
        <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{summary.totalOwed.toFixed(2)}</p>
      </div>
    </div>
  );
}
