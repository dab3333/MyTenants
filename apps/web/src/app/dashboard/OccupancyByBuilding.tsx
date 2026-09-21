"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BuildingOccupancy } from "@/lib/dashboardMetrics";
import { BuildingMark } from "./icons";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const DOT_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "border border-zinc-300 bg-white",
  partial: "bg-clay-500",
  full: "bg-clay-600",
};

const BAR_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "",
  partial: "bg-clay-500",
  full: "bg-clay-600",
};

const NAME_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "text-zinc-400",
  partial: "text-zinc-900",
  full: "text-zinc-900",
};

const PCT_CLASSES: Record<"vacant" | "partial" | "full", string> = {
  vacant: "text-zinc-400",
  partial: "text-zinc-900",
  full: "text-zinc-900",
};

export function OccupancyByBuilding({ buildings }: { buildings: BuildingOccupancy[] }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, []);

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
            className={`flex items-center gap-3.5 py-3.5 ${index > 0 ? "border-t border-zinc-100" : ""}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[status]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className={`truncate font-medium ${NAME_CLASSES[status]}`}>{building.name}</span>
                <span className="shrink-0 text-sm text-zinc-400">
                  {building.occupiedCapacity}/{building.totalCapacity} rooms
                </span>
              </div>
              <div className="mt-2 h-[5px] rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${BAR_CLASSES[status]}`}
                  style={{ width: animate ? `${pct}%` : "0%", transitionDelay: `${index * 70}ms` }}
                />
              </div>
            </div>
            <span className={`w-[52px] shrink-0 text-right text-xl font-bold tabular-nums ${PCT_CLASSES[status]}`}>
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
