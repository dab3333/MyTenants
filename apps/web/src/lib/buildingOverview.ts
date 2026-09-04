import type { createScopedClient } from "@mytenants/db";

export type RoomOccupancy = {
  id: string;
  name: string;
  capacity: number;
  monthlyRate: string;
  occupied: number;
};

export type FloorOverview = {
  id: string;
  label: string;
  rooms: RoomOccupancy[];
};

export type BuildingOverview = {
  id: string;
  name: string;
  address: string | null;
  floors: FloorOverview[];
};

export async function getBuildingOverview(
  scoped: ReturnType<typeof createScopedClient>,
  buildingId: string
): Promise<BuildingOverview | null> {
  const building = await scoped.building.findFirst({
    where: { id: buildingId },
    include: {
      floors: {
        orderBy: { createdAt: "asc" },
        include: { rooms: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!building) return null;

  const roomIds = building.floors.flatMap((floor) => floor.rooms.map((room) => room.id));

  const occupancyCounts = roomIds.length
    ? await scoped.tenancy.groupBy({
        by: ["roomId"],
        where: { roomId: { in: roomIds }, status: "ACTIVE" },
        _count: { _all: true },
      })
    : [];
  const occupiedByRoomId = new Map(occupancyCounts.map((row) => [row.roomId, row._count._all]));

  return {
    id: building.id,
    name: building.name,
    address: building.address,
    floors: building.floors.map((floor) => ({
      id: floor.id,
      label: floor.label,
      rooms: floor.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        monthlyRate: room.monthlyRate.toString(),
        occupied: occupiedByRoomId.get(room.id) ?? 0,
      })),
    })),
  };
}
