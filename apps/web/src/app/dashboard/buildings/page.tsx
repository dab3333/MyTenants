import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getOccupancyByBuilding } from "@/lib/dashboardMetrics";
import { CreateBuildingForm } from "./CreateBuildingForm";
import { BuildingMark } from "../icons";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const BAR_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-zinc-300",
  partial: "bg-amber-500",
  full: "bg-green-500",
};

export default async function BuildingsListPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const [buildings, occupancy] = await Promise.all([
    scoped.building.findMany({ orderBy: { createdAt: "asc" } }),
    getOccupancyByBuilding(scoped),
  ]);
  const occupancyById = new Map(occupancy.map((o) => [o.id, o]));

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-6">Buildings</h1>
      <CreateBuildingForm />

      {buildings.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-200 py-12 text-center">
          <span className="text-zinc-300">
            <BuildingMark />
          </span>
          <p className="text-zinc-500">No buildings yet — add your first one above.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
          {buildings.map((building) => {
            const occ = occupancyById.get(building.id);
            const totalCapacity = occ?.totalCapacity ?? 0;
            const occupiedCapacity = occ?.occupiedCapacity ?? 0;
            const pct = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0;
            const status = statusFor(occupiedCapacity, totalCapacity);

            return (
              <li key={building.id}>
                <Link
                  href={`/dashboard/buildings/${building.id}`}
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 transition-colors group-hover:text-clay-700">
                      {building.name}
                    </p>
                    {building.address && <p className="truncate text-sm text-zinc-500">{building.address}</p>}
                  </div>
                  <div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
                    <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
                      <div className={`h-full rounded-full ${BAR_CLASSES[status]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-zinc-500">{pct}%</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
