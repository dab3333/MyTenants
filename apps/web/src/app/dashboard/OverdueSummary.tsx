import type { OverdueSummary as OverdueSummaryData } from "@/lib/dashboardMetrics";
import { formatCurrency } from "@/lib/currency";

export function OverdueSummary({ summary }: { summary: OverdueSummaryData }) {
  const hasOverdue = summary.count > 0;
  const valueClass = hasOverdue ? "text-red-600" : "text-zinc-900";

  return (
    <div className="flex divide-x divide-zinc-100">
      <div data-testid="overdue-count" className="flex-1 pr-6">
        <p className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-zinc-500">
          {hasOverdue && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />}
          Invoices
        </p>
        <p className={`mt-1.5 text-3xl font-semibold tabular-nums tracking-tight ${valueClass}`}>{summary.count}</p>
      </div>
      <div data-testid="overdue-amount" className="flex-1 pl-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total owed</p>
        <p className={`mt-1.5 text-3xl font-semibold tabular-nums tracking-tight ${valueClass}`}>
          {formatCurrency(summary.totalOwed)}
        </p>
      </div>
    </div>
  );
}
