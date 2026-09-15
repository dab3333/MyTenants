import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { resolveDateRange, buildMonthBuckets, DATE_RANGE_PRESETS } from "@/lib/dateRange";
import { getIncomeTrend, getTenantCountTrend, getOccupancyByBuilding, getOverdueSummary } from "@/lib/dashboardMetrics";
import { DashboardFilterForm } from "./DashboardFilterForm";
import { IncomeTrendChart } from "./IncomeTrendChart";
import { TenantCountChart } from "./TenantCountChart";
import { OccupancyByBuilding } from "./OccupancyByBuilding";
import { OverdueSummary } from "./OverdueSummary";

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const { preset, from, to } = await searchParams;
  const validPreset = preset && (DATE_RANGE_PRESETS as readonly string[]).includes(preset)
    ? (preset as (typeof DATE_RANGE_PRESETS)[number])
    : "6m";
  const today = new Date();
  const range = resolveDateRange(validPreset, from, to, today);
  const buckets = buildMonthBuckets(range);

  const scoped = createScopedClient(session.user.organizationId);
  const [incomeTrend, tenantCountTrend, occupancy, overdue] = await Promise.all([
    getIncomeTrend(scoped, range, buckets),
    getTenantCountTrend(scoped, buckets),
    getOccupancyByBuilding(scoped),
    getOverdueSummary(scoped),
  ]);

  const CARD = "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm";

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Income, occupancy, and payment health across your buildings.</p>
        </div>

        <DashboardFilterForm preset={validPreset} from={from} to={to} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Overdue Payments</h2>
          <OverdueSummary summary={overdue} />
        </section>

        <section className={CARD}>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Occupancy By Building</h2>
          <OccupancyByBuilding buildings={occupancy} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Income Trend</h2>
          <IncomeTrendChart data={incomeTrend} />
        </section>

        <section className={CARD}>
          <h2 className="text-lg font-semibold text-zinc-900 mb-3">Tenant Count Over Time</h2>
          <TenantCountChart data={tenantCountTrend} />
        </section>
      </div>
    </div>
  );
}
