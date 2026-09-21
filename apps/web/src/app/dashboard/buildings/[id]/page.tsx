import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createScopedClient } from "@mytenants/db";
import { getBuildingOverview } from "@/lib/buildingOverview";
import { AddFloorForm } from "./AddFloorForm";
import { AddRoomForm } from "./AddRoomForm";
import { BuildingMenu } from "./BuildingMenu";
import { FloorMenu } from "./FloorMenu";
import { RoomCard } from "./RoomCard";

function statusFor(occupied: number, capacity: number): "vacant" | "partial" | "full" {
  if (occupied === 0) return "vacant";
  if (occupied >= capacity) return "full";
  return "partial";
}

const CARD = "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.organizationId) return {};
  const { id } = await params;
  const scoped = createScopedClient(session.user.organizationId);
  const building = await scoped.building.findFirst({ where: { id }, select: { name: true } });
  return { title: building?.name ?? "Building" };
}

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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">{building.name}</h1>
            <BuildingMenu buildingId={building.id} name={building.name} address={building.address} />
          </div>
          {building.address && <p className="text-zinc-500">{building.address}</p>}
        </div>
        <AddFloorForm buildingId={building.id} />
      </div>

      <div className="space-y-6">
        {building.floors.map((floor) => (
          <section key={floor.id} className={CARD}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">{floor.label}</h2>
              <FloorMenu floorId={floor.id} label={floor.label} />
            </div>
            <div className="flex gap-3 flex-wrap">
              {floor.rooms.map((room) => {
                const status = statusFor(room.occupied, room.capacity);
                return (
                  <RoomCard
                    key={room.id}
                    roomId={room.id}
                    roomName={room.name}
                    occupied={room.occupied}
                    capacity={room.capacity}
                    status={status}
                    tenants={room.tenants}
                  />
                );
              })}
              <AddRoomForm floorId={floor.id} />
            </div>
          </section>
        ))}
        {building.floors.length === 0 && <p className="text-zinc-500">No floors yet.</p>}
      </div>
    </main>
  );
}
