import type { BuildingOccupancy } from "@/lib/dashboardMetrics";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const STATUS_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-zinc-100 text-zinc-600",
  partial: "bg-amber-100 text-amber-800",
  full: "bg-red-100 text-red-800",
};

export function OccupancyByBuilding({ buildings }: { buildings: BuildingOccupancy[] }) {
  if (buildings.length === 0) {
    return <p className="text-zinc-500">No buildings yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {buildings.map((building) => {
        const status = statusFor(building.occupiedCapacity, building.totalCapacity);
        const pct = building.totalCapacity > 0 ? Math.round((building.occupiedCapacity / building.totalCapacity) * 100) : 0;
        return (
          <li key={building.id} data-testid="occupancy-row" className={`rounded px-3 py-2 ${STATUS_CLASSES[status]}`}>
            {building.name} — {building.occupiedCapacity}/{building.totalCapacity} ({pct}%)
          </li>
        );
      })}
    </ul>
  );
}
