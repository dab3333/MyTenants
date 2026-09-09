import type { BuildingOccupancy } from "@/lib/dashboardMetrics";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const STATUS_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "bg-gray-100",
  partial: "bg-yellow-100",
  full: "bg-red-100",
};

export function OccupancyByBuilding({ buildings }: { buildings: BuildingOccupancy[] }) {
  if (buildings.length === 0) {
    return <p className="text-gray-500">No buildings yet.</p>;
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
