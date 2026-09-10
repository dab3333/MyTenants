import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getBuildingOverview } from "@/lib/buildingOverview";
import { AddFloorForm } from "./AddFloorForm";
import { AddRoomForm } from "./AddRoomForm";

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

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const scoped = createScopedClient(session.user.organizationId);
  const building = await getBuildingOverview(scoped, id);

  if (!building) {
    return (
      <main className="p-6">
        <p>Building not found.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-1">{building.name}</h1>
      {building.address && <p className="text-zinc-500 mb-6">{building.address}</p>}

      <div className="mt-6">
        <AddFloorForm buildingId={building.id} />
      </div>

      <div className="mt-8 space-y-6">
        {building.floors.map((floor) => (
          <section key={floor.id}>
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">{floor.label}</h2>
            <div className="flex gap-3 flex-wrap mb-2">
              {floor.rooms.map((room) => {
                const status = statusFor(room.occupied, room.capacity);
                return (
                  <div
                    key={room.id}
                    data-testid="room-card"
                    data-status={status}
                    className={`rounded-lg p-3 min-w-[7rem] border ${STATUS_CLASSES[status]}`}
                  >
                    <div className="font-semibold">{room.name}</div>
                    <div className="text-sm">
                      {room.occupied}/{room.capacity}
                    </div>
                  </div>
                );
              })}
              {floor.rooms.length === 0 && <p className="text-zinc-500 text-sm">No rooms yet.</p>}
            </div>
            <AddRoomForm floorId={floor.id} />
          </section>
        ))}
        {building.floors.length === 0 && <p className="text-zinc-500">No floors yet.</p>}
      </div>
    </main>
  );
}
