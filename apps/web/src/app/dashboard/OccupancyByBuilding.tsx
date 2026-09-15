import Link from "next/link";
import type { BuildingOccupancy } from "@/lib/dashboardMetrics";
import { BuildingMark } from "./icons";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const BADGE_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-zinc-100 text-zinc-500",
  partial: "bg-amber-50 text-amber-700",
  full: "bg-green-50 text-green-700",
};

const BAR_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-zinc-300",
  partial: "bg-amber-500",
  full: "bg-green-500",
};

const STATUS_LABELS: Record<"vacant" | "partial" | "full", string> = {
  vacant: "Vacant",
  partial: "Partial",
  full: "Full",
};

export function OccupancyByBuilding({ buildings }: { buildings: BuildingOccupancy[] }) {
  if (buildings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="text-clay-300">
          <BuildingMark />
        </span>
        <p className="text-zinc-500">No buildings yet.</p>
        <Link
          href="/dashboard/buildings"
          className="text-sm font-medium text-clay-700 underline decoration-clay-300 underline-offset-2 hover:text-clay-800 hover:decoration-clay-500 transition-colors"
        >
          Add your first building
        </Link>
      </div>
    );
  }

  return (
    <ul>
      {buildings.map((building, index) => {
        const status = statusFor(building.occupiedCapacity, building.totalCapacity);
        const pct = building.totalCapacity > 0 ? Math.round((building.occupiedCapacity / building.totalCapacity) * 100) : 0;
        return (
          <li
            key={building.id}
            data-testid="occupancy-row"
            className={`py-3 ${index > 0 ? "border-t border-zinc-100" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium text-zinc-900">{building.name}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_CLASSES[status]}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full transition-[width] ${BAR_CLASSES[status]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                {building.occupiedCapacity}/{building.totalCapacity} · {pct}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
