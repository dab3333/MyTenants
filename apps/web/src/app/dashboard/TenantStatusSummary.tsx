import type { TenantStatusCounts } from "@/lib/dashboardMetrics";

export function TenantStatusSummary({ counts }: { counts: TenantStatusCounts }) {
  return (
    <div className="flex divide-x divide-zinc-100">
      <div data-testid="active-tenants-count" className="flex-1 pr-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active</p>
        <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{counts.active}</p>
      </div>
      <div data-testid="prospect-count" className="flex-1 pl-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Prospects</p>
        <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{counts.prospects}</p>
      </div>
    </div>
  );
}
