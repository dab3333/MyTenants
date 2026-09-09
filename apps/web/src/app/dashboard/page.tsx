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

  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardFilterForm preset={validPreset} from={from} to={to} />

      <section>
        <h2 className="text-xl font-semibold mb-2">Income Trend</h2>
        <IncomeTrendChart data={incomeTrend} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Tenant Count Over Time</h2>
        <TenantCountChart data={tenantCountTrend} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Occupancy By Building</h2>
        <OccupancyByBuilding buildings={occupancy} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Overdue Payments</h2>
        <OverdueSummary summary={overdue} />
      </section>
    </main>
  );
}
